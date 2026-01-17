# Data Model: Config Analysis Tools

> **Epic**: EP05
> **Created**: 2026-01-17
> **Author**: Claude

---

## Entity Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   ConfigFile    │────►│  ParsedConfig   │────►│ QualityAssess-  │
│                 │     │                 │     │     ment        │
│  • path         │     │  • ast          │     │  • score        │
│  • type         │     │  • frontmatter  │     │  • issues       │
│  • size         │     │  • metrics      │     │  • grade        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       ▼                       │
        │               ┌─────────────────┐             │
        │               │ ConfigMetrics   │             │
        │               │                 │             │
        │               │  • tokenCount   │             │
        │               │  • sections     │             │
        │               │  • codeBlocks   │             │
        │               └─────────────────┘             │
        ▼                                               │
┌─────────────────┐                                     │
│ ConfigHierarchy │◄────────────────────────────────────┘
│                 │
│  • global       │
│  • project      │
│  • local        │
└─────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────┐
│    Conflict     │     │     Skill       │
│                 │     │                 │
│  • files        │     │  • name         │
│  • description  │     │  • description  │
│  • severity     │     │  • allowedTools │
└─────────────────┘     └─────────────────┘
```

---

## Entities

### ConfigFile

A discovered configuration file in the filesystem.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| path | string | Yes | Absolute path to the file |
| relativePath | string | Yes | Path relative to project root |
| type | ConfigType | Yes | Type of configuration (claude-md, agents-md, etc.) |
| size | number | Yes | File size in bytes |
| lastModified | Date | Yes | Last modification timestamp |
| level | HierarchyLevel | Yes | Position in hierarchy (global, project, local) |
| actType | ACTType | Yes | AI Coding Tool type (claude-code, cursor, etc.) |

**Validation Rules**:
- path must be a valid filesystem path
- size must be non-negative
- type must be a valid ConfigType enum value

---

### ParsedConfig

Parsed configuration content with AST and metadata.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | ConfigFile | Yes | Source file metadata |
| ast | Root | Yes | mdast AST root node |
| frontmatter | Record<string, unknown> | No | Parsed YAML frontmatter |
| metrics | ConfigMetrics | Yes | Extracted metrics |
| sections | Section[] | Yes | Extracted sections with hierarchy |
| codeBlocks | CodeBlock[] | Yes | Extracted code blocks |
| warnings | ParseWarning[] | Yes | Parse warnings (may be empty) |
| raw | string | Yes | Original file content |

**Relationships**:
- `ConfigFile` --1:1--> `ParsedConfig`
- `ParsedConfig` --1:1--> `ConfigMetrics`

---

### ConfigMetrics

Quantitative signals extracted from configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| lineCount | number | Yes | Total lines in file |
| tokenEstimate | number | Yes | Estimated token count |
| sectionCount | number | Yes | Number of top-level sections |
| maxHeadingDepth | number | Yes | Deepest heading level (1-6) |
| codeBlockCount | number | Yes | Number of code blocks |
| codeBlockLanguages | string[] | Yes | Languages used in code blocks |
| emphasisMarkerCount | EmphasisCounts | Yes | Count of MUST, IMPORTANT, etc. |
| linkCount | number | Yes | Number of links |
| wordCount | number | Yes | Total word count |

**Validation Rules**:
- All counts must be non-negative
- maxHeadingDepth must be 1-6
- tokenEstimate should approximate lineCount * 4 (±50%)

---

### EmphasisCounts

Count of emphasis markers in configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| must | number | Yes | Count of "MUST" occurrences |
| important | number | Yes | Count of "IMPORTANT" occurrences |
| critical | number | Yes | Count of "CRITICAL" occurrences |
| never | number | Yes | Count of "NEVER" occurrences |
| always | number | Yes | Count of "ALWAYS" occurrences |
| total | number | Yes | Sum of all emphasis markers |

---

### Section

A logical section extracted from the configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Generated section ID |
| title | string | Yes | Section heading text |
| level | number | Yes | Heading level (1-6) |
| content | string | Yes | Section content (excluding children) |
| children | Section[] | Yes | Nested subsections |
| position | Position | Yes | Start/end position in source |
| lineCount | number | Yes | Lines in this section |

---

### CodeBlock

A fenced code block from the configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| language | string | No | Language identifier (e.g., "typescript") |
| content | string | Yes | Code content |
| position | Position | Yes | Start/end position in source |
| lineCount | number | Yes | Number of lines |
| meta | string | No | Additional meta string after language |

---

### Position

Source location information (mdast standard).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| start | Point | Yes | Start position |
| end | Point | Yes | End position |

### Point

A point in a source file.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| line | number | Yes | Line number (1-indexed) |
| column | number | Yes | Column number (1-indexed) |
| offset | number | No | Character offset from start |

---

### QualityAssessment

Quality evaluation result for a configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| score | number | Yes | Overall quality score (0-100) |
| grade | Grade | Yes | Letter grade (A-F) |
| dimensions | QualityDimensions | Yes | Per-dimension scores |
| issues | QualityIssue[] | Yes | Detected issues |
| recommendations | string[] | Yes | Improvement suggestions |
| assessedAt | Date | Yes | Assessment timestamp |

**Validation Rules**:
- score must be 0-100
- grade must map correctly to score ranges

---

### QualityDimensions

Per-dimension quality scores.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| structure | number | Yes | Structure quality (0-100) |
| size | number | Yes | Size appropriateness (0-100) |
| completeness | number | Yes | Recommended section coverage (0-100) |
| specificity | number | Yes | Project-specific vs generic (0-100) |
| antiPatternPenalty | number | Yes | Penalty points for anti-patterns |

---

### QualityIssue

A quality problem detected in the configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Issue identifier |
| type | IssueType | Yes | Category of issue |
| severity | IssueSeverity | Yes | Impact severity |
| message | string | Yes | Human-readable description |
| position | Position | No | Location in source |
| suggestion | string | Yes | How to fix |

---

### ConfigHierarchy

Configuration inheritance tree.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| global | ParsedConfig | No | Global config (~/.claude/CLAUDE.md) |
| project | ParsedConfig | No | Project root config |
| local | ParsedConfig[] | Yes | Nested/local configs |
| skills | Skill[] | Yes | Discovered skills |
| effectiveConfig | EffectiveConfig | Yes | Merged configuration |
| conflicts | Conflict[] | Yes | Detected conflicts |

**Relationships**:
- `ConfigFile` --N:1--> `ConfigHierarchy`
- `ConfigHierarchy` --1:N--> `Conflict`

---

### Conflict

A conflict between configurations at different levels.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Conflict identifier |
| type | ConflictType | Yes | Category of conflict |
| description | string | Yes | Human-readable description |
| files | ConfigFile[] | Yes | Files involved (min 2) |
| positions | Position[] | Yes | Locations of conflicting content |
| severity | ConflictSeverity | Yes | Impact severity |
| resolution | string | No | Suggested resolution |

---

### Skill

A parsed SKILL.md file.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| path | string | Yes | Path to SKILL.md |
| name | string | Yes | Skill name (from frontmatter) |
| description | string | Yes | When to invoke (from frontmatter) |
| allowedTools | string[] | No | Permitted tools |
| model | string | No | Specific model to use |
| userInvocable | boolean | Yes | Available in slash menu |
| disableModelInvocation | boolean | Yes | Block programmatic use |
| contentSections | Section[] | Yes | Markdown content sections |
| bundledFiles | BundledFile[] | Yes | Files in scripts/, references/, assets/ |
| warnings | ParseWarning[] | Yes | Validation warnings |

**Validation Rules**:
- name max 64 characters
- description max 200 characters
- Must have both name and description

---

### BundledFile

A file bundled with a skill.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| path | string | Yes | Relative path from skill directory |
| type | BundledFileType | Yes | Category (script, reference, asset) |
| size | number | Yes | File size in bytes |

---

### ParseWarning

A non-fatal issue encountered during parsing.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| code | WarningCode | Yes | Warning identifier |
| message | string | Yes | Human-readable message |
| position | Position | No | Location in source |
| recoverable | boolean | Yes | Was partial parsing possible |

---

## Enumerations

### ConfigType

```typescript
type ConfigType =
  | 'claude-md'        // CLAUDE.md
  | 'agents-md'        // AGENTS.md
  | 'claude-settings'  // .claude/settings.json
  | 'skill-md'         // SKILL.md
  | 'cursor-rules'     // .cursor/rules/*.mdc (future)
  | 'unknown';         // Unrecognized format
```

### ACTType

```typescript
type ACTType =
  | 'claude-code'      // Claude Code (primary)
  | 'agents-md'        // AGENTS.md standard
  | 'cursor'           // Cursor (future)
  | 'windsurf'         // Windsurf (future)
  | 'unknown';         // Unrecognized ACT
```

### HierarchyLevel

```typescript
type HierarchyLevel =
  | 'global'           // ~/.claude/
  | 'project'          // Project root
  | 'local';           // Nested directory
```

### Grade

```typescript
type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
```

### IssueType

```typescript
type IssueType =
  | 'anti-pattern'     // Known bad pattern
  | 'missing-section'  // Expected section not found
  | 'size-warning'     // Too large or too small
  | 'structure-issue'  // Malformed structure
  | 'stale-content';   // Potentially outdated
```

### IssueSeverity

```typescript
type IssueSeverity =
  | 'error'            // Must fix
  | 'warning'          // Should fix
  | 'info';            // Consider fixing
```

### ConflictType

```typescript
type ConflictType =
  | 'contradicting'    // Direct contradiction
  | 'overlapping'      // Redundant guidance
  | 'precedence';      // Unclear which takes priority
```

### ConflictSeverity

```typescript
type ConflictSeverity =
  | 'high'             // Will cause issues
  | 'medium'           // May cause confusion
  | 'low';             // Minor inconsistency
```

### BundledFileType

```typescript
type BundledFileType =
  | 'script'           // scripts/ directory
  | 'reference'        // references/ directory
  | 'asset';           // assets/ directory
```

### WarningCode

```typescript
type WarningCode =
  | 'INVALID_FRONTMATTER'
  | 'UNCLOSED_CODE_BLOCK'
  | 'MALFORMED_HEADING'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_YAML'
  | 'ENCODING_ISSUE'
  | 'PERMISSION_DENIED';
```

---

## State Transitions

### ParsedConfig Lifecycle

```
                    ┌─────────────┐
                    │  Discovered │
                    └──────┬──────┘
                           │ parse()
                           ▼
┌──────────────┐    ┌─────────────┐
│ Parse Failed │◄───│   Parsing   │
└──────────────┘    └──────┬──────┘
       │                   │ success
       │                   ▼
       │           ┌─────────────┐
       └──────────►│   Parsed    │
      partial      └──────┬──────┘
                          │ assess()
                          ▼
                   ┌─────────────┐
                   │  Assessed   │
                   └─────────────┘
```

---

## Indexes and Queries

### Primary Lookups

| Query | Index | Performance |
|-------|-------|-------------|
| Config by path | path (unique) | O(1) |
| Configs by type | type | O(n) |
| Configs by hierarchy level | level | O(n) |
| Skills by name | name | O(n) |

### Common Queries

1. **Get all Claude Code configs**: Filter by actType = 'claude-code'
2. **Get project hierarchy**: Filter by project root, sort by level
3. **Get skills with warnings**: Filter skills where warnings.length > 0
4. **Get configs with issues**: Filter where quality.issues.length > 0

---

## Integration with Orchestration Types

These entities integrate with EP02's type system:

| EP05 Entity | EP02 Type | Relationship |
|-------------|-----------|--------------|
| QualityIssue | Finding | QualityIssue maps to Finding with type='config_antipattern' |
| Position | Location | Position maps directly to Location |
| ParseWarning | Finding | Warnings can generate Findings with type='config_gap' |
| Conflict | Finding | Conflicts generate Findings with type='config_gap' |

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-17 | Claude | Initial data model |
