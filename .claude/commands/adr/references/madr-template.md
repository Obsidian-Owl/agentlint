# MADR 4.0 ADR Template

This template is based on [MADR (Markdown Any Decision Records) 4.0](https://adr.github.io/madr/) and aligned with [ARC42 Section 9](https://docs.arc42.org/section-9/) guidance.

---

## Template

Copy and fill in the sections below when creating a new ADR:

```markdown
---
status: accepted
date: {YYYY-MM-DD}
decision-makers: [{list of people involved in the decision}]
consulted: [{list of people consulted, optional}]
informed: [{list of people to be informed, optional}]
---

# ADR-{NNNN}: {Title}

## Context and Problem Statement

{Describe the context and problem in 2-3 sentences. What decision needs to be made? What forces or constraints are at play?}

## Decision Drivers

- {Decision driver 1, e.g., "Must align with Local-First principle"}
- {Decision driver 2, e.g., "Need to support session logs > 100MB"}
- {Decision driver 3, e.g., "Must work without internet connection"}

## Considered Options

1. {Option 1 - brief title}
2. {Option 2 - brief title}
3. {Option 3 - brief title}

## Decision Outcome

Chosen option: "{Option N}" because {main justification in 1-2 sentences}.

### Consequences

**Good:**
- {Positive consequence 1}
- {Positive consequence 2}

**Bad:**
- {Negative consequence or accepted trade-off 1}
- {Negative consequence or accepted trade-off 2}

**Neutral:**
- {Neutral observation, e.g., "Requires updating developer documentation"}

## Pros and Cons of Options

### Option 1: {Title}

{Brief description in 1-2 sentences}

- Good: {Pro 1}
- Good: {Pro 2}
- Neutral: {Neutral point}
- Bad: {Con 1}
- Bad: {Con 2}

### Option 2: {Title}

{Brief description in 1-2 sentences}

- Good: {Pro 1}
- Good: {Pro 2}
- Neutral: {Neutral point}
- Bad: {Con 1}
- Bad: {Con 2}

### Option 3: {Title}

{Brief description in 1-2 sentences}

- Good: {Pro 1}
- Bad: {Con 1}
- Bad: {Con 2}

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | {Yes/Partial/No} | {Brief explanation} |
| II. Improvement-Oriented | {Yes/Partial/No} | {Brief explanation} |
| III. Causal-First | {Yes/Partial/No} | {Brief explanation} |
| IV. Mixed-Methods | {Yes/Partial/No} | {Brief explanation} |
| V. Language-Agnostic | {Yes/Partial/No} | {Brief explanation} |
| VI. Tool-Agnostic | {Yes/Partial/No} | {Brief explanation} |
| VII. Intelligent Tooling | {Yes/Partial/No} | {Brief explanation} |
| VIII. Compounding Value | {Yes/Partial/No} | {Brief explanation} |

## More Information

### Related Documents
- Architecture Vision: [Section X](../agentlint-architecture-vision.md#section-x)
- Design Questions: [Section Y.Z](../design-questions.md#yz-topic)
- Related ADRs: [ADR-NNNN](./NNNN-title.md)

### Research Sources
- [{Source title 1}]({URL 1})
- [{Source title 2}]({URL 2})
- [{Source title 3}]({URL 3})

### Implementation Notes
{Optional: Any notes for implementation, migration steps, or follow-up actions}
```

---

## Section Guidance

### Status Values

| Status | Meaning |
|--------|---------|
| `proposed` | Under discussion, not yet decided |
| `accepted` | Decision made and approved |
| `deprecated` | No longer applies (context changed) |
| `superseded by ADR-NNNN` | Replaced by a newer decision |

### Context and Problem Statement

- Keep it concise (2-3 sentences)
- Explain the "why" - what triggered this decision?
- Include relevant constraints or forces

### Decision Drivers

- List the forces that influenced the decision
- Include both technical and non-technical factors
- Reference constitutional principles where relevant

### Considered Options

- Include at least 2 options (ideally 3-4)
- Each option should be distinct and viable
- Brief titles are sufficient here; details go in Pros/Cons section

### Decision Outcome

- State the chosen option clearly
- Explain the main reason in 1-2 sentences
- Focus on "why this option" not "why not others"

### Consequences

- **Good**: Benefits we gain
- **Bad**: Trade-offs we accept (be honest about downsides)
- **Neutral**: Changes that are neither good nor bad

### Pros and Cons

- Use consistent format: `Good:`, `Bad:`, `Neutral:`
- Be specific and factual
- Include evidence from research where available

### Constitution Compliance

- Check every option against all 8 principles
- Partial compliance should explain what's missing
- Non-compliance should be explicitly justified

### More Information

- Always cite research sources with URLs
- Link to related architecture documents
- Link to related ADRs (both prior and future)

---

## Examples

### Good Decision Driver Examples
- "Must support offline operation (Local-First principle)"
- "Session logs can exceed 100MB, requiring streaming or chunked processing"
- "Teams need to adopt quickly, so learning curve must be minimal"
- "Must integrate with existing CI/CD pipelines"

### Good Consequence Examples

**Good:**
- "Single binary distribution simplifies installation"
- "SQLite provides efficient historical queries without external dependencies"

**Bad:**
- "Requires users to install Bun runtime (not truly single binary)"
- "Learning curve for team members unfamiliar with Rust"

**Neutral:**
- "Will need to update deployment documentation"
- "Existing tests will need migration to new framework"

---

## Supersession

When superseding a prior ADR:

1. In the **new ADR**, add a note in Context:
   > This decision supersedes [ADR-NNNN](./NNNN-title.md) due to {reason}.

2. In the **old ADR**, update the frontmatter:
   ```yaml
   status: superseded by ADR-MMMM
   ```

3. In the **old ADR**, add a note at the top:
   > **Superseded**: This ADR has been superseded by [ADR-MMMM](./MMMM-title.md).
