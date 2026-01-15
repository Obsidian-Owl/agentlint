# Arc42 Documentation Template

Complete template for generating Arc42 architecture documentation. Each section includes guidance on content, common pitfalls, and examples.

---

## 1. Introduction and Goals

### 1.1 Requirements Overview

**Purpose**: Brief description of functional requirements and driving forces.

**Content**:
- Short textual description of system purpose
- Key functional requirements (not exhaustive—link to detailed docs)
- Business goals the system supports

**Template**:
```markdown
### 1.1 Requirements Overview

[System Name] is a [type of system] that [primary purpose].

**Key Business Goals:**
- [Goal 1]
- [Goal 2]

**Core Functionality:**
- [Feature 1]: [brief description]
- [Feature 2]: [brief description]
- [Feature 3]: [brief description]

For detailed requirements, see [link to requirements document].
```

### 1.2 Quality Goals

**Purpose**: Top 3-5 quality goals that have highest priority for stakeholders.

**Critical**: These are ARCHITECTURE quality goals, not project goals.

**Template**:
```markdown
### 1.2 Quality Goals

| Priority | Quality Goal | Description |
|----------|--------------|-------------|
| 1 | [e.g., Performance] | [Specific, measurable target] |
| 2 | [e.g., Security] | [Specific requirement] |
| 3 | [e.g., Availability] | [Specific target, e.g., 99.9%] |
```

**Common ISO 25010 qualities**: Performance efficiency, Compatibility, Usability, Reliability, Security, Maintainability, Portability.

### 1.3 Stakeholders

**Purpose**: Identify all parties involved in or affected by the system.

**Template**:
```markdown
### 1.3 Stakeholders

| Role | Description | Expectations |
|------|-------------|--------------|
| [Role name] | [Who they are] | [What they need from architecture/docs] |
| End Users | [User description] | [User concerns] |
| Operations | [Ops team] | [Operational requirements] |
| Developers | [Dev team] | [Development concerns] |
```

---

## 2. Constraints

**Purpose**: Document anything that constrains design and implementation decisions.

### 2.1 Technical Constraints

```markdown
### 2.1 Technical Constraints

| Constraint | Rationale |
|------------|-----------|
| Must use [technology X] | [Corporate standard / existing investment / etc.] |
| Must run on [platform Y] | [Infrastructure requirement] |
| Must support [compatibility requirement] | [Business requirement] |
```

### 2.2 Organizational Constraints

```markdown
### 2.2 Organizational Constraints

| Constraint | Rationale |
|------------|-----------|
| [Team size/skills] | [Impact on architecture choices] |
| [Process requirement] | [Compliance/methodology need] |
| [Timeline] | [Impact on scope/quality trade-offs] |
```

### 2.3 Conventions

```markdown
### 2.3 Conventions

- **Coding Standards**: [Link or description]
- **Documentation**: [Standards followed]
- **Naming Conventions**: [Patterns used]
- **Architecture Patterns**: [Patterns mandated]
```

---

## 3. Context and Scope

### 3.1 Business Context

**Purpose**: Delimit the system from external communication partners.

**Required**: Diagram + table of external interfaces.

```markdown
### 3.1 Business Context

[Diagram: System as black box with external actors/systems]

**External Interfaces:**

| External Entity | Input to System | Output from System |
|-----------------|-----------------|-------------------|
| [User/System A] | [Data/requests] | [Data/responses] |
| [System B] | [Data/events] | [Data/notifications] |
```

### 3.2 Technical Context

**Purpose**: Technical details of the context (protocols, data formats).

```markdown
### 3.2 Technical Context

[Diagram: Technical infrastructure with channels/protocols]

**Channels:**

| Channel | Protocol | Data Format | Notes |
|---------|----------|-------------|-------|
| [Interface name] | REST/gRPC/etc. | JSON/Protobuf/etc. | [Auth, rate limits] |
```

---

## 4. Solution Strategy

**Purpose**: Summarize fundamental decisions and solution approaches.

**Keep compact**—details belong in other sections.

```markdown
## 4. Solution Strategy

| Quality Goal | Approach | Details |
|--------------|----------|---------|
| [Performance] | [Caching strategy, async processing] | See Section 8.x |
| [Scalability] | [Horizontal scaling, stateless design] | See Section 7 |
| [Security] | [Zero trust, OAuth 2.0] | See Section 8.x |

**Technology Decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Programming Language | [X] | [Reason] |
| Database | [Y] | [Reason] |
| Messaging | [Z] | [Reason] |

**Architecture Pattern**: [e.g., Microservices / Modular Monolith / Event-Driven]
- Rationale: [Why this pattern]
```

---

## 5. Building Block View

**Purpose**: Hierarchical decomposition of static structure.

### 5.1 Level 1: Overall System Whitebox

```markdown
### 5.1 Level 1 - System Overview

[Diagram: Top-level components and their relationships]

**Motivation**: [Why this decomposition]

**Contained Building Blocks:**

| Building Block | Responsibility |
|----------------|----------------|
| [Component A] | [What it does] |
| [Component B] | [What it does] |
| [Component C] | [What it does] |

**Important Interfaces:**

| Interface | Description |
|-----------|-------------|
| [Interface 1] | [Purpose and key operations] |
```

### 5.2 Level 2: Component Details

Only detail components that are complex, risky, or critical.

```markdown
### 5.2 Level 2 - [Component Name] Whitebox

[Diagram: Internal structure of component]

**Motivation**: [Why detailed documentation needed]

**Contained Building Blocks:**

| Building Block | Responsibility |
|----------------|----------------|
| [Sub-component 1] | [What it does] |
| [Sub-component 2] | [What it does] |
```

### Blackbox Template

Use for each building block:

```markdown
#### [Component Name]

**Responsibility**: [What this component does—one paragraph max]

**Interfaces**:
- Input: [Data/commands received]
- Output: [Data/events produced]

**Quality/Performance**: [Any specific characteristics]

**Fulfilled Requirements**: [Which requirements this addresses]
```

---

## 6. Runtime View

**Purpose**: Document important runtime scenarios.

**Focus on**: Primary use cases, critical paths, error handling.

### Scenario Template

```markdown
### 6.x [Scenario Name]

**Trigger**: [What initiates this scenario]

**Actors/Components**: [Building blocks involved]

[Sequence diagram or step-by-step description]

1. [Actor A] sends [request] to [Component B]
2. [Component B] validates [data]
3. [Component B] calls [Component C] for [action]
4. [Component C] returns [result]
5. [Component B] responds to [Actor A]

**Error Handling**: [What happens on failure]
```

---

## 7. Deployment View

**Purpose**: Map software to infrastructure.

### 7.1 Infrastructure Level 1

```markdown
### 7.1 Infrastructure Overview

[Deployment diagram showing nodes and mapping]

**Infrastructure Elements:**

| Node | Description | Hosted Components |
|------|-------------|-------------------|
| [Server/Container 1] | [Specs, location] | [Components deployed here] |
| [Database Server] | [Type, specs] | [Data stored] |
| [Load Balancer] | [Type] | [Traffic routing] |

**Quality/Performance Characteristics:**
- [Scalability approach]
- [Redundancy configuration]
- [Network topology notes]
```

### 7.2 Infrastructure Level 2 (Optional)

Detail specific nodes if needed.

---

## 8. Crosscutting Concepts

**Purpose**: Document patterns and approaches that apply across multiple building blocks.

### Concept Categories

Select relevant categories for your system:

```markdown
## 8. Crosscutting Concepts

### 8.1 Domain Model

[Domain entities and relationships—UML class diagram or description]

### 8.2 Security Concept

**Authentication**: [Approach]
**Authorization**: [Approach]
**Data Protection**: [Encryption, masking]

### 8.3 Logging and Monitoring

**Log Format**: [Structure]
**Log Levels**: [When to use each]
**Correlation**: [How to trace requests]
**Metrics**: [What is measured]

### 8.4 Error Handling

**Error Categories**: [Classification]
**Response Format**: [Standard error structure]
**Retry Strategy**: [When and how to retry]

### 8.5 Configuration Management

**Sources**: [Where config comes from]
**Secrets**: [How secrets are managed]
**Environment-Specific**: [How envs differ]

### 8.6 Testing Strategy

**Unit Testing**: [Approach, coverage targets]
**Integration Testing**: [Approach]
**E2E Testing**: [Approach]
```

---

## 9. Architecture Decisions

**Purpose**: Document important, expensive, critical, or risky decisions.

Use ADR (Architecture Decision Record) format. See [adr-template.md](adr-template.md).

```markdown
## 9. Architecture Decisions

### ADR-001: [Decision Title]

**Status**: [Proposed | Accepted | Deprecated | Superseded]

**Context**: [Why this decision was needed]

**Decision**: [What was decided]

**Consequences**: 
- Positive: [Benefits]
- Negative: [Trade-offs]
- Neutral: [Other effects]

---

### ADR-002: [Next Decision]
...
```

---

## 10. Quality Requirements

### 10.1 Quality Tree

```markdown
### 10.1 Quality Tree

```
Quality
├── Performance
│   ├── Response Time (<200ms p95)
│   └── Throughput (>1000 req/s)
├── Reliability
│   ├── Availability (99.9%)
│   └── Fault Tolerance
├── Security
│   ├── Authentication
│   └── Data Protection
└── Maintainability
    ├── Modularity
    └── Testability
```
```

### 10.2 Quality Scenarios

```markdown
### 10.2 Quality Scenarios

| ID | Quality | Scenario | Response | Measure |
|----|---------|----------|----------|---------|
| QS-1 | Performance | User submits search query | Results displayed | <200ms for 95th percentile |
| QS-2 | Availability | Primary database fails | Automatic failover | <30 seconds recovery |
| QS-3 | Security | Unauthorized access attempt | Request blocked, logged | 100% detection |
```

See [quality-scenarios.md](quality-scenarios.md) for detailed scenario format.

---

## 11. Risks and Technical Debt

```markdown
## 11. Risks and Technical Debt

### 11.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| [Risk 1] | High/Medium/Low | [Description] | [Planned action] |

### 11.2 Technical Debt

| Item | Description | Priority | Plan |
|------|-------------|----------|------|
| [Debt 1] | [What and why] | High/Medium/Low | [When/how to address] |
```

---

## 12. Glossary

```markdown
## 12. Glossary

| Term | Definition |
|------|------------|
| [Term 1] | [Clear, concise definition] |
| [Term 2] | [Definition] |
| [Acronym] | [Full form and explanation] |
```

**Best Practices**:
- Include both business domain and technical terms
- Keep definitions concise but unambiguous
- Include acronyms used anywhere in documentation
- Update as new terms emerge

---

## Documentation Tips

### What to Include
- Information not obvious from reading code
- Decisions and their rationale
- Context that new team members need
- Integration points and contracts

### What to Skip
- Implementation details easily found in code
- Obvious technical concepts
- Sections with nothing relevant to say (mark as "N/A" with brief reason)

### Maintenance
- Review quarterly or after major changes
- Link to code/configs where possible (avoid duplication)
- Date significant updates
