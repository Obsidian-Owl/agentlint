---
status: proposed
date: 2026-01-22
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0021: Conversational Interaction Model

## Context and Problem Statement

agentlint currently operates in a "batch" mode: the user runs `agentlint analyse [dir]`, the agent executes to completion, and the session ends. The user cannot interact, redirect, or collaborate with the agent during analysis.

This rigid interaction model creates several problems:
1. **No user collaboration**: The agent asks "(yes/no)" questions as text but has no mechanism to receive answers
2. **Fixed execution path**: Users cannot dive deeper into specific findings or redirect investigation
3. **One-shot sessions**: Each analysis is isolated; users must restart to explore further
4. **Deterministic flow**: The session has clear start and end points with no deviation

The Claude Agent SDK supports richer interaction patterns via streaming input mode, `canUseTool` callbacks, and the `AskUserQuestion` tool. We need to decide how agentlint should leverage these capabilities to enable collaborative human-agent investigation.

## Decision Drivers

- **Agent-User Collaboration**: Analysis should feel like working WITH an expert, not watching one
- **Flexible Investigation**: Users should be able to redirect, drill down, or change focus
- **Natural Conversation**: Interaction should feel like dialogue, not command-line flags
- **Constitution Principle V (User Agency)**: Users decide what to act on; agent recommends
- **SDK Capabilities**: The Claude Agent SDK already supports the needed interaction patterns

## Considered Options

1. **Batch Mode with Flags** - Keep current model, add `--continue` and `--resume` flags
2. **Interactive REPL** - Full REPL mode where users type messages and agent responds
3. **Guided Conversation** - Agent-led interaction using `canUseTool` and `AskUserQuestion`
4. **Hybrid Mode** - Default to guided conversation, support batch mode for CI/automation

## Decision Outcome

Chosen option: **"Hybrid Mode"** - Implement guided conversation as the default interactive experience, while preserving batch mode for automation and CI pipelines.

### The Guided Conversation Model

The agent leads the investigation, asking structured questions when it needs input:

```
$ agentlint ~/myproject

Agent: I'll analyze your project configuration and session data.
       What aspects concern you most?

       1. Context efficiency (compression rates, token usage)
       2. Configuration quality (CLAUDE.md, AGENTS.md)
       3. Session patterns (tool usage, error rates)
       4. All of the above

User: 1

Agent: Checking session data... I found 1,364 compressions across 81 sessions.
       This indicates high context pressure. Would you like me to:

       1. Investigate the most compressed sessions
       2. Analyze your CLAUDE.md for size optimizations
       3. Create recommendations for improvement

User: 2

Agent: [Analyzes CLAUDE.md, continues dialogue...]
```

Key characteristics:
- **Agent-led**: Agent structures the conversation with clear choices
- **User-directed**: User can always type free text to redirect
- **Interruptible**: User can Ctrl+C to stop, resume later
- **Progressive**: Investigation deepens based on user interest

### Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Layer                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Interactive │  │   Batch     │  │   Question Presenter    │ │
│  │   Mode      │  │   Mode      │  │   (readline-based)      │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
┌─────────┼────────────────┼─────────────────────┼───────────────┐
│         ▼                ▼                     ▼               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Orchestrator                          │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │  canUseTool callback                              │   │  │
│  │  │  - AskUserQuestion → QuestionPresenter            │   │  │
│  │  │  - Tool approval → ToolApprovalPrompt             │   │  │
│  │  │  - Return answers to SDK                          │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                         Orchestration Layer                    │
└───────────────────────────────────────────────────────────────┘
```

### Consequences

**Good:**
- Users can collaborate with the agent, not just observe
- Investigation can adapt to what users find interesting
- Preserves batch mode for CI/CD and automation
- Leverages existing SDK capabilities (minimal new code)
- Aligns with Constitution Principle V (user agency)

**Bad:**
- More complex CLI interaction model
- May require session persistence for meaningful resume
- Agent prompts need careful design to avoid overwhelming users

**Neutral:**
- Changes how agents should be prompted (ask questions, offer choices)
- Interactive mode will be slower than batch (waiting for user)

## Pros and Cons of Options

### Option 1: Batch Mode with Flags

Keep current model, add `--continue` and `--resume` flags for multi-session workflows.

- Good: Minimal changes to current architecture
- Good: Simple mental model for users
- Neutral: Feels like separate sessions rather than conversation
- Bad: Disjointed experience - requires explicit flags to continue
- Bad: Doesn't address real-time collaboration during analysis
- Bad: User still can't redirect mid-session

### Option 2: Interactive REPL

Full REPL mode where users type messages and agent responds.

- Good: Maximum flexibility - users can say anything
- Good: Familiar pattern from Claude Code interactive mode
- Good: Natural language interaction
- Neutral: Requires more sophisticated prompt handling
- Bad: Unstructured - users may not know what to ask
- Bad: Agent may give lengthy responses without clear next steps
- Bad: Harder to guide users toward useful outcomes

### Option 3: Guided Conversation (Agent-led)

Agent uses `AskUserQuestion` to present structured choices, user selects or types.

- Good: Agent structures conversation with clear options
- Good: Reduces user cognitive load (choices vs. blank prompt)
- Good: Still allows free-text input when user wants to redirect
- Good: Maps directly to SDK's `AskUserQuestion` tool
- Neutral: Agent needs to be prompted to ask good questions
- Bad: May feel restrictive if options don't match user's intent
- Bad: Requires careful question design

### Option 4: Hybrid Mode (Recommended)

Default to guided conversation, support batch mode via `--non-interactive` flag.

- Good: Best of both worlds - interactive by default, batch for CI
- Good: Guided conversation helps users who don't know where to start
- Good: Free-text input allows experienced users to direct
- Good: Batch mode ensures automation compatibility
- Good: Progressive disclosure - simple choices first, deeper options emerge
- Neutral: Two code paths to maintain
- Bad: More complexity than pure batch mode

## Technical Implementation

### Phase 1: canUseTool Foundation (Immediate)

Add `canUseTool` callback to orchestrator:

```typescript
const queryOptions = {
  // ... existing options ...
  canUseTool: async (toolName: string, input: unknown) => {
    if (toolName === 'AskUserQuestion') {
      // Route to interactive question presenter
      const answers = await presentQuestionsInteractive(input.questions);
      return { behavior: 'allow', updatedInput: { questions: input.questions, answers } };
    }
    // For other tools, show approval prompt
    return await promptForToolApproval(toolName, input);
  }
};
```

This enables:
- Agent can ask structured questions via `AskUserQuestion`
- User answers flow back to agent
- Tool approvals for destructive operations

### Phase 2: Conversational Prompting

Update analysis prompts to leverage questions:

```markdown
## Interaction Pattern

When you need user input:
1. Use the AskUserQuestion tool with clear, numbered options
2. Keep questions focused - one decision at a time
3. Always offer "Other" for free-text input
4. After user answers, explain what you'll do next

Example:
- Instead of: "I'll analyze your configuration now."
- Do: Ask which aspect they want to focus on first
```

### Phase 3: Session Continuity (Future)

Enable resuming conversations:
- Save session state to `.agentlint/sessions/`
- Implement `--resume` to continue previous conversation
- Track conversation context across sessions

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All interaction happens locally |
| II. Improvement-Oriented | Yes | Enables deeper investigation of issues |
| III. Causal-First | Yes | User can ask "why" and drill down |
| IV. Mixed-Methods | Yes | Agent chooses analysis based on user direction |
| V. Language-Agnostic | Yes | No change to analysis capabilities |
| VI. Agent-Agnostic | Yes | Interaction model is agent-independent |
| VII. Intelligent Tooling | Yes | Agent uses tools based on conversation |
| VIII. Compounding Value | Yes | Sessions can build on previous findings |
| IX. Agent-Aware | Yes | Interaction designed for agent capabilities |

## Related Issues

- **AGE-686**: Human-in-the-loop: Agent asks (yes/no) as text without mechanism to receive answer
- **AGE-687**: No canUseTool callback configured

Both issues are symptoms of the missing conversational infrastructure this ADR addresses.

## More Information

### Research Sources
- [Handle approvals and user input - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/user-input)
- [Streaming vs Single Mode - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [Claude Code Interactive Mode](https://code.claude.com/docs/en/common-workflows)
- [OpenCode Agent Design](https://opencode.ai/docs/agents/)

### Related ADRs
- [ADR-0002: Agentic Framework Strategy](./0002-agentic-framework-strategy.md) - Chose Claude Agent SDK
- [ADR-0010: Session State and Checkpointing](./0010-session-state-and-checkpointing.md) - Session persistence
