# Data Model: Recommendation Advisor

> **Epic**: EP10
> **Created**: 2026-01-20

---

## Entities

### Recommendation

The core entity - a living document tracking a suggested improvement.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID v4) | Yes | Unique identifier |
| `projectPath` | string | Yes | Project root path |
| `createdAt` | string (ISO 8601) | Yes | Creation timestamp |
| `type` | RecommendationType | Yes | symptomatic, preventive, systemic |
| `action` | string | Yes | SPECIFIC change to make |
| `target` | string | Yes | WHERE to make the change |
| `rationale` | string | Yes | WHY this will help (agent reasoning) |
| `priority` | Priority | Yes | high, medium, low |
| `tracedOrigin` | TracedOrigin | Yes | Causal link to source |
| `status` | RecommendationStatus | Yes | Current lifecycle state |
| `events` | RecommendationEvent[] | Yes | Append-only history |
| `completedAt` | string (ISO 8601) | No | When case was closed |
| `completionReason` | CompletionReason | No | Why case was closed |
| `supersededBy` | string (UUID) | No | ID of replacement recommendation |

**Validation Rules**:
- `action` must be specific and actionable (not vague like "improve error handling")
- `target` should reference a file path, config section, or specific location
- `tracedOrigin` must have at least one non-null field
- `events` must contain at least one event (type: 'created')

**State Transitions**:
```
open → pending_confirmation (implementation detected)
open → implemented (user confirms without detection)
pending_confirmation → implemented (user confirms)
pending_confirmation → open (false positive)
implemented → monitoring (tracking effectiveness)
monitoring → completed (case closed)
open → completed (superseded, obsolete, rejected)
```

---

### RecommendationEvent

An append-only log entry tracking the recommendation's evolution.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID v4) | Yes | Unique event identifier |
| `timestamp` | string (ISO 8601) | Yes | When event occurred |
| `type` | EventType | Yes | Event category |
| `content` | string (max 200 chars) | Yes | Succinct description |
| `baselineId` | string (UUID) | No | Related baseline |
| `sessionId` | string | No | Related session |
| `commitHash` | string | No | Related git commit |

**Validation Rules**:
- `content` must be ≤ 200 characters (enforced)
- `content` should be succinct and informative
- At least `type` and `content` are always required

**Event Types**:

| Type | When Used |
|------|-----------|
| `created` | Initial recommendation creation |
| `observation` | Agent noticed something relevant |
| `refinement` | Action/target/priority changed |
| `user_feedback` | User provided input |
| `evidence` | Supporting evidence accumulated |
| `implementation_signal` | Detected possible implementation |
| `status_change` | Status transition |
| `completed` | Case closed |

---

### RecommendationSummary

Compressed view for context loading (derived from Recommendation).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID v4) | Yes | Reference to full recommendation |
| `type` | RecommendationType | Yes | symptomatic, preventive, systemic |
| `status` | RecommendationStatus | Yes | Current state |
| `actionSummary` | string (max 100 chars) | Yes | Truncated action |
| `target` | string | Yes | WHERE to make the change |
| `priority` | Priority | Yes | high, medium, low |
| `eventCount` | number | Yes | Total events in case |
| `lastEventAt` | string (ISO 8601) | Yes | Most recent event timestamp |
| `lastEventType` | EventType | Yes | Most recent event type |
| `recentActivity` | string | Yes | Rolling summary of activity |
| `milestones` | Milestones | Yes | Key lifecycle dates |

**Validation Rules**:
- `actionSummary` truncated at 100 characters with "..." suffix
- `recentActivity` format depends on event count (see compression rules)
- Total summary size should be < 500 characters

**Compression Rules**:
- ≤3 events: Include all events verbatim
- 4-10 events: Last 3 verbatim, "[+N earlier events]" prefix
- >10 events: "[Events summarized - use get_recommendation for full history]"

---

### TracedOrigin

Causal link connecting recommendation to its source (Constitution III).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `findingId` | string | No | EP05/EP06/EP07 finding ID |
| `sessionId` | string | No | Session that exhibited issue |
| `configGap` | string | No | Description of config gap |
| `pattern` | string | No | Recurring pattern identified |

**Validation Rules**:
- At least one field must be non-null
- `findingId` should be a valid UUID if provided
- `configGap` should be concise (recommendation detail goes in `rationale`)

---

### Milestones

Key lifecycle dates for summary view.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created` | string (ISO 8601) | Yes | When recommendation was created |
| `firstEvidence` | string (ISO 8601) | No | When first evidence was added |
| `implemented` | string (ISO 8601) | No | When implementation was confirmed |
| `completed` | string (ISO 8601) | No | When case was closed |

---

### ClarifyingQuestion

Structured question for collaborative interaction (subagent → orchestrator → user).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | Yes | The question to ask |
| `options` | QuestionOption[] | No | Multiple choice options |
| `context` | string | Yes | Why this question matters |
| `defaultAnswer` | string | No | Suggested answer if user declines |

---

### QuestionOption

Option for multiple-choice clarifying questions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Short option label |
| `description` | string | Yes | Explanation of this option |

---

## Type Definitions

```typescript
// =============================================================================
// Enums / Union Types
// =============================================================================

type RecommendationType = 'symptomatic' | 'preventive' | 'systemic';

type RecommendationStatus =
  | 'open'                  // Active recommendation
  | 'pending_confirmation'  // Implementation detected, awaiting confirm
  | 'implemented'           // Confirmed implemented
  | 'monitoring';           // Tracking effectiveness

type CompletionReason =
  | 'implemented'   // Recommendation was applied
  | 'superseded'    // Better recommendation replaced this
  | 'obsolete'      // Changes made this irrelevant
  | 'rejected';     // User decided not to implement

type EventType =
  | 'created'
  | 'observation'
  | 'refinement'
  | 'user_feedback'
  | 'evidence'
  | 'implementation_signal'
  | 'status_change'
  | 'completed';

type Priority = 'high' | 'medium' | 'low';

// =============================================================================
// Core Entities
// =============================================================================

interface TracedOrigin {
  findingId?: string;
  sessionId?: string;
  configGap?: string;
  pattern?: string;
}

interface RecommendationEvent {
  id: string;
  timestamp: string;
  type: EventType;
  content: string;
  baselineId?: string;
  sessionId?: string;
  commitHash?: string;
}

interface Recommendation {
  id: string;
  projectPath: string;
  createdAt: string;
  type: RecommendationType;
  action: string;
  target: string;
  rationale: string;
  priority: Priority;
  tracedOrigin: TracedOrigin;
  status: RecommendationStatus;
  events: RecommendationEvent[];
  completedAt?: string;
  completionReason?: CompletionReason;
  supersededBy?: string;
}

// =============================================================================
// Derived / Summary Types
// =============================================================================

interface Milestones {
  created: string;
  firstEvidence?: string;
  implemented?: string;
  completed?: string;
}

interface RecommendationSummary {
  id: string;
  type: RecommendationType;
  status: RecommendationStatus;
  actionSummary: string;
  target: string;
  priority: Priority;
  eventCount: number;
  lastEventAt: string;
  lastEventType: EventType;
  recentActivity: string;
  milestones: Milestones;
}

// =============================================================================
// Interaction Types
// =============================================================================

interface QuestionOption {
  label: string;
  description: string;
}

interface ClarifyingQuestion {
  question: string;
  options?: QuestionOption[];
  context: string;
  defaultAnswer?: string;
}

interface AdvisorOutput {
  recommendations: Recommendation[];
  clarifyingQuestions?: ClarifyingQuestion[];
  assumptions?: string[];
}

// =============================================================================
// Storage Types
// =============================================================================

interface RecommendationFile {
  version: string;
  recommendation: Recommendation;
}

// =============================================================================
// Tool Input/Output Types
// =============================================================================

interface CreateRecommendationInput {
  type: RecommendationType;
  action: string;
  target: string;
  rationale: string;
  priority: Priority;
  tracedOrigin: TracedOrigin;
}

interface AddEventInput {
  recommendationId: string;
  type: EventType;
  content: string;
  baselineId?: string;
  sessionId?: string;
  commitHash?: string;
}

interface ListRecommendationsInput {
  status?: RecommendationStatus;
  type?: RecommendationType;
  priority?: Priority;
  limit?: number;
}

interface RefineRecommendationInput {
  recommendationId: string;
  action?: string;
  target?: string;
  priority?: Priority;
}

interface CompleteRecommendationInput {
  recommendationId: string;
  reason: CompletionReason;
  supersededBy?: string;
}
```

---

## Entity Relationships

```
Recommendation --1:N--> RecommendationEvent
     │
     └--1:1--> TracedOrigin
     │
     └--0:1--> Recommendation (supersededBy)

RecommendationSummary --derived-from--> Recommendation

AdvisorOutput --contains--> Recommendation[]
             --contains--> ClarifyingQuestion[]
```

---

## Indexes / Query Patterns

For file-based storage, common query patterns:

| Query | Implementation |
|-------|----------------|
| List all recommendations | `glob('.agentlint/recommendations/*.json')` |
| Filter by status | Load all, filter in memory |
| Filter by type | Load all, filter in memory |
| Get by ID | Direct file lookup |
| Newest-first ordering | Sort by `createdAt` descending |

**Note**: For MVP, in-memory filtering is acceptable. If query performance becomes an issue, consider adding SQLite indexer (like baselines/reviews).

---

## Migration from EP09 RecommendationTracking

| Source Field | Migration |
|--------------|-----------|
| `id` | Generate new UUID for Recommendation |
| `recommendationId` | Store in `tracedOrigin.findingId` if applicable |
| `recommendationText` | Split into `action` (first sentence) + `rationale` (rest) |
| `status` | Map to new status (see table below) |
| `detectedAt` | Create `created` event with this timestamp |
| `confirmedAt` | Create `status_change` event if applicable |
| `preBaselineId` | Create `evidence` event with this baselineId |
| `postBaselineId` | Create `evidence` event with this baselineId |
| `effectivenessScore` | Create `evidence` event with score in content |
| `notes` | Create `user_feedback` event |

**Status Mapping**:

| EP09 Status | EP10 Status | Notes |
|-------------|-------------|-------|
| `pending` | `open` | |
| `detected_pending_confirm` | `pending_confirmation` | |
| `implemented` | `implemented` | |
| `partial` | `open` | Add observation event noting partial |
| `rejected` | `open` + completed | Complete with reason='rejected' |
| `ineffective` | `monitoring` | Add evidence event noting ineffective |
