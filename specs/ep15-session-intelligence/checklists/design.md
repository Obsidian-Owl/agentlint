# Design Checklist: EP15 Session Intelligence

> Quality validation for implementation plan

## Architecture Compliance

- [x] Follows 6-layer architecture (CLI → Orchestration → Tools → ACT → Persistence → Integration)
- [x] Subagent design per established patterns (temporal-analyzer, recommendation-advisor)
- [x] Tool definitions use SDK `tool()` with Zod schemas
- [x] Database extends existing sessions.db per ADR-0006
- [x] No external dependencies added (uses existing stack)

## Constitution Compliance

- [x] I. Local-First: All analysis on user's machine
- [x] II. Improvement-Oriented: Session understanding enables learning
- [x] III. Causal-First: Events traced to source file:line
- [x] IV. Mixed-Methods: Quantitative + qualitative analysis
- [x] V. Language-Agnostic: Session analysis independent of project language
- [x] VI. Agent-Agnostic: MCP prefix parsing configurable
- [x] VII. Intelligent Tooling: Tools return data, subagent provides judgment
- [x] VIII. Compounding Value: Session narratives enable pattern learning
- [x] IX. Agent-Aware: Subagent with incremental data access

## Tool/Agent Boundary (Critical)

- [x] Tools return counts, sequences, timestamps, patterns
- [x] Tools do NOT return: phase labels, quality judgments, recommendations
- [x] No hardcoded thresholds in tools (agent decides meaning)
- [x] Agent reasoning section in contracts/interfaces.ts documents boundary
- [x] Subagent has NO Task tool (depth=1 constraint)

## Data Model

- [x] All entities defined with field types and required flags
- [x] Relationships documented
- [x] Validation rules specified
- [x] Query patterns documented
- [x] Indexes defined for common access patterns

## API Contracts

- [x] All tool inputs have Zod schemas
- [x] All tool outputs have TypeScript interfaces
- [x] _rawData pattern documented for structured data
- [x] Pagination parameters defined (limit, offset)

## Existing Code Reuse

- [x] Parser extension strategy documented
- [x] Indexer extension strategy documented
- [x] Tool registration pattern matches existing tools
- [x] Subagent pattern matches temporal/recommendations modules

## Performance Considerations

- [x] NFR targets documented (indexing, query, memory, context)
- [x] Incremental analysis pattern prevents context overflow
- [x] Pagination limits prevent large result sets
- [x] Stream processing for memory efficiency

## Testing Strategy

- [x] Unit tests for extraction functions
- [x] Unit tests for query functions
- [x] Integration tests for tools
- [x] Integration tests for CLI
- [x] No evaluation tests (subagent reasoning tested separately)

## Implementation Phases

- [x] Phases are logically ordered (foundation → features → integration)
- [x] Each phase has clear deliverables
- [x] Dependencies between phases documented
- [x] P1 requirements in early phases, P2 in later phases

## Validation Status

| Check | Status |
|-------|--------|
| Architecture | Pass |
| Constitution | Pass |
| Tool/Agent Boundary | Pass |
| Data Model | Pass |
| API Contracts | Pass |
| Code Reuse | Pass |
| Performance | Pass |
| Testing | Pass |
| Phases | Pass |

**Overall Status**: Ready for task generation

---

## Open Items

None. Design is complete and ready for `/dev.tasks`.
