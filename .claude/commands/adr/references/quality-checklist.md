# ADR Quality Checklist

Use this checklist to verify an ADR meets quality standards before finalizing.

---

## Pre-Submission Checklist

### Research Quality
- [ ] **3+ web searches** conducted with distinct queries
- [ ] **Sources cited** in More Information section with URLs
- [ ] **Best practices** researched for the topic
- [ ] **Recent information** included (2024-2026)
- [ ] **Codebase analyzed** if implementation exists

### Options Analysis
- [ ] **2+ options** considered (ideally 3-4)
- [ ] Each option is **distinct** (not minor variations)
- [ ] Each option is **viable** (could actually be implemented)
- [ ] **Pros documented** for each option
- [ ] **Cons documented** for each option
- [ ] **Trade-offs** clearly stated

### Decision Quality
- [ ] **Decision drivers** explicitly listed
- [ ] **Recommendation** provided with reasoning
- [ ] **User approved** the final decision
- [ ] **Justification** explains why chosen option is best

### Consequences
- [ ] **Positive consequences** documented
- [ ] **Negative consequences** documented (be honest about downsides)
- [ ] **Neutral consequences** documented where relevant
- [ ] **Trade-offs acknowledged** explicitly

### Constitution Compliance
- [ ] All **8 principles** checked for chosen option
- [ ] **Violations flagged** and justified if any
- [ ] **Tensions noted** if option partially complies

### Documentation Quality
- [ ] **Context** explains why decision is needed (2-3 sentences)
- [ ] **Links to related ADRs** included
- [ ] **Links to architecture docs** included
- [ ] **Implementation notes** added if needed

### Process Compliance
- [ ] **Numbering script used** (`scripts/create-adr.sh`)
- [ ] **Decision log updated** in design-questions.md Section 11
- [ ] **Supersession handled** if replacing prior ADR

---

## Constitution Compliance Matrix

For each option, verify against these 8 principles:

| # | Principle | Question to Ask |
|---|-----------|-----------------|
| I | **Local-First** | Does all analysis run on the user's machine? Is data kept local unless explicitly shared? |
| II | **Improvement-Oriented** | Does this support the continuous improvement cycle? Does value compound over time? |
| III | **Causal-First** | Does this enable tracing issues to their origin? Does it support preventive recommendations? |
| IV | **Mixed-Methods** | Does this support both quantitative and qualitative signals? |
| V | **Language-Agnostic** | Does this work across programming languages? Does it degrade gracefully for unsupported languages? |
| VI | **Tool-Agnostic** | Does this support multiple AI assistants via adapter pattern? |
| VII | **Intelligent Tooling** | Are tools selected based on task needs? Does agent have flexibility to choose approach? |
| VIII | **Compounding Value** | Does value compound over time? Do baselines and historical context enhance recommendations? |

### Compliance Rating

| Rating | Meaning |
|--------|---------|
| **Yes** | Fully complies with the principle |
| **Partial** | Partially complies; explain gaps |
| **No** | Does not comply; must justify why |
| **N/A** | Principle doesn't apply to this decision |

---

## Common Issues to Avoid

### Research Issues
- **Shallow research**: Only 1-2 searches, missing best practices
- **Outdated sources**: Using information from 2022 or earlier
- **Missing comparisons**: Not researching alternative approaches
- **No citations**: Sources not included in ADR

### Options Issues
- **Single option**: Only presenting one choice (not a real decision)
- **Straw man options**: Including obviously bad options to make one look good
- **Missing trade-offs**: Only listing pros, hiding cons
- **Vague descriptions**: Options not concrete enough to implement

### Decision Issues
- **No user validation**: Deciding without consulting CTO (user)
- **Unclear justification**: "Just because" or "seems right"
- **Ignoring constraints**: Not considering constitutional principles
- **Missing consequences**: Not thinking through implications

### Process Issues
- **Manual numbering**: Not using the create-adr.sh script
- **Skipped decision log**: Not updating design-questions.md
- **Broken links**: References to non-existent files
- **Missing supersession**: Replacing an ADR without updating status

---

## Quick Reference: Required Sections

Every ADR must have:

```
1. Frontmatter (status, date, decision-makers)
2. Title (ADR-NNNN: Descriptive Title)
3. Context and Problem Statement
4. Decision Drivers
5. Considered Options (2+ options)
6. Decision Outcome (chosen option + justification)
7. Consequences (good/bad/neutral)
8. Pros and Cons of Options
9. Constitution Compliance (8 principles)
10. More Information (sources, related docs)
```

---

## Validation Commands

Before finalizing, verify:

```bash
# Check ADR numbering is correct
ls -la docs/architecture/adr/

# Verify decision log was updated
grep -n "Decision" docs/design-questions.md | tail -5

# Check for broken links (if you have a link checker)
# markdown-link-check docs/architecture/adr/NNNN-title.md
```
