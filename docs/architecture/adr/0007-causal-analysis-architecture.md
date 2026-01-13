---
status: accepted
date: 2026-01-12
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0007: Causal Analysis Architecture

## Context and Problem Statement

Causal analysis is agentlint's **core differentiator**. Traditional linters detect issues; agentlint traces them to their origin and recommends prevention. The causal analysis model (DETECT → TRACE → UNDERSTAND → PREVENT) requires:

1. **Evidence gathering** from multiple sources (git, session logs, configs)
2. **Causal inference** to link issues to their origins
3. **Confidence assessment** so users know how reliable traces are
4. **Prevention synthesis** to generate actionable recommendations

The challenge: Session logs from AI tools (Claude Code, Copilot CLI, etc.) can be 100MB+, far exceeding LLM context limits. We need an architecture that enables causal analysis without "blowing context windows."

## Decision Drivers

- **Causal-First principle**: Every issue should link back to origin and prevention
- **Agent flexibility**: Agent chooses between tool-based extraction and direct reasoning based on task needs
- **Mixed-Methods principle**: Combine quantitative evidence with qualitative synthesis
- **Improvement-Oriented**: User feedback should improve future traces
- **Research findings**: LLM causal reasoning is often "post-hoc rationalization" - need evidence-based approach
- **Context limits**: 100MB+ session logs cannot be sent to LLM directly
- **Accuracy**: False causality is worse than no causality (user trust)

## Considered Options

1. Evidence-First with LLM Synthesis + Multi-Pass Verification
2. LLM-Primary Causal Reasoning
3. Rule-Based with LLM Fallback
4. Multi-Pass Consensus Only

## Decision Outcome

Chosen option: **"Evidence-First with LLM Synthesis + Multi-Pass Verification"** because it addresses research findings that LLM causal reasoning is unreliable when not grounded in evidence, while enabling sophisticated causal understanding through LLM synthesis. Multi-pass verification adds confidence without the full cost of pure consensus approaches.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CAUSAL ANALYSIS PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 1: EVIDENCE GATHERING (Agent chooses approach)               │   │
│  │                                                                      │   │
│  │ The agent can use extraction tools OR read logs directly based on  │   │
│  │ what understanding is needed for the specific task.                │   │
│  │                                                                      │   │
│  │ Session Logs:                    Git History:                       │   │
│  │ • Parse structure (JSON/JSONL)   • Extract commit metadata          │   │
│  │ • Extract timestamps             • Identify AI-authored commits     │   │
│  │ • Extract tool calls             • Parse Co-Author tags             │   │
│  │ • Count tokens/turns             • Build file change timeline       │   │
│  │ • Index by session ID            • Correlate with session IDs       │   │
│  │ • Build searchable index                                            │   │
│  │                                                                      │   │
│  │ Config State:                    Issue Context:                     │   │
│  │ • Snapshot config at each        • Extract issue location           │   │
│  │   baseline point                 • Identify affected files          │   │
│  │ • Diff config changes            • Timestamp of issue appearance    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 2: EVIDENCE CORRELATION (Static + Indexed Search)            │   │
│  │                                                                      │   │
│  │ For each detected issue:                                            │   │
│  │ 1. Query git: When did this content appear? Who/what authored it?  │   │
│  │ 2. Query session index: Sessions within ±24h of file change        │   │
│  │ 3. Match prompts: FTS5 search for related terms in session logs    │   │
│  │ 4. Config gap analysis: Was relevant guidance present at time?     │   │
│  │                                                                      │   │
│  │ Output: Evidence Bundle                                              │   │
│  │ {                                                                    │   │
│  │   issue: "Secret in CLAUDE.md:42",                                  │   │
│  │   commit: { hash, date, author, ai_authored: true },                │   │
│  │   candidate_sessions: [{ id, date, prompt_excerpts[] }],            │   │
│  │   config_at_time: { had_credential_guidance: false },               │   │
│  │   temporal_evidence: { session_precedes_commit: true }              │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 3: LLM SYNTHESIS (Agentic, Compressed Context)               │   │
│  │                                                                      │   │
│  │ Input: Evidence Bundle (NOT raw logs)                               │   │
│  │                                                                      │   │
│  │ LLM Tasks:                                                           │   │
│  │ 1. Synthesize causal narrative from evidence                        │   │
│  │ 2. Identify the triggering prompt/action                            │   │
│  │ 3. Explain WHY the issue occurred (config gap, unclear guidance)   │   │
│  │ 4. Generate preventive recommendation                               │   │
│  │                                                                      │   │
│  │ Output: Causal Claim                                                 │   │
│  │ {                                                                    │   │
│  │   issue: "...",                                                     │   │
│  │   traced_origin: { session, prompt, gap },                          │   │
│  │   explanation: "The secret was added when...",                      │   │
│  │   prevention: "Add to CLAUDE.md: Never hardcode secrets..."         │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 4: VERIFICATION PASS (Multi-Pass Cross-Check)                │   │
│  │                                                                      │   │
│  │ Second LLM pass with different prompt:                              │   │
│  │ "Given this evidence, is the claimed causality plausible?"          │   │
│  │                                                                      │   │
│  │ Cross-checks:                                                        │   │
│  │ • Temporal consistency (cause precedes effect?)                     │   │
│  │ • Evidence sufficiency (is there direct evidence?)                  │   │
│  │ • Alternative explanations (other possible causes?)                 │   │
│  │                                                                      │   │
│  │ Output: Confidence Assessment                                        │   │
│  │ {                                                                    │   │
│  │   confidence: "HIGH" | "MEDIUM" | "LOW",                            │   │
│  │   evidence_strength: { direct, circumstantial, inferred },          │   │
│  │   alternative_causes: [...] (if any)                                │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 5: USER FEEDBACK LOOP                                         │   │
│  │                                                                      │   │
│  │ User can:                                                            │   │
│  │ • Confirm trace: "Yes, this was the cause"                          │   │
│  │ • Reject trace: "No, the actual cause was..."                       │   │
│  │ • Provide alternative: Link to different session/commit             │   │
│  │                                                                      │   │
│  │ Feedback effects:                                                    │   │
│  │ • Confirmed: Strengthen matching rules, store as exemplar           │   │
│  │ • Rejected: Refine prompts, adjust correlation weights              │   │
│  │ • Alternative: Add to evidence corpus for future traces             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Session Log Analysis Strategy

**The Context Window Challenge**:
- Claude Code session logs can be 100MB+ (JSONL format)
- Cannot send raw logs to LLM (context limits, cost, latency)
- Need to extract relevant evidence without losing causal signal

**Solution: Static Extraction + Indexed Search**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SESSION LOG PROCESSING PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RAW SESSION LOGS (~100MB)                                                  │
│  ~/.claude/projects/*/sessions/*.jsonl                                      │
│                                                                             │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STREAMING PARSER (No full load into memory)                         │   │
│  │ • Stream JSONL line by line                                          │   │
│  │ • Extract: timestamp, role, tool_calls, token_counts                │   │
│  │ • Skip: full message content (too large)                            │   │
│  │ • Index: session_id, date_range, tool_distribution                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SQLite + FTS5 INDEX (Per ADR-0003)                                  │   │
│  │                                                                      │   │
│  │ Tables:                                                              │   │
│  │ • session_metadata: id, project, start_time, end_time, stats        │   │
│  │ • session_messages: id, session_id, timestamp, role, tool_name      │   │
│  │ • session_prompts: id, session_id, prompt_text (first 500 chars)   │   │
│  │                                                                      │   │
│  │ FTS5 Virtual Table:                                                  │   │
│  │ • prompt_search: session_id, prompt_excerpt, timestamp              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ EVIDENCE RETRIEVAL (Query Time)                                     │   │
│  │                                                                      │   │
│  │ Given issue at file:line appearing in commit at time T:             │   │
│  │ 1. SELECT sessions WHERE end_time BETWEEN T-24h AND T+1h            │   │
│  │ 2. FTS5 MATCH: Search prompts for file name, feature terms          │   │
│  │ 3. Return: session_id, prompt_excerpts[], tool_calls[]              │   │
│  │                                                                      │   │
│  │ This retrieves ~1KB of evidence from ~100MB of logs                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ AGENT ACCESS TO RAW LOGS                                            │   │
│  │                                                                      │   │
│  │ Agent has access to both extracted evidence bundles AND raw logs.   │   │
│  │ The agent chooses based on what understanding the task requires:    │   │
│  │ • Tool: read_session_excerpt(session_id, message_range)             │   │
│  │ • Returns: 10-50 messages around the relevant prompt                │   │
│  │ • Use case: When semantic understanding of context is needed        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Confidence Grading Model

Evidence-based confidence levels:

| Level | Criteria | Example |
|-------|----------|---------|
| **HIGH** | Direct evidence: matching session + commit + temporal alignment | Session "add API config" → commit adds secret → gap in credential guidance |
| **MEDIUM** | Circumstantial: temporal correlation without prompt match, OR prompt match without commit correlation | Session in timeframe mentions "config" but no exact match |
| **LOW** | Inferred: LLM reasoning without strong evidence, OR user feedback override | No matching session, LLM infers from config state change |

```typescript
interface CausalTrace {
  issue: DetectedIssue;
  origin: {
    session?: { id: string; prompt_excerpt: string; timestamp: Date };
    commit?: { hash: string; author: string; ai_authored: boolean };
    config_gap?: { missing_guidance: string };
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence_strength: {
    direct: boolean;      // Session prompt explicitly matches issue
    circumstantial: boolean; // Temporal correlation
    inferred: boolean;    // LLM reasoning only
  };
  explanation: string;    // Human-readable causal narrative
  prevention: Recommendation;
  verified: boolean;      // Multi-pass verification passed
  user_feedback?: {
    confirmed: boolean;
    alternative_cause?: string;
    timestamp: Date;
  };
}
```

### User Feedback Learning

```typescript
// Feedback affects future tracing
async function processFeedback(trace: CausalTrace, feedback: UserFeedback) {
  if (feedback.confirmed) {
    // Strengthen matching patterns
    await addExemplar(trace);
    await incrementRuleWeight(trace.evidence_type);
  } else if (feedback.rejected) {
    // Refine prompts, add negative exemplar
    await addNegativeExemplar(trace);
    await decrementRuleWeight(trace.evidence_type);

    if (feedback.alternative_cause) {
      // Store user-provided causality for learning
      await storeUserProvidedTrace(trace.issue, feedback.alternative_cause);
    }
  }
}
```

### Consequences

**Good:**
- Evidence-based approach avoids "post-hoc rationalization" risks
- Static extraction handles 100MB+ logs without context overflow
- FTS5 indexing enables sub-millisecond evidence retrieval
- Multi-pass verification adds confidence without 5x cost (only 2 passes)
- User feedback creates continuous improvement loop
- Graded confidence lets users calibrate trust

**Bad:**
- More complex than pure LLM reasoning
- Requires session log parsing per AI tool (adapter complexity)
- Two LLM calls per trace (synthesis + verification)
- Feedback storage adds to database size

**Neutral:**
- Different AI tools have different log formats (adapter pattern absorbs this)
- Some issues may have LOW confidence traces (better than false HIGH)

## Pros and Cons of Options

### Option 1: Evidence-First with LLM Synthesis + Multi-Pass Verification

Static evidence gathering, LLM synthesis, verification pass for confidence.

- Good: Evidence-based (reliable per research)
- Good: Handles large logs via indexing
- Good: Verification adds confidence
- Good: Agent has access to both extraction tools and raw logs
- Neutral: Two LLM calls per trace
- Bad: More implementation complexity

### Option 2: LLM-Primary Causal Reasoning

LLM reasons about causality from all available context.

- Good: Simpler implementation
- Good: More sophisticated reasoning (theoretically)
- Bad: Research shows this is often "post-hoc rationalization"
- Bad: Cannot handle 100MB logs
- Bad: Non-deterministic, hard to verify
- Bad: Requires careful context management for large logs

### Option 3: Rule-Based with LLM Fallback

Deterministic rules establish causality, LLM only for edge cases.

- Good: Fully reproducible for rule-matched cases
- Good: Fast, cheap
- Neutral: Simple but inflexible
- Bad: Rules can't capture subtle causality
- Bad: Limited to explicit patterns
- Bad: May miss non-obvious causal chains

### Option 4: Multi-Pass Consensus Only

Multiple independent LLM passes, consensus determines confidence.

- Good: Highest confidence when consensus reached
- Good: Uncertainty quantification built-in
- Bad: 3-5x cost per trace
- Bad: Still subject to LLM reasoning limitations
- Bad: Slow (sequential passes)

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All evidence extraction and storage is local |
| II. Improvement-Oriented | Yes | User feedback improves future traces |
| III. Causal-First | Yes | Core focus of this ADR |
| IV. Mixed-Methods | Yes | Static evidence + LLM synthesis + user feedback |
| V. Language-Agnostic | Yes | Works regardless of target language |
| VI. Tool-Agnostic | Yes | Adapter pattern for different AI tool log formats |
| VII. Intelligent Tooling | Yes | Agent has both extraction tools and direct log access; chooses based on task |
| VIII. Compounding Value | Yes | Causal traces compound value through cross-session learning |
| IX. Agent-Aware | Yes | Evidence bundles are compressed for LLM; users see full traces |

## More Information

### Related Documents
- [ADR-0003: Local Storage Strategy](./0003-local-storage-strategy.md) - SQLite + FTS5 for evidence indexing
- [ADR-0006: Agentic Analysis Implementation](./0006-agent-orchestrated-analysis.md) - Vercel AI SDK for LLM synthesis
- [ADR-0008: Session Quality Analysis Methodology](./0008-session-quality-analysis.md) - Holistic session analysis (complementary to causal tracing)
- Architecture Vision: [Causal Analysis Model](../../agentlint-architecture-vision.md#causal-analysis-from-detection-to-prevention)
- Design Questions: [Section 2.4 - Causal Analysis Implementation](../../design-questions.md#24-causal-analysis-implementation)
- Use Cases: [UC-008: Trace Issue Origins](../../requirements/use-cases.md#uc-008-trace-issue-origins)

**Note on ADR-0008**: This ADR (0007) focuses on **causal tracing** - tracing specific issues back to their origin sessions/commits. ADR-0008 complements this with **holistic session quality analysis** - measuring overall session effectiveness, configuration compliance, prompt quality, and automation health. Both ADRs share the same infrastructure (streaming parser, FTS5 indexing) but serve distinct purposes:
- ADR-0007: "Why did this issue occur?" (retrospective, issue-focused)
- ADR-0008: "How effective are my sessions?" (holistic, improvement-focused)

### Research Sources
- [Chain-of-Thought Is Not Explainability](https://aigi.ox.ac.uk/wp-content/uploads/2025/07/Cot_Is_Not_Explainability.pdf) - CoT as post-hoc rationalization
- [Failure Modes of LLMs for Causal Reasoning](https://arxiv.org/html/2410.23884v5) - Parametric shortcuts in LLM reasoning
- [Meta's DrP Platform](https://engineering.fb.com/2025/12/19/data-infrastructure/drp-metas-root-cause-analysis-platform-at-scale/) - Industrial RCA at scale
- [Uncertainty Quantification Survey](https://arxiv.org/abs/2503.15850) - LLM confidence calibration (KDD 2025)
- [Human-in-the-Loop ML](https://link.springer.com/article/10.1007/s10462-022-10246-w) - Feedback loop patterns
- [git-ai](https://github.com/acunniffe/git-ai) - AI code attribution tracking
- [eARCO: Efficient Automated RCA](https://arxiv.org/html/2504.11505v1) - Prompt optimization for RCA

### AI Tool Session Log Formats

| Tool | Log Location | Format | Key Fields |
|------|--------------|--------|------------|
| Claude Code | `~/.claude/projects/*/sessions/` | JSONL | timestamp, role, content, tool_calls |
| Aider | `.aider.chat.history.md` | Markdown | Prompts, responses, file changes |
| Copilot CLI | Varies | JSON | command, suggestion, accepted |
| Cursor | `.cursor/` | Proprietary | TBD via adapter |

Each AI tool requires an adapter to:
1. Locate session logs
2. Parse format into normalized schema
3. Extract evidence fields (timestamp, prompts, tools)
4. Index into SQLite for FTS5 search

### Implementation Notes

1. **Streaming Parser**: Use Node.js/Bun streams to process large JSONL files without loading into memory
2. **Incremental Indexing**: Only index new sessions since last run
3. **Prompt Truncation**: Store first 500 chars of prompts (sufficient for FTS matching)
4. **Evidence Bundle Size**: Target <5KB per evidence bundle for LLM synthesis
5. **Verification Prompt**: Different from synthesis prompt to avoid echo chamber
6. **Feedback Storage**: Extend ADR-0003 schema with `trace_feedback` table

### Open Questions (Future ADRs)

1. **Cross-Project Tracing**: Can traces from one project inform recommendations for another?
2. **Team Attribution**: In team settings, how to handle multiple contributors?
3. **Privacy Controls**: Should users be able to exclude certain sessions from tracing?
