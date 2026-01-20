# EP11 Quality & Security - Design Checklist

## Constitution Compliance

- [x] **C1 Local-First**: All analysis on user's machine, no external transmission
  - Debug logs stay local (console or local file)
  - Secret detection processes locally, never transmits matches
  - Session checkpoints stored in local `.agentlint/` directory
  - Golden dataset in local codebase

- [x] **C2 Causal-First**: DETECT → TRACE → UNDERSTAND → RECOMMEND
  - Secret detection traces to specific file:line locations
  - Evaluation grades include reasoning for each metric
  - Outcome tracking links recommendations to their effectiveness

- [x] **C3 Agent-Aware**: Design serves agent cognitive needs
  - Cognitive workspace state preserved in checkpoints
  - Debug namespaces align with agent subsystems
  - Session replay restores agent context

- [x] **C4 Mixed-Methods**: Agent decides analysis approach
  - Secret detection uses pattern matching + LLM validation
  - Evaluation uses code-based checks + LLM-as-judge
  - Both approaches available, agent chooses based on context

- [x] **C5 Appropriate Automation**: Recommend, don't automate
  - Secret detection classifies and recommends, doesn't auto-remediate
  - Outcome tracking prompts for feedback, doesn't assume
  - Crash recovery prompts user, doesn't auto-resume

- [x] **C6 Transparent Reasoning**: Show how conclusions reached
  - LLM judge grades include reasoning for each metric
  - Secret classification includes confidence and reasoning
  - Debug mode exposes tool invocations and timing

- [x] **C7 Compounding Value**: Learning improves future sessions
  - Outcome metrics inform which recommendation types work best
  - Golden dataset grows from production failures
  - Session recordings enable debugging of past issues

- [x] **C8 Minimal Footprint**: Single agent, bounded tools
  - TruLens is subprocess (not additional agent)
  - No new subagent types introduced
  - Secret classifier is tool, not agent

- [x] **C9 User Agency**: User controls disclosure decisions
  - Secret detection is opt-out (--no-secrets)
  - Feedback collection is opt-in
  - Checkpoint retention is user-configurable

## Data Model Validation

- [x] All entities have unique identifiers
- [x] All timestamps use ISO-8601 format
- [x] Foreign key relationships defined (sessionId, recommendationId)
- [x] Nullable fields explicitly marked
- [x] Enums have exhaustive values
- [x] SQL schemas match TypeScript interfaces

## Interface Design

- [x] All interfaces follow I-prefix convention
- [x] Async methods return Promise
- [x] Error handling via return types (not exceptions in contracts)
- [x] Secrets never exposed in serializable interfaces
- [x] CLI options follow existing patterns (--flag, --key value)

## Security Considerations

- [x] SecretCandidate.match field marked @internal
- [x] Redaction format documented and implemented
- [x] Debug output redaction patterns defined
- [x] No secrets in checkpoint serialization
- [x] Entropy thresholds documented

## Testing Strategy

- [x] VCR pattern for LLM call tests
- [x] Golden dataset for evaluation
- [x] Unit tests for entropy calculation
- [x] Unit tests for redaction functions
- [x] Integration tests for session recording

## Integration Points

- [x] Extends existing checkpoint system (EP02)
- [x] Uses existing config patterns (~/.agentlint/config.json)
- [x] CLI flags follow existing conventions
- [x] SQLite storage matches existing persistence layer
- [x] TruLens subprocess pattern defined

## Documentation

- [x] All interfaces have JSDoc comments
- [x] Module headers describe purpose
- [x] Constants have documentation
- [x] Quickstart guide covers all features
- [x] Example usage for each major feature
