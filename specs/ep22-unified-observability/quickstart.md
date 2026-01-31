# Quickstart Guide: EP22 Unified Observability

This guide explains how to use agentlint's unified observability system for debugging and monitoring.

## Table of Contents

1. [Local Debugging](#local-debugging)
2. [Remote Telemetry (Opt-In)](#remote-telemetry-opt-in)
3. [Trace Correlation](#trace-correlation)
4. [Common Debugging Workflows](#common-debugging-workflows)

---

## Local Debugging

Local observability is **always enabled** by default. No configuration needed.

### Finding Your Logs

```bash
# Log files are stored in ~/.agentlint/logs/
ls ~/.agentlint/logs/

# View the most recent log file
tail -f ~/.agentlint/logs/agentlint-2026-01-30.ndjson
```

### Log Format

Each line is a JSON object with trace context:

```json
{
  "timestamp": "2026-01-30T10:15:30.123Z",
  "level": "info",
  "namespace": "agentlint:orchestrator",
  "message": "Session started",
  "trace_id": "018e5e5e5e5e70008000012345678ab",
  "span_id": "a1b2c3d4e5f6a7b8",
  "data": { "target": "." }
}
```

### Filtering Logs by Trace ID

When debugging an issue, find all logs from a single session:

```bash
# Find all logs for a specific trace
grep "018e5e5e5e5e70008000012345678ab" ~/.agentlint/logs/*.ndjson

# Or use jq for formatted output
cat ~/.agentlint/logs/agentlint-2026-01-30.ndjson | \
  jq 'select(.trace_id == "018e5e5e5e5e70008000012345678ab")'
```

### Filtering by Namespace

Focus on specific subsystems:

```bash
# SSE streaming events only
cat ~/.agentlint/logs/*.ndjson | jq 'select(.namespace == "agentlint:streaming")'

# TUI state changes only
cat ~/.agentlint/logs/*.ndjson | jq 'select(.namespace == "agentlint:tui")'

# Tool calls only
cat ~/.agentlint/logs/*.ndjson | jq 'select(.namespace == "agentlint:tools")'
```

### Log Namespaces

| Namespace | What It Captures |
|-----------|------------------|
| `agentlint:orchestrator` | Session lifecycle, phase transitions |
| `agentlint:streaming` | SSE events, stream lifecycle |
| `agentlint:tui` | TUI state transitions, render events |
| `agentlint:tools` | Tool calls, inputs, outputs |
| `agentlint:llm` | LLM requests, token usage |
| `agentlint:checkpoint` | Checkpoint writes, replays |

---

## Remote Telemetry (Opt-In)

Remote telemetry sends traces to HoneyHive for visualization and analysis. **This is opt-in only.**

### Enabling Remote Telemetry

```bash
# Set environment variable
export AGENTLINT_TELEMETRY=alpha

# Run agentlint normally
agentlint analyze .
```

### First-Time Consent

On first opt-in, you'll see a consent message:

```
╭──────────────────────────────────────────────────────────────╮
│  Telemetry Consent                                           │
├──────────────────────────────────────────────────────────────┤
│  You've opted into remote telemetry. This helps improve      │
│  agentlint by sending anonymized session data to HoneyHive.  │
│                                                              │
│  What's sent:                                                │
│  • Session duration and phases                               │
│  • Tool call names and durations (not inputs/outputs)        │
│  • Token usage statistics                                    │
│  • Error types (not details)                                 │
│                                                              │
│  What's NOT sent:                                            │
│  • File contents                                             │
│  • Prompts or responses                                      │
│  • API keys or secrets                                       │
│  • Personal identifiers                                      │
│                                                              │
│  Continue? [Y/n]                                             │
╰──────────────────────────────────────────────────────────────╯
```

### Using Your Own OTLP Endpoint

Power users can send traces to their own observability stack:

```bash
# Set your OTLP collector endpoint
export AGENTLINT_OTLP_ENDPOINT=https://otel.example.com:4318

# Optional: Add auth headers
export AGENTLINT_OTLP_HEADERS="Authorization=Bearer your-token"

# Enable telemetry
export AGENTLINT_TELEMETRY=alpha

# Run agentlint
agentlint analyze .
```

Traces will be sent to **both** the default proxy and your custom endpoint.

### Disabling Remote Telemetry

Simply unset the environment variable:

```bash
unset AGENTLINT_TELEMETRY
```

---

## Trace Correlation

The key benefit of unified observability: **one trace ID links everything**.

### Finding the Trace ID

The trace ID appears at the start of each session:

```
agentlint analyze .

Starting session...
  Trace ID: 018e5e5e5e5e70008000012345678ab
  ...
```

### Local → HoneyHive Correlation

1. Copy the trace ID from local logs or terminal output
2. Open HoneyHive UI
3. Search for the trace ID
4. View the full span hierarchy

### Checkpoint → Trace Correlation

Checkpoints include trace context for replay correlation:

```bash
# View checkpoint with trace context
cat ~/.agentlint/checkpoints/latest.json | jq '.trace_context'

# Output:
{
  "trace_id": "018e5e5e5e5e70008000012345678ab",
  "span_id": "a1b2c3d4e5f6a7b8",
  "parent_span_id": "0000000000000000"
}
```

When replaying a session, logs reference the original trace:

```bash
agentlint session replay <checkpoint-id>

# Logs will show:
# "Replaying from trace 018e5e5e5e5e70008000012345678ab"
```

---

## Common Debugging Workflows

### "SSE Events Not Reaching TUI"

1. Find the trace ID from session start
2. Filter logs by streaming namespace:
   ```bash
   grep "018e5e5e" ~/.agentlint/logs/*.ndjson | \
     jq 'select(.namespace == "agentlint:streaming")'
   ```
3. Look for:
   - `stream_started` event
   - `first_token` event with latency
   - Any errors between start and complete
4. If HoneyHive enabled, view the `sse_streaming` span for visual timeline

### "Agent Stuck on Thinking"

1. Get the trace ID
2. Check LLM spans:
   ```bash
   grep "018e5e5e" ~/.agentlint/logs/*.ndjson | \
     jq 'select(.namespace == "agentlint:llm")'
   ```
3. Look for:
   - Long `duration_ms` values
   - Missing `response` entries (request sent, no response)
   - Rate limit errors

### "Tool Call Failed"

1. Get the trace ID
2. Filter tool logs:
   ```bash
   grep "018e5e5e" ~/.agentlint/logs/*.ndjson | \
     jq 'select(.namespace == "agentlint:tools")'
   ```
3. Look for:
   - `tool.success: false` entries
   - Error messages in `data` field
   - Preceding tool calls that may have caused state issues

### "TUI State Inconsistency"

1. Get the trace ID
2. Filter TUI state logs:
   ```bash
   grep "018e5e5e" ~/.agentlint/logs/*.ndjson | \
     jq 'select(.namespace == "agentlint:tui")' | \
     jq 'select(.message | contains("state"))'
   ```
3. Look for:
   - State transitions (`from` → `to`)
   - Unexpected state sequences
   - Missing transitions

### "Reproducing a User Issue"

When a user reports an issue with a trace ID:

1. Ask for their trace ID
2. If they have HoneyHive enabled, view the trace in HoneyHive
3. If local only, ask them to share the filtered log:
   ```bash
   grep "<their-trace-id>" ~/.agentlint/logs/*.ndjson > issue-logs.ndjson
   ```
4. Analyze the span hierarchy and event sequence

---

## Configuration Reference

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENTLINT_TELEMETRY` | Enable remote telemetry (set to `alpha`) | Disabled |
| `AGENTLINT_OTLP_ENDPOINT` | Custom OTLP collector endpoint | None |
| `AGENTLINT_OTLP_HEADERS` | Auth headers for custom endpoint | None |
| `AGENTLINT_LOG_LEVEL` | Local log level (`debug`/`info`/`warn`/`error`) | `info` |

### Config File (`~/.agentlint/config.json`)

```json
{
  "observability": {
    "local": {
      "level": "info",
      "retentionDays": 30
    },
    "remote": {
      "sampleRate": 1.0
    }
  }
}
```

---

## Troubleshooting

### "Logs are too verbose"

Increase the log level:

```bash
export AGENTLINT_LOG_LEVEL=warn
```

Or in config:

```json
{
  "observability": {
    "local": { "level": "warn" }
  }
}
```

### "Log files are too large"

Clean up old logs:

```bash
# Delete logs older than 7 days
find ~/.agentlint/logs -name "*.ndjson" -mtime +7 -delete
```

Or reduce retention in config:

```json
{
  "observability": {
    "local": { "retentionDays": 7 }
  }
}
```

### "HoneyHive shows no traces"

1. Verify telemetry is enabled: `echo $AGENTLINT_TELEMETRY`
2. Check for export errors in logs:
   ```bash
   grep "export" ~/.agentlint/logs/*.ndjson | grep "error"
   ```
3. Verify network connectivity to proxy endpoint

### "Custom OTLP endpoint not receiving traces"

1. Verify the endpoint URL is correct
2. Check headers format: `Key1=Value1,Key2=Value2`
3. Look for connection errors in logs
4. Test the endpoint with curl:
   ```bash
   curl -X POST https://your-endpoint:4318/v1/traces \
     -H "Content-Type: application/json" \
     -d '{"resourceSpans":[]}'
   ```
