# Phase 3: Prompt Language Audit

**AGE-969**: Audit prompts for rigid vs guiding language  
**Date**: 2026-01-27  
**Status**: Complete

## Executive Summary

Audited 5 prompt files in `src/prompts/`. Found **mixed results** - the DETECTIVE_PERSONA is excellent (guiding), but the analysis-prompt.ts contains several rigid patterns that contradict Constitution Principle IV (Mixed-Methods with Agent Judgment).

**Overall Assessment**: Good foundation with specific areas needing refactoring.

---

## Audit Methodology

### Language Classification

| Category            | Indicators                                                     | Constitution Alignment         |
| ------------------- | -------------------------------------------------------------- | ------------------------------ |
| **Guiding**         | "Consider", "Typically", "May", "Patterns suggest"             | Aligned - agent reasons        |
| **Rigid**           | "MUST", "ALWAYS", "NEVER", "CRITICAL", numbered sequences      | Misaligned - mandates behavior |
| **Justified Rigid** | Rigid language with clear rationale (security, data integrity) | Acceptable with justification  |

### Files Audited

1. `analysis/analysis-prompt.ts` - Main analysis workflow
2. `components/persona/detective-persona.ts` - Personality definition
3. `subagents/session/session-analyst-prompt.ts` - Session analysis subagent
4. `subagents/act/generalized-prompt.ts` - Fallback ACT analyzer
5. `subagents/act/claude-code-prompt.ts` - Claude Code specialist

---

## Detailed Findings

### 1. analysis-prompt.ts

**Severity**: Medium - Contains multiple rigid patterns

#### Finding 1.1: Forced Sequential Pipeline (Lines 19-64)

```
Perform a comprehensive analysis following the DETECT → TRACE → UNDERSTAND → RECONCILE → RECOMMEND workflow:

### 1. DETECT: Discover Issues
- Use `discover_configs` to find all AI configuration files
- Use `parse_config` to analyze each configuration in detail
...
```

**Issue**: The DETECT→TRACE→UNDERSTAND→RECONCILE→RECOMMEND workflow is presented as a mandatory sequence. Constitution Principle IV explicitly calls this an anti-pattern:

> **Anti-pattern**: Forced sequential pipelines where every analysis must run every method regardless of relevance.

**Recommendation**: Reframe as guidance that the agent can adapt:

```
Consider the DETECT → TRACE → UNDERSTAND → RECONCILE → RECOMMEND workflow as a mental model.
Apply phases as relevant to your findings - not every analysis requires all phases.
```

#### Finding 1.2: Mandated Tool Sequences (Lines 24-27)

```
- Use `discover_configs` to find all AI configuration files
- Use `parse_config` to analyze each configuration in detail
- Use `analyze_hierarchy` to understand config precedence and conflicts
```

**Issue**: Dictates specific tool order. Constitution Principle VII states:

> The agent MUST choose freely between tool use and direct reasoning—no approach is privileged.

**Recommendation**: Present as available capabilities, not mandated steps:

```
Available tools for configuration analysis:
- `discover_configs`: Find AI configuration files in a directory
- `parse_config`: Parse and extract structure from a configuration file
- `analyze_hierarchy`: Understand configuration precedence and conflicts

Use whichever tools serve your investigation. Direct reasoning is equally valid.
```

#### Finding 1.3: "CRITICAL" Language (Lines 58, 305)

```
**CRITICAL: Follow the Review → Decide → Act protocol above for EVERY finding.**
```

**Issue**: "CRITICAL" with caps creates rigid mandate tone. While the protocol itself is valuable, the framing removes agent judgment.

**Recommendation**: Explain the _why_ instead of mandating:

```
The Review → Decide → Act protocol prevents recommendation duplication.
Consider this protocol before recording findings - it keeps the recommendation
table clean and actionable.
```

#### Finding 1.4: Rigid Interactive Mode Script (Lines 346-364)

```
For EACH significant finding, have a brief conversation with the user:

### 1. State your finding (2-3 sentences)
### 2. State your assessment
### 3. Ask for confirmation if creating new
### 4. Execute based on response
```

**Issue**: This is a script, not guidance. Contradicts natural conversation flow. Constitution's Collaborative Model states:

> The agent may ask questions to clarify intent, validate assumptions, or present options.

Note: "may", not "must follow steps 1-4".

**Recommendation**: See AGE-970 for detailed refactoring. Summary: replace with conversational guidance that explains user control and natural flow.

#### Finding 1.5: "ALWAYS" Without Justification (Line 257)

```
**ALWAYS use `WebSearch` to verify information that may change over time:**
```

**Issue**: Mandates WebSearch for every temporal fact. Reasonable guidance, but framing is rigid.

**Recommendation**: Add rationale:

```
Information about models, APIs, and versions changes frequently.
WebSearch helps verify current status before flagging potential issues.
```

### 2. detective-persona.ts

**Severity**: None - Excellent guiding language

**Assessment**: This file exemplifies good prompt design:

```typescript
traits: [
  'Observant detective with dry wit - notices things and comments wryly',
  'Professional but not stiff - occasional understated humor is welcome',
  'Concise and direct - 2-3 sentences max, no fluff',
  'Helpful - if there is something actionable, mention it',
],
antiPatterns: [
  'Do not use exclamation marks excessively',
  'Do not be overly enthusiastic or fake',
  ...
]
```

- Uses "Do not" (specific prohibition) rather than "NEVER" (absolute mandate)
- Traits are descriptive, not prescriptive
- Anti-patterns explain what to avoid without rigid enforcement
- Tone examples show, don't mandate

**No changes needed.**

### 3. session-analyst-prompt.ts

**Severity**: Low - Generally good with minor improvements

#### Finding 3.1: "Always start with" (Line 109)

```
1. **Always start with `get_session_timeline`** - understand intent and outcome
```

**Issue**: Prescribes starting point. Minor rigidity.

**Recommendation**: Reframe as default suggestion:

```
1. `get_session_timeline` provides a good starting point for understanding intent and outcome
```

#### Positive Patterns Noted:

The prompt does excellent things that should be preserved:

```
### Session Phases (YOUR INTERPRETATION)
Sessions typically flow through phases. YOU decide what phase based on tool patterns:
```

```
## IMPORTANT NOTES
1. **Interpret, don't just report** - Your value is in JUDGMENT, not repetition
```

```
## CONSTITUTION ALIGNMENT
Per Constitution Principle VII (Mixed-Methods with Agent Judgment):
- Tools give you DATA (counts, sequences, timestamps, signals)
- YOU provide JUDGMENT (phases, quality, recommendations)
```

This is exemplary - explicitly acknowledges that interpretation is the agent's job.

### 4. generalized-prompt.ts

**Severity**: Low - Good structure with minor issues

#### Finding 4.1: Step Numbers Imply Sequence (Lines 124-163)

```
### Step 1: Discovery
### Step 2: Classification
### Step 3: Content Analysis
### Step 4: Recommendations
```

**Issue**: Numbered steps suggest mandatory sequence.

**Recommendation**: Reframe as areas to consider:

```
### Areas to Cover

**Discovery**: What files exist?
**Classification**: What type of ACT is this?
**Content Analysis**: What's the quality?
**Recommendations**: What would help?

Address these in whatever order makes sense for the task.
```

#### Positive Patterns Noted:

```
**Quality Indicators:**
- Specific > Vague
- Actionable > Abstract
```

Good use of comparative guidance rather than mandates.

### 5. claude-code-prompt.ts

**Severity**: Low - Similar patterns to generalized-prompt.ts

#### Finding 5.1: "Always start with" (Line 114)

```
1. **Always start with `discover_configs`** to understand what files exist
```

Same issue as session-analyst-prompt.ts.

#### Finding 5.2: Numbered Analysis Steps (Lines 134-152)

```
### For Configuration Analysis
1. Discover all Claude Code files using `discover_configs`
2. For each config file found:
...
```

Same pattern as generalized-prompt.ts.

#### Positive Patterns Noted:

The "Common Issues to Check" section (lines 155-170) is well-structured as a reference checklist, not a mandate:

```
**Configuration Issues:**
- Missing CLAUDE.md (no project context)
- Overly permissive permissions (security risk)
```

This is guidance, not prescription.

---

## Summary of Refactoring Recommendations

### High Priority (AGE-970 Scope)

| Finding                 | Location                   | Recommendation                       |
| ----------------------- | -------------------------- | ------------------------------------ |
| Forced DTUUR pipeline   | analysis-prompt.ts:19-64   | Reframe as mental model              |
| Interactive mode script | analysis-prompt.ts:346-364 | Replace with conversational guidance |

### Medium Priority (This Issue)

| Finding                 | Location                  | Recommendation                    |
| ----------------------- | ------------------------- | --------------------------------- |
| Mandated tool sequences | analysis-prompt.ts:24-27  | Present as available capabilities |
| "CRITICAL" language     | analysis-prompt.ts:58,305 | Replace with rationale            |
| "ALWAYS" without reason | analysis-prompt.ts:257    | Add justification                 |

### Low Priority (Can Bundle with Other Work)

| Finding                 | Location            | Recommendation              |
| ----------------------- | ------------------- | --------------------------- |
| "Always start with"     | session-analyst:109 | Reframe as suggestion       |
| Numbered step sequences | generalized:124-163 | Reframe as "areas to cover" |
| "Always start with"     | claude-code:114     | Reframe as suggestion       |
| Numbered steps          | claude-code:134-152 | Reframe as areas            |

---

## Patterns to Preserve

These patterns are exemplary and should be used as templates:

1. **DETECTIVE_PERSONA structure** - Traits + Anti-patterns + Tone Examples
2. **"YOUR INTERPRETATION" sections** - Explicitly calls out agent judgment
3. **Constitution alignment notes** - References principles directly
4. **Comparative guidance** - "Specific > Vague" format
5. **Tool availability tables** - Describes capabilities without mandating use

---

## Next Steps

1. AGE-970 will refactor interactive mode instructions
2. AGE-971 will ensure non-interactive mode provides decision matrices instead of scripts
3. AGE-972 will document these principles in an ADR

**Validation Checklist for AGE-969:**

- [x] Audit document created
- [x] Each prompt reviewed
- [x] Refactoring recommendations documented
