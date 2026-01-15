# Data Model: {{FEATURE_NAME}}

> **Epic**: {{EPIC_ID}}
> **Created**: {{DATE}}
> **Status**: Draft

---

## Overview

This document defines the data entities, relationships, and validation rules for {{FEATURE_NAME}}.

---

## Entities

### {{Entity Name}}

**Description**: [What this entity represents]

**Source**: [Which requirement/user story defines this]

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | string | Yes | - | Unique identifier |
| | | | | |

**Validation Rules**:
- [Rule 1 from requirements]
- [Rule 2 from requirements]

**Invariants**:
- [Condition that must always be true]

---

### {{Entity Name 2}}

**Description**: [What this entity represents]

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| | | | | |

---

## Relationships

```
┌─────────────┐         ┌─────────────┐
│  Entity A   │───1:N──▶│  Entity B   │
└─────────────┘         └─────────────┘
       │
       │ 1:1
       ▼
┌─────────────┐
│  Entity C   │
└─────────────┘
```

| From | Relationship | To | Description |
|------|--------------|----|--------------|
| Entity A | 1:N | Entity B | [What this relationship means] |
| Entity A | 1:1 | Entity C | [What this relationship means] |

---

## State Transitions

> If entities have lifecycle states, document them here

### {{Entity Name}} States

```
┌─────────┐    create    ┌────────────┐    process    ┌───────────┐
│ (start) │─────────────▶│  Pending   │──────────────▶│  Active   │
└─────────┘              └────────────┘               └───────────┘
                                │                           │
                                │ cancel                    │ complete
                                ▼                           ▼
                         ┌────────────┐              ┌───────────┐
                         │ Cancelled  │              │ Completed │
                         └────────────┘              └───────────┘
```

| State | Description | Allowed Transitions |
|-------|-------------|---------------------|
| Pending | Initial state after creation | Active, Cancelled |
| Active | Being processed | Completed |
| Completed | Successfully finished | (terminal) |
| Cancelled | Terminated before completion | (terminal) |

---

## Type Definitions

> TypeScript/language-specific type definitions

```typescript
// Core entity types
interface {{EntityName}} {
  id: string;
  // ... fields
}

// Enums
enum {{EntityName}}Status {
  Pending = 'pending',
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
}
```

---

## Database Schema

> If applicable - SQL or NoSQL schema definitions

```sql
-- Example SQL schema
CREATE TABLE {{entity_name}} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Indexes & Constraints

| Table | Index/Constraint | Type | Purpose |
|-------|------------------|------|---------|
| | | | |

---

## Migration Notes

> If modifying existing schema, document migration requirements

| Change | Migration Required | Strategy |
|--------|-------------------|----------|
| [Change description] | Yes/No | [How to migrate] |

---

## References

- **Spec Entities**: spec.md Section 4
- **Requirements**: [FR-XXX, NFR-XXX]
- **ADRs**: [Relevant ADRs]
