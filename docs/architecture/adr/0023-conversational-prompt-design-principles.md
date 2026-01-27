---
status: accepted
date: 2026-01-27
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0023: Conversational Prompt Design Principles

## Context and Problem Statement

agentlint prompts evolved organically, resulting in mixed quality:

- **DETECTIVE_PERSONA** (excellent): Uses guiding language, describes traits rather than mandating behavior
- **analysis-prompt.ts** (problematic): Rigid 4-step scripts, mandated sequences, "CRITICAL" language

Phase 3 audit (AGE-969) identified anti-patterns contradicting Constitution Principle IV (Mixed-Methods with Agent Judgment) and Principle VII (Intelligent Tooling).

Key insight from Anthropic's guidance:

> "Think of Claude as a brilliant but very new employee (with amnesia) who needs explicit instructions."

The emphasis is on _explicit instructions_, not _rigid scripts_. Guide the agent's reasoning; don't constrain it.

## Decision Drivers

- **Constitution Principle IV**: Agent decides which analysis methods to apply
- **Constitution Principle VII**: Agent chooses freely between tools and direct reasoning
- **User Control**: Interactive mode must support natural conversation flow
- **CI Reliability**: Non-interactive mode must never hang waiting for input

## Decision Outcome

Establish five Conversational Prompt Design Principles for all agentlint prompts.

### Principle 1: Guide, Don't Mandate

**Do**: Provide context, explain the "why", describe available capabilities

```markdown
The Review → Decide → Act protocol prevents recommendation duplication.
Consider this protocol before recording findings.
```

**Don't**: Use absolute mandates without justification

```markdown
**CRITICAL: Follow the Review → Decide → Act protocol above for EVERY finding.**
```

**Rationale**: The agent should understand _why_ a pattern exists, enabling it to adapt when circumstances warrant.

### Principle 2: User Control Paramount

**Interactive mode principle**: The user controls the conversation flow. Interruption is natural, not error.

**Do**: Describe the user's control

```markdown
**User control**:

- They can interrupt at any point to ask questions
- They can skip findings they're not interested in
- They decide whether to create recommendations
- They can end the analysis whenever they want
```

**Don't**: Script a rigid sequence

```markdown
### 1. State your finding

### 2. State your assessment

### 3. Ask for confirmation

### 4. Execute based on response
```

**Rationale**: Constitution's Collaborative Model states the agent "_may_ ask questions"—not "must follow steps 1-4".

### Principle 3: Mode-Aware Design

**Interactive mode**: Conversational principles, user decides what to act on

**Non-interactive mode**: Decision matrices, autonomous completion, structured output

| Mode            | Design Approach                  | Example                                    |
| --------------- | -------------------------------- | ------------------------------------------ |
| Interactive     | Principles: "Be direct, respond" | "Let them decide: Want me to record this?" |
| Non-interactive | Matrix: "If X, do Y"             | "Ambiguous issue → Document both sides"    |

**Implementation** (from analysis-prompt.ts):

```typescript
// Interactive: Conversational principles
return `## Interactive Mode

You're having a conversation with a developer about their project. They control the flow.

**Your role**: Share findings, offer insights, answer questions. The developer decides what to act on.
...`;

// Non-interactive: Decision framework
return `## Non-Interactive Mode (CI/Automation)

You're running autonomously. Complete the analysis without user input.

**Decision Framework**:

| Situation | Action |
|-----------|--------|
| Clear issue, no existing recommendation | Create new recommendation |
| Issue matches existing recommendation | Add observation to existing |
...`;
```

### Principle 4: Constraints from Reality

Every "NEVER" or hard constraint must come from an actual bug, failure, or user complaint—not theoretical concerns.

**Justified constraints** (documented incidents):

```markdown
Do not create duplicate recommendations—consolidate instead.
(Rationale: AGE-678 found 15 redundant "expand CLAUDE.md" recommendations)
```

**Unjustified constraints** (theoretical):

```markdown
**CRITICAL**: Always verify model names before flagging issues.
(No documented incident of false flagging)
```

### Principle 5: Describe Capabilities, Don't Prescribe Sequences

**Do**: Present tools as available capabilities

```markdown
**Available tools for configuration analysis**:

- `discover_configs`: Find AI configuration files in a directory
- `parse_config`: Parse and extract structure from a configuration file

Use whichever tools serve your investigation.
```

**Don't**: Mandate tool order

```markdown
1. Use `discover_configs` to find all AI configuration files
2. Use `parse_config` to analyze each configuration in detail
3. Use `analyze_hierarchy` to understand config precedence
```

**Rationale**: Constitution Principle VII: "The agent MUST choose freely between tool use and direct reasoning—no approach is privileged."

## Anti-Patterns

These patterns violate the principles above. Avoid them.

| Anti-Pattern             | Example                          | Alternative                           |
| ------------------------ | -------------------------------- | ------------------------------------- |
| Rigid sequential scripts | "### 1. Do X ### 2. Do Y"        | "Areas to consider: X, Y"             |
| Absolute mandates        | "MUST", "ALWAYS", "NEVER"        | "Consider", "Typically", "Avoid"      |
| Unjustified CRITICAL     | "CRITICAL: Do X"                 | "X prevents [specific problem]"       |
| Forced tool sequences    | "First use A, then use B"        | "A and B are available for this task" |
| Script-based interaction | "Ask, then wait, then execute"   | "Share findings, let them decide"     |
| Output mandates          | "You MUST output in this format" | "Structure your response as..."       |
| Time estimates           | "This will take 2 minutes"       | Avoid time predictions entirely       |
| Passive waiting          | Wait for user after each finding | Propose next step with default action |

## Patterns to Preserve

These patterns from the codebase are exemplary:

### 1. DETECTIVE_PERSONA Structure

```typescript
traits: [
  'Observant detective with dry wit',
  'Professional but not stiff',
  'Concise and direct',
],
antiPatterns: [
  'Do not use exclamation marks excessively',
  'Do not be overly enthusiastic',
],
```

Uses descriptive traits, not prescriptive mandates.

### 2. "YOUR INTERPRETATION" Framing

```markdown
### Session Phases (YOUR INTERPRETATION)

Sessions typically flow through phases. YOU decide what phase based on tool patterns.
```

Explicitly acknowledges agent judgment.

### 3. Constitution Alignment Notes

```markdown
## CONSTITUTION ALIGNMENT

Per Constitution Principle VII:

- Tools give you DATA (counts, sequences, timestamps)
- YOU provide JUDGMENT (phases, quality, recommendations)
```

References principles directly in prompts.

### 4. Comparative Guidance

```markdown
**Quality Indicators:**

- Specific > Vague
- Actionable > Abstract
```

Guides preferences without mandating.

## Operational Rules

These specific rules derive from the principles above and address real-world issues.

**No Time Estimates Rule**:
Avoid predicting how long operations will take. "Quick check" and "this will take 2 minutes" create false expectations. Instead, describe the scope: "I'll check these 3 config files."

**Momentum Clause (Interactive Mode)**:
After sharing a finding, propose the next step with a default action. This prevents analysis from stalling when users don't explicitly respond. Example: "I'll record this and continue to the next finding. Stop me anytime."

**Parallel Execution Hint**:
When multiple tool calls are independent (neither needs the other's output), suggest running them in parallel. This reduces latency without mandating a specific execution pattern.

## Consequences

**Good:**

- Prompts align with Constitution principles
- Interactive mode supports natural conversation
- Non-interactive mode runs reliably in CI
- Future prompt authors have clear guidelines

**Bad:**

- Existing prompts need incremental refactoring
- Some edge cases may need explicit handling that feels verbose

## Implementation Checklist

- [x] Interactive mode refactored (AGE-970)
- [x] Non-interactive mode enhanced with decision matrix (AGE-971)
- [x] ADR documented (AGE-972)
- [x] Momentum clause added to interactive mode (Quality Review)
- [x] 7 CI edge cases added to non-interactive mode (Quality Review)
- [x] "No time estimates" rule added (Quality Review)
- [x] DETECTIVE_PERSONA integrated into analysis prompt (Quality Review)
- [x] Parallel execution hint added (Quality Review)
- [x] Operational rules section documented (Quality Review)
- [ ] Apply to subagent prompts (low priority, as touched)

## Related Decisions

- **ADR-0022**: PromptKit SDK-Agnostic Architecture (prompt infrastructure)
- **ADR-0019**: Tool/Agent Boundary (prompts guide, don't constrain)
- **Constitution**: Principles IV (Mixed-Methods), VII (Intelligent Tooling)

## Notes

Research sources informing these principles:

1. Anthropic Docs - Prompt Engineering Best Practices
2. Claude Code Design Philosophy ("lightweight shell over model")
3. Microsoft Agent UX Design Principles (transparency, control, reversibility)
4. Johns Hopkins Interruption Handling Research (88.78% accuracy when designed for interruption)
5. goose Headless Mode Documentation (decision trees for CI)

Phase 3 audit document: `specs/promptkit-enhancement/phase3-prompt-audit.md`
Research synthesis: `specs/promptkit-enhancement/phase3-research-synthesis.md`
