# Epic Sizing Guidelines

When and how to split or merge epic candidates.

## Target Sizing

| Dimension | Target Range | Rationale |
|-----------|--------------|-----------|
| Duration | 4-8 weeks | Maintains momentum while delivering meaningful value |
| User Stories | 5-12 | Enough granularity for Speckit without overwhelming |
| Team Focus | 1 team | Avoids coordination overhead |
| MVP Clarity | Defined | Can validate hypothesis incrementally |

## When to Split

### Duration Exceeds 8 Weeks

**Indicators:**
- Building block has many responsibilities
- Multiple distinct user workflows
- Cross-cutting concerns mixed with business logic

**Split Strategies:**

**By User Persona:**
```
Large Epic: "User Management"
    ├── EP-A: "Admin User Management" (admin workflows)
    └── EP-B: "Self-Service User Profile" (end-user workflows)
```

**By Workflow Phase:**
```
Large Epic: "Order Processing"
    ├── EP-A: "Order Creation & Validation"
    ├── EP-B: "Payment Processing"
    └── EP-C: "Fulfilment & Shipping"
```

**By MVP Phases:**
```
Large Epic: "Reporting Dashboard"
    ├── EP-A: "Core Reporting MVP" (basic charts, single data source)
    ├── EP-B: "Advanced Analytics" (drill-down, comparisons)
    └── EP-C: "Export & Scheduling" (PDF export, scheduled reports)
```

**By Technical Layer:**
```
Large Epic: "Search Functionality"
    ├── EP-A: "Search Infrastructure" (indexing, query engine)
    └── EP-B: "Search UX" (UI, filters, results display)
```

### More Than 15 User Stories Expected

**Indicators:**
- Long list of acceptance criteria
- Multiple integration points
- Many edge cases to handle

**Action:** Review for natural boundaries, apply split strategies above.

### No Clear MVP Identifiable

**Indicators:**
- "All or nothing" thinking
- Can't demonstrate partial value
- Tightly coupled features

**Action:** Force MVP definition by asking:
- "What's the simplest version that proves the concept?"
- "What can we ship in 2 weeks that adds value?"
- "What would a walking skeleton look like?"

## When to Merge

### Duration Under 2 Weeks

**Indicators:**
- Single API endpoint
- Minor UI enhancement
- Configuration change

**Action:** Merge with related epic or promote to feature within existing epic.

### Fewer Than 3 User Stories

**Indicators:**
- Narrow scope
- Single responsibility
- Low complexity

**Merge Strategies:**

**Combine Related Enablers:**
```
Small Epics:
    - "Add logging" (1 week)
    - "Add metrics" (1 week)
    - "Add alerting" (1 week)

Merged Epic: "Observability Foundation" (4 weeks)
```

**Combine Sequential Steps:**
```
Small Epics:
    - "Database schema" (1 week)
    - "Repository layer" (1 week)
    - "API endpoints" (2 weeks)

Merged Epic: "Data Access Layer" (4 weeks)
```

### Tightly Coupled Components

**Indicators:**
- Can't test one without the other
- Shared data model
- Same team owns both

**Action:** Keep together to avoid coordination overhead.

## Sizing Estimation Techniques

### T-Shirt Sizing

| Size | Duration | Stories | Typical Scope |
|------|----------|---------|---------------|
| S | 2-3 weeks | 3-5 | Single component, clear scope |
| M | 4-6 weeks | 6-9 | Multiple components, some integration |
| L | 6-8 weeks | 10-12 | Complex domain, multiple integrations |
| XL | >8 weeks | >12 | **Split required** |

### Reference Comparison

Compare to completed epics:
- "This feels similar to EP-03 which took 5 weeks"
- "More complex than EP-02, less than EP-07"

### Uncertainty Adjustment

| Confidence | Adjustment |
|------------|------------|
| High (done similar before) | Estimate as-is |
| Medium (some unknowns) | Add 20-30% buffer |
| Low (new territory) | Add spike epic first, then re-estimate |

## WSJF Prioritisation

Calculate priority score:

```
Score = (Business Value + Time Criticality + Risk Reduction) / Size

Where:
  Business Value:    1-10 (stakeholder impact)
  Time Criticality:  1-10 (cost of delay)
  Risk Reduction:    1-10 (learning/de-risking value)
  Size:              1-10 (relative effort, 1=smallest)
```

### Example Calculation

| Epic | BV | TC | RR | Size | Score | Priority |
|------|----|----|----|----- |-------|----------|
| Foundation | 3 | 10 | 8 | 3 | 7.0 | P0 |
| Core Feature | 10 | 8 | 5 | 6 | 3.8 | P1 |
| Enhancement | 6 | 4 | 3 | 4 | 3.3 | P2 |
| Nice-to-Have | 4 | 2 | 2 | 4 | 2.0 | P3 |

### Priority Definitions

| Priority | Meaning | Typical Characteristics |
|----------|---------|------------------------|
| P0 | Critical | Blocks everything, high risk reduction |
| P1 | High | Core value delivery, time-sensitive |
| P2 | Medium | Important but can wait |
| P3 | Low | Nice to have, backlog candidate |