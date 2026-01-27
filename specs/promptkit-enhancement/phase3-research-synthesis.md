# Phase 3 Research Synthesis: Interactive vs Non-Interactive Prompt Design

**Date**: 2026-01-27  
**Purpose**: Inform AGE-970 (interactive mode) and AGE-971 (non-interactive mode) refactoring

---

## Executive Summary

Research reveals a fundamental tension in our current prompts:

| Mode                | Current State            | Best Practice                           |
| ------------------- | ------------------------ | --------------------------------------- |
| **Interactive**     | Rigid 4-step script      | Adaptive conversation with user control |
| **Non-Interactive** | "Execute without asking" | Self-contained with decision matrices   |

Both modes need significant refactoring to align with industry best practices.

---

## Key Research Findings

### 1. Anthropic's Core Philosophy

> "Think of Claude as a brilliant but very new employee (with amnesia) who needs explicit instructions."

**Implication**: Provide context and guidance, not scripts. The agent reasons; we inform.

### 2. Claude Code Design Philosophy

From Pragmatic Engineer's analysis of Claude Code internals:

> Keep the client as a **"lightweight shell"** over the Claude model:
>
> - Expose tools and let the model do most work
> - Make users "feel the model as raw as possible"
> - **Minimize scaffolding, UI clutter, and tool count**
> - Avoid limiting the model's capabilities

**Implication**: Our prompts should guide, not constrain. Less scaffolding = better agent performance.

### 3. User Control Principles (Microsoft Agent UX)

Core requirements:

- **Transparency**: Decision-making visible
- **Control**: User can override at any point
- **Consistency**: Predictable behavior patterns
- **Reversibility**: Actions can be undone

**Implication**: Interactive mode should emphasize user control, not agent scripts.

### 4. Interruption Handling (Academic Research)

Johns Hopkins research on interruption classification:

- **Agreement** (affirming current direction)
- **Assistance** (offering help)
- **Clarification** (seeking understanding)
- **Disruption** (changing direction)

> **88.78% intent classification accuracy** when system is designed for interruption

**Implication**: Design for interruption as normal, not exceptional.

### 5. Non-Interactive Best Practices (goose/Claude Code Headless)

Key patterns from CI/automation tools:

1. **Self-contained prompts**: All context in single request
2. **Decision trees**: "If X, do Y; if Y fails, do Z"
3. **Structured output**: JSON schemas for machine parsing
4. **Resource limits**: Timeouts, max turns, fallback actions
5. **Bounded autonomy**: Clear scope of what agent can/cannot do

Example from goose headless documentation:

```bash
claude -p "Analyze test failures.
  If authentication errors: check middleware.
  If database errors: check connection pool.
  If timeout errors: increase limits and retry."
```

---

## Current Implementation Analysis

### buildInteractiveInstructions() - Problems

```typescript
// Current (rigid script)
## Interactive Mode

For EACH significant finding, have a brief conversation with the user:

### 1. State your finding (2-3 sentences)
### 2. State your assessment
### 3. Ask for confirmation if creating new
### 4. Execute based on response
```

**Issues**:

1. Mandates scripted sequence for every finding
2. Contradicts Constitution's collaborative model ("agent _may_ ask questions")
3. Doesn't support natural conversation flow
4. No mention of user control or interruption handling

### Non-Interactive Mode - Problems

```typescript
// Current (insufficient guidance)
## Non-Interactive Mode

You are running in CI/automated mode. For each finding:
1. Review existing recommendations (table above)
2. Decide: create, update, or add observation
3. Execute without asking - follow the decision matrix
```

**Issues**:

1. References a "decision matrix" but doesn't provide one
2. No fallback behavior specified
3. No guidance on ambiguous situations
4. No structured output expectations

---

## Recommended Refactoring

### Interactive Mode (AGE-970)

**From Script → Guidance**

Replace the 4-step script with conversational principles:

```markdown
## Interactive Mode

You're having a conversation with a developer about their project. They control the flow.

**Your role**: Share findings, offer insights, answer questions. The developer decides what to act on.

**Conversation principles**:

- Be direct: State findings concisely (2-3 sentences)
- Be responsive: If they ask about something, address it
- Be patient: They may interrupt, change direction, or need time to think
- Be helpful: If they seem stuck, offer options

**User control**:

- They can interrupt at any point to ask questions
- They can skip findings they're not interested in
- They decide whether to create recommendations
- They can end the analysis whenever they want

**When creating recommendations**:

- Briefly explain what you found and why it matters
- If similar to existing recommendation, mention it
- Let them decide: "Want me to record this?"

**Don't**:

- Follow a rigid script
- Demand responses to every finding
- Create recommendations without acknowledgment
```

**Key changes**:

1. Principles, not steps
2. Explicit user control statement
3. "Let them decide" framing
4. Anti-patterns clearly stated

### Non-Interactive Mode (AGE-971)

**From Vague → Structured**

Replace "execute without asking" with decision framework:

```markdown
## Non-Interactive Mode (CI/Automation)

You're running autonomously. Complete the analysis without user input.

**Decision Framework**:

| Situation                                            | Action                                           |
| ---------------------------------------------------- | ------------------------------------------------ |
| Clear issue, no existing recommendation              | Create new recommendation                        |
| Issue matches existing recommendation                | Add observation to existing                      |
| Issue contradicts existing recommendation            | Verify which is correct, update accordingly      |
| Ambiguous issue (could be interpreted multiple ways) | Document both interpretations in recommendation  |
| Unable to determine severity                         | Default to "medium" with note about uncertainty  |
| Tool fails or times out                              | Log error, continue with other tools             |
| Analysis takes too long                              | Complete current phase, summarize remaining work |

**Output structure**:

- Start with summary: "Found N issues across M files"
- Group findings by severity (critical → high → medium → low)
- End with actionable next steps

**Constraints**:

- Do not wait for user input
- Do not skip findings due to uncertainty—document the uncertainty
- Do not create duplicate recommendations—consolidate instead

**If you cannot complete**:
Report what was completed, what remains, and why you stopped.
```

**Key changes**:

1. Explicit decision matrix
2. Default behaviors for edge cases
3. Output structure expectations
4. Failure handling guidance

---

## Constitution Alignment

These changes align with Constitution principles:

| Principle                    | Interactive Alignment                       | Non-Interactive Alignment                    |
| ---------------------------- | ------------------------------------------- | -------------------------------------------- |
| **IV. Mixed-Methods**        | Agent chooses methods based on conversation | Agent decides analysis approach autonomously |
| **VII. Intelligent Tooling** | Agent chooses between tools and reasoning   | Decision matrix informs, doesn't constrain   |
| **IX. Agent-Aware**          | Guidance serves agent cognition             | Clear structure reduces ambiguity            |
| **Collaborative Model**      | "Agent _may_ ask questions"                 | Complete autonomously                        |

---

## Implementation Checklist

### AGE-970: Interactive Mode

- [ ] Replace 4-step script with conversational principles
- [ ] Add explicit user control statement
- [ ] Add interruption handling guidance
- [ ] Add anti-patterns section
- [ ] Test with actual conversations

### AGE-971: Non-Interactive Mode

- [ ] Add decision matrix table
- [ ] Add default behaviors for edge cases
- [ ] Add output structure expectations
- [ ] Add failure handling guidance
- [ ] Test in CI environment

### AGE-972: ADR Documentation

- [ ] Document interactive vs non-interactive design philosophy
- [ ] Include patterns to preserve (from audit)
- [ ] Include anti-patterns to avoid
- [ ] Reference research sources

---

## Sources

1. Anthropic Docs - Prompt Engineering Best Practices
2. Claude Code Design Philosophy (Pragmatic Engineer)
3. Microsoft Agent UX Design Principles
4. Johns Hopkins Interruption Handling Research (2025)
5. goose Headless Mode Documentation
6. AWS Agentic AI Security Scoping Matrix
7. OpenHands Headless Mode Documentation
8. BMAD-METHOD Workflow Configurations
