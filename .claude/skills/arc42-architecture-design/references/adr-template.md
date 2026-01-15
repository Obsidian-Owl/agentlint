# Architecture Decision Record (ADR) Template

Use ADRs to document significant architecture decisions in Arc42 Section 9.

## When to Write an ADR

Document decisions that are:
- **Expensive** to change later
- **Critical** to system quality
- **Risky** with uncertain outcomes
- **Impactful** across multiple components
- **Non-obvious** to future readers

## ADR Format

### Short Form (for simpler decisions)

```markdown
## ADR-[NUMBER]: [TITLE]

**Status**: [Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

**Context**: [1-2 sentences on why this decision was needed]

**Decision**: [What was decided]

**Consequences**: [Key trade-offs, both positive and negative]
```

### Full Form (for significant decisions)

```markdown
## ADR-[NUMBER]: [TITLE]

**Date**: [YYYY-MM-DD]

**Status**: [Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

**Deciders**: [Who made or will make this decision]

### Context

[Describe the situation that requires a decision. Include:
- The problem or need being addressed
- Relevant constraints (technical, organizational, time)
- Forces that influence the decision (quality requirements, stakeholder concerns)
- Any assumptions being made]

### Decision Drivers

- [Driver 1]: [Brief explanation]
- [Driver 2]: [Brief explanation]
- [Driver 3]: [Brief explanation]

### Considered Options

1. **[Option A]**: [Brief description]
2. **[Option B]**: [Brief description]
3. **[Option C]**: [Brief description]

### Decision

[State the chosen option and why]

We chose **[Option X]** because [primary reasons].

### Consequences

**Positive:**
- [Benefit 1]
- [Benefit 2]

**Negative:**
- [Drawback 1 and how we'll mitigate]
- [Drawback 2 and acceptable trade-off]

**Neutral:**
- [Effect that is neither good nor bad]

### Validation

[How will we know if this decision was right? What metrics or outcomes to watch?]

### Related Decisions

- [Link to related ADRs if applicable]
```

## Example ADRs

### Example 1: Technology Choice (Short Form)

```markdown
## ADR-001: Use PostgreSQL for Primary Database

**Status**: Accepted

**Context**: We need a relational database for transactional data with complex querying needs.

**Decision**: Use PostgreSQL 15 as the primary database.

**Consequences**: 
- Positive: Rich SQL features, excellent performance, strong community support
- Negative: Requires database expertise on team, more complex than managed alternatives
- Trade-off: Accepted operational overhead in exchange for flexibility and cost savings
```

### Example 2: Architecture Pattern (Full Form)

```markdown
## ADR-002: Adopt Event-Driven Architecture for Order Processing

**Date**: 2025-01-15

**Status**: Accepted

**Deciders**: Architecture team, Tech Lead

### Context

The order processing system handles 10K+ orders daily with complex fulfillment workflows. Current synchronous processing creates bottlenecks and tight coupling between services. We need to improve scalability and allow independent evolution of downstream systems.

### Decision Drivers

- **Scalability**: Must handle 10x growth in order volume
- **Resilience**: Partial system failures shouldn't block order processing
- **Flexibility**: New fulfillment partners should integrate easily
- **Auditability**: Full trace of order state changes required

### Considered Options

1. **Synchronous API calls**: Direct REST calls between services
2. **Event-driven with message queue**: Async events via message broker
3. **Saga pattern with orchestrator**: Central coordinator manages workflow

### Decision

We chose **Event-driven with message queue** because it best addresses scalability and resilience while maintaining auditability through event sourcing.

Implementation:
- Apache Kafka as message broker
- Events: `OrderCreated`, `OrderPaid`, `OrderShipped`, etc.
- Each service owns its events and subscribes to relevant others

### Consequences

**Positive:**
- Services scale independently
- Failure isolation—one service down doesn't block others
- Natural audit trail through event log
- Easy to add new consumers

**Negative:**
- Added complexity (eventual consistency, event schema management)
- Requires team training on event-driven patterns
- Debugging distributed flows more difficult

**Neutral:**
- Need to design event schemas carefully upfront
- Monitoring infrastructure required

### Validation

Success criteria:
- Order processing throughput increases 5x
- No cascade failures during partial outages
- New fulfillment partner integration in <2 weeks
```

### Example 3: Risk Mitigation Decision

```markdown
## ADR-003: Implement Circuit Breaker for External Payment API

**Status**: Accepted

**Context**: The external payment provider has occasional outages (2-3 per month, 5-15 min each). Currently, these cascade into our system causing widespread failures.

**Decision**: Implement circuit breaker pattern using Resilience4j for all payment API calls.

**Consequences**:
- Positive: Graceful degradation during outages, faster recovery
- Positive: Clear visibility into provider health
- Negative: Adds complexity to payment code path
- Neutral: Need to define fallback behavior (queue for retry vs immediate failure)
```

## ADR Lifecycle

```
Proposed → Accepted → [Deprecated | Superseded]
                           ↓
                      New ADR references old
```

- **Proposed**: Under discussion, not yet implemented
- **Accepted**: Decision made and being implemented
- **Deprecated**: No longer relevant (system changed)
- **Superseded**: Replaced by a newer decision (link to it)

## Tips

1. **Be concise**: ADRs should be readable in 2-3 minutes
2. **Include rejected options**: Future readers benefit from knowing what was considered
3. **Link to evidence**: Reference relevant benchmarks, research, or discussions
4. **Update status**: Keep ADRs current as decisions evolve
5. **Number sequentially**: ADR-001, ADR-002, etc. for easy reference
6. **Group by topic**: In large systems, prefix by area (AUTH-001, DATA-001)
