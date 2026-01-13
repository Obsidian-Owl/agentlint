---
status: accepted
date: 2026-01-12
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0009: Observability Strategy

## Context and Problem Statement

agentlint needs observability capabilities for two distinct purposes:

1. **Local debugging**: Help users and developers debug agentlint issues locally
2. **Product improvement**: Collect anonymized usage data to improve agentlint (future, opt-in)

ADR-0006 selected the Vercel AI SDK with native OpenTelemetry support. This ADR decides how to leverage that capability while respecting the Local-First principle and preparing for future agentlint-owned telemetry collection.

The architecture must support easy enablement of remote telemetry via feature flag, without requiring architectural changes post-MVP.

## Decision Drivers

- **Local-First principle**: Local observability must work without network connectivity
- **Progressive Value principle**: Debugging should work without any configuration
- **ADR-0006 alignment**: Leverage Vercel AI SDK's native OpenTelemetry support
- **Future readiness**: Architecture should support agentlint-owned telemetry endpoint
- **Privacy by design**: Sensitive data must be redacted before remote transmission
- **User consent**: Remote telemetry requires explicit, informed opt-in

## Considered Options

1. Dual-Exporter OpenTelemetry Pipeline
2. Structured Logging with OTel Bridge
3. Custom Telemetry Abstraction

## Decision Outcome

Chosen option: **"Dual-Exporter OpenTelemetry Pipeline"** because it leverages the Vercel AI SDK's native OTel integration (ADR-0006), follows industry standards, and provides a clean architecture where remote telemetry is simply a feature flag flip.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    TELEMETRY PIPELINE                           │
├─────────────────────────────────────────────────────────────────┤
│  INSTRUMENTATION LAYER                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Vercel AI SDK Telemetry                                  │   │
│  │ • LLM calls: model, tokens, latency, tool calls          │   │
│  │ • experimental_telemetry: { isEnabled: true }            │   │
│  │ • recordInputs: false, recordOutputs: false (privacy)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ agentlint Custom Spans                                   │   │
│  │ • Command execution: analyse, baseline, trace            │   │
│  │ • Analysis phases: static, agentic, synthesis            │   │
│  │ • Findings: issue counts by type, recommendation counts  │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Metrics                                                  │   │
│  │ • Counter: command invocations                           │   │
│  │ • Histogram: analysis duration                           │   │
│  │ • Gauge: session log size processed                      │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  PROCESSING LAYER                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Batch Processor                                          │   │
│  │ • Batches spans/metrics for efficient export             │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Redaction Processor (applied to REMOTE export only)     │   │
│  │ • Hash: file paths, project names, session IDs          │   │
│  │ • Remove: prompts, code content, API keys               │   │
│  │ • Keep: aggregated metrics, error types, timing         │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  EXPORT LAYER                                                   │
│  ┌───────────────────────┐    ┌─────────────────────────────┐  │
│  │ LOCAL EXPORTER        │    │ REMOTE EXPORTER             │  │
│  │ (always enabled)      │    │ (feature flagged)           │  │
│  │                       │    │                             │  │
│  │ • File destination:   │    │ • Endpoint: telemetry.      │  │
│  │   ~/.local/share/     │    │   agentlint.io (future)     │  │
│  │   agentlint/          │    │                             │  │
│  │   telemetry/          │    │ • Protocol: OTLP/HTTP       │  │
│  │                       │    │                             │  │
│  │ • traces.jsonl        │    │ • MVP: DISABLED             │  │
│  │ • metrics.jsonl       │    │ • Receives redacted data    │  │
│  │                       │    │                             │  │
│  │ • Unredacted for      │    │ • Requires user consent     │  │
│  │   debugging           │    │                             │  │
│  └───────────────────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Consent Management

Remote telemetry requires explicit user consent, managed as follows:

**Initial Consent (via `agentlint init`)**:
```
$ agentlint init

[... project setup ...]

📊 Anonymous Telemetry (Optional)

agentlint can collect anonymous usage data to help improve the tool.

What we collect:
  • Command usage counts and timing
  • Analysis findings by category (not content)
  • Error types (not stack traces with paths)
  • LLM model and token usage

What we NEVER collect:
  • File paths, project names, or code
  • Prompts, responses, or session content
  • API keys or credentials

This is optional and you can change your preference at any time
with 'agentlint telemetry enable/disable'.

Enable anonymous telemetry? [y/N]:
```

**Post-Init Management**:
```bash
# Enable telemetry
agentlint telemetry enable

# Disable telemetry
agentlint telemetry disable

# Check status
agentlint telemetry status
```

**Storage**:
- Consent stored in `~/.config/agentlint/config.toml` as `telemetry.enabled = true/false`
- Environment variable override: `AGENTLINT_TELEMETRY_OPTOUT=1` to force disable
- Default: disabled (opt-in, not opt-out)

### Data Classification

| Category | Local Export | Remote Export | Redaction |
|----------|--------------|---------------|-----------|
| Command name | ✅ | ✅ | None |
| Command duration | ✅ | ✅ | None |
| Analysis phase timings | ✅ | ✅ | None |
| Finding counts by type | ✅ | ✅ | None |
| LLM model name | ✅ | ✅ | None |
| Token counts | ✅ | ✅ | None |
| Error types | ✅ | ✅ | None |
| File paths | ✅ | ❌ | Hashed (SHA-256, first 8 chars) |
| Project name | ✅ | ❌ | Hashed |
| Session IDs | ✅ | ❌ | Hashed |
| Code content | ✅ | ❌ | Never sent |
| Prompts/responses | ❌ | ❌ | Never collected |
| API keys | ❌ | ❌ | Never collected |
| Stack traces | ✅ | ❌ | Paths redacted |

### MVP vs Future State

| Capability | MVP | Future |
|------------|-----|--------|
| Local file export | ✅ Enabled | ✅ Enabled |
| Remote export code | ✅ Built, disabled | ✅ Enabled |
| Redaction processor | ✅ Built, applied | ✅ Applied |
| Consent flow | ✅ `init` + command | ✅ Same |
| agentlint endpoint | ❌ Not deployed | ✅ telemetry.agentlint.io |
| Feature flag | `AGENTLINT_REMOTE_TELEMETRY=false` | `=true` in release |

### Consequences

**Good:**
- Local debugging always works, no network required
- Leverages Vercel AI SDK's native OpenTelemetry (ADR-0006)
- Industry-standard OTel pipeline; users can integrate with their own collectors
- Future remote telemetry is a config/flag change, not architecture change
- Privacy by design: redaction processor ensures sensitive data never leaves
- Explicit opt-in respects user autonomy

**Bad:**
- OTel pipeline adds some complexity to the codebase
- Local telemetry files will grow; need rotation/cleanup
- Two exporters to maintain (local + remote)

**Neutral:**
- MVP includes remote export code but doesn't use it (acceptable for future readiness)
- Users familiar with OTel can point to their own collectors if desired

## Pros and Cons of Options

### Option 1: Dual-Exporter OpenTelemetry Pipeline

Full OTel pipeline with local (always-on) and remote (feature-flagged) exporters.

- Good: Native integration with Vercel AI SDK (ADR-0006)
- Good: Industry-standard OTel; users can integrate with existing tooling
- Good: Clear separation of local (unredacted) vs remote (redacted) concerns
- Good: Feature flag flip for remote enablement
- Neutral: Medium implementation complexity
- Bad: OTel concepts may be unfamiliar to some contributors

### Option 2: Structured Logging with OTel Bridge

Primary structured logging with OTel generation as secondary bridge.

- Good: Simpler debugging (just read log files)
- Good: Familiar logging patterns
- Neutral: Bridge can be lossy (log → span mapping)
- Bad: Two systems to maintain
- Bad: Less trace context propagation
- Bad: Doesn't leverage ADR-0006's OTel investment

### Option 3: Custom Telemetry Abstraction

Thin abstraction layer with config-driven behavior.

- Good: Clean API, easy testing
- Good: Can swap underlying implementations
- Neutral: Medium complexity
- Bad: Custom abstraction to maintain
- Bad: May diverge from OTel conventions
- Bad: Harder for users with existing OTel setups

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | ✅ Yes | Local export always works without network |
| II. Improvement-Oriented | ✅ Yes | Telemetry enables product improvement cycle |
| III. Causal-First | N/A | Observability doesn't directly affect causal analysis |
| IV. Mixed-Methods | ✅ Yes | Captures both quantitative (metrics) and qualitative (traces) |
| V. Language-Agnostic | ✅ Yes | Telemetry independent of target language |
| VI. Tool-Agnostic | ✅ Yes | OTel standard works with any observability backend |
| VII. Static-First | ✅ Yes | Telemetry collection is lightweight, no LLM required |
| VIII. Progressive Value | ✅ Yes | Local debugging works without any remote configuration |
| IX. Agent-Aware | ✅ Yes | Vercel AI SDK telemetry captures agent LLM interactions |

## More Information

### Related Documents
- [ADR-0006: Agentic Analysis Implementation](./0006-agentic-analysis-implementation.md) - Vercel AI SDK with native OTel
- [ADR-0004: Configuration File Locations](./0004-configuration-file-locations.md) - Config storage for consent
- [ADR-0003: Local Storage Strategy](./0003-local-storage-strategy.md) - XDG locations for telemetry files
- Design Questions: [Section 4.4 - Observability Strategy](../../design-questions.md#44-observability-strategy)

### Research Sources
- [OpenTelemetry AI Agent Observability](https://opentelemetry.io/blog/2025/ai-agent-observability/) - GenAI semantic conventions
- [Vercel AI SDK Telemetry Docs](https://ai-sdk.dev/docs/ai-sdk-core/telemetry) - Native OTel integration
- [OpenTelemetry Handling Sensitive Data](https://opentelemetry.io/docs/security/handling-sensitive-data/) - Redaction best practices
- [Redaction Processor Guide](https://www.dash0.com/guides/opentelemetry-redaction-processor) - Attribute sanitization
- [.NET CLI Telemetry](https://learn.microsoft.com/en-us/dotnet/core/tools/telemetry) - CLI consent patterns
- [CLI Telemetry Best Practices](https://marcon.me/articles/cli-telemetry-best-practices/) - Privacy and UX patterns
- [Langfuse Self-Hosting](https://langfuse.com/self-hosting) - LLM observability patterns
- [OpenTelemetry LLM Observability Guide](https://medium.com/@kartikdudeja21/llm-observability-with-opentelemetry-a-practical-guide-18f3f51d6a50) - Practical implementation

### Implementation Notes

#### 1. TracerProvider Setup

```typescript
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

// Custom local file exporter
class LocalFileExporter implements SpanExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void) {
    const telemetryPath = path.join(
      process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'),
      'agentlint/telemetry/traces.jsonl'
    );
    // Append spans as JSONL
    for (const span of spans) {
      fs.appendFileSync(telemetryPath, JSON.stringify(spanToJson(span)) + '\n');
    }
    resultCallback({ code: ExportResultCode.SUCCESS });
  }
}

// Redaction processor for remote export
class RedactionProcessor implements SpanProcessor {
  onEnd(span: ReadableSpan) {
    // Hash sensitive attributes
    if (span.attributes['file.path']) {
      span.attributes['file.path.hash'] = hash(span.attributes['file.path']);
      delete span.attributes['file.path'];
    }
    // Remove content attributes
    delete span.attributes['ai.prompt'];
    delete span.attributes['ai.response'];
  }
}

// Setup
const provider = new NodeTracerProvider();

// Local exporter - always enabled
provider.addSpanProcessor(new BatchSpanProcessor(new LocalFileExporter()));

// Remote exporter - feature flagged
if (config.telemetry.remoteEnabled && userConsent.granted) {
  const remoteExporter = new OTLPTraceExporter({
    url: 'https://telemetry.agentlint.io/v1/traces',
  });
  provider.addSpanProcessor(new RedactionProcessor());
  provider.addSpanProcessor(new BatchSpanProcessor(remoteExporter));
}

provider.register();
```

#### 2. Vercel AI SDK Integration

```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: analysisPrompt,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'agentlint.agentic-analysis',
    metadata: {
      analysisType: 'session-quality',
      projectHash: hashProjectName(projectName),
    },
    // Privacy: never record actual prompts/responses
    recordInputs: false,
    recordOutputs: false,
  },
});
```

#### 3. Consent Storage

Extends ADR-0004 config schema:

```toml
# ~/.config/agentlint/config.toml

[telemetry]
enabled = false  # User's choice from init or command
# If true, anonymous telemetry is sent to agentlint.io when available
```

#### 4. Local Telemetry Cleanup

Implement rotation to prevent unbounded growth:

```typescript
// Rotate when file exceeds 10MB
const MAX_TELEMETRY_SIZE = 10 * 1024 * 1024;

function rotateIfNeeded(telemetryPath: string) {
  const stats = fs.statSync(telemetryPath);
  if (stats.size > MAX_TELEMETRY_SIZE) {
    const archivePath = `${telemetryPath}.${Date.now()}.old`;
    fs.renameSync(telemetryPath, archivePath);
    // Keep last 3 archives
    cleanupOldArchives(path.dirname(telemetryPath), 3);
  }
}
```

### Follow-Up Decisions

This ADR surfaces the need for:

1. **`agentlint init` Command Design**: Full specification of the init workflow (new design question)
2. **Telemetry Backend**: When to deploy agentlint.io telemetry endpoint (post-MVP planning)
3. **Data Retention Policy**: How long to retain telemetry data on agentlint.io (future ADR)
