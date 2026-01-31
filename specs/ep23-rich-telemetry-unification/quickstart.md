# Quickstart: Rich Telemetry in HoneyHive

> **Epic**: EP23
> **Status**: Design Complete

---

## Overview

EP23 enables rich, debuggable traces in HoneyHive by capturing prompt/completion content, full tool arguments/results, and proper span hierarchy. This guide shows how to use these features.

---

## Enabling Content Capture

Content capture is **disabled by default** per Constitution Principle I (Local-First). You must explicitly opt-in.

### Option 1: Environment Variable (Recommended)

```bash
# Enable content capture for this session
export AGENTLINT_CAPTURE_CONTENT=true

# Run agentlint
agentlint analyse /path/to/project
```

### Option 2: Configuration File

Add to `~/.agentlint/config.json`:

```json
{
  "telemetry": {
    "enabled": true,
    "mode": "alpha",
    "captureContent": true,
    "maxContentLength": 5000
  }
}
```

**Note**: Environment variable overrides configuration file.

---

## What Gets Captured

### When Content Capture is ENABLED

| Data Type | HoneyHive Field | Notes |
|-----------|-----------------|-------|
| Prompt messages | `inputs.messages` | Full chat history |
| Completion text | `outputs.content` | Model response |
| System prompt | `inputs.system_instructions` | System instructions |
| Tool arguments | `inputs.arguments` | Full tool input |
| Tool results | `outputs.result` | Full tool output |

### When Content Capture is DISABLED (default)

| Data Type | HoneyHive Field | Notes |
|-----------|-----------------|-------|
| Token counts | `metrics.*_tokens` | Always tracked |
| Timing | `metrics.latency_ms` | Always tracked |
| Model name | `config.model` | Always tracked |
| Tool name | `config.tool_name` | Always tracked |
| Success/failure | `outputs.success` | Always tracked |

---

## Viewing Traces in HoneyHive

1. **Navigate to Sessions**: Open HoneyHive and go to your agentlint project
2. **Find Your Session**: Sessions are named `agentlint-{command}-{date}`
3. **Open Waterfall View**: Click on a session to see the trace
4. **Inspect Events**: Click on individual LLM or tool events to see details

### Understanding the Hierarchy

```
Session: agentlint-analyse-2026-01-31
├── LLM Turn 1 (claude-sonnet-4)
│   ├── Tool: explore_directory
│   └── Tool: read_file
├── LLM Turn 2 (claude-sonnet-4)
│   └── Tool: run_analysis
└── Session End (metrics summary)
```

Each event shows:
- **Config**: Model/tool settings
- **Inputs**: What went in (prompts, arguments)
- **Outputs**: What came out (completion, results)
- **Metrics**: Tokens, timing, cost

---

## Privacy & Security

### Secrets Are Always Redacted

Even when content capture is enabled, sensitive data is redacted:

| Pattern | Redacted To |
|---------|-------------|
| `sk-abc123...` | `[REDACTED:API_KEY]` |
| `Bearer xyz...` | `[REDACTED:TOKEN]` |
| `password=secret` | `[REDACTED:PASSWORD]` |
| HoneyHive keys | `[REDACTED:API_KEY]` |

### Truncation

Large content is truncated to prevent memory issues:

- **Default limit**: 5000 characters
- **Customize**: `AGENTLINT_CAPTURE_MAX_LENGTH=10000`
- **Marker**: `[truncated at 5000 chars]`

---

## Configuration Reference

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `AGENTLINT_CAPTURE_CONTENT` | Enable content capture | `false` |
| `AGENTLINT_CAPTURE_MAX_LENGTH` | Max content length | `5000` |
| `AGENTLINT_TELEMETRY` | Telemetry mode | `alpha` |

### Config File Keys

```json
{
  "telemetry": {
    "enabled": true,
    "mode": "alpha",
    "captureContent": true,
    "maxContentLength": 5000
  }
}
```

---

## Correlating Local and Remote Traces

Every event includes a `trace_id` for correlation:

1. **Local logs**: `~/.agentlint/logs/traces-{date}.ndjson`
2. **HoneyHive**: Same `trace_id` in event metadata

To find a local trace in HoneyHive:

```bash
# Get trace ID from local logs
grep "traceId" ~/.agentlint/logs/traces-2026-01-31.ndjson | head -1

# Search in HoneyHive by trace_id metadata
```

---

## Troubleshooting

### No Content in HoneyHive

1. **Check env var**: `echo $AGENTLINT_CAPTURE_CONTENT` should be `true`
2. **Check config**: Look for `captureContent: true` in config
3. **Check session**: Older sessions won't have content retroactively

### Traces Not Appearing

1. **Check telemetry enabled**: `echo $AGENTLINT_TELEMETRY` or config
2. **Check network**: Verify you can reach HoneyHive API
3. **Check flush**: Wait for session end (events buffered)

### Content Truncated

1. **Increase limit**: `export AGENTLINT_CAPTURE_MAX_LENGTH=10000`
2. **Check logs**: Look for `[truncated at N chars]` marker

---

## Best Practices

1. **Enable for debugging only**: Don't leave content capture on in production
2. **Review traces**: Verify no secrets leaked before sharing
3. **Use local logs first**: Check `~/.agentlint/logs/` before HoneyHive
4. **Set reasonable limits**: Balance debuggability with payload size

---

## Next Steps

- [Spec](./spec.md) - Full feature specification
- [Plan](./plan.md) - Implementation phases
- [Data Model](./data-model.md) - Schema details
- [Contracts](./contracts/interfaces.ts) - TypeScript interfaces
