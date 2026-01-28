---
status: superseded
superseded-by: ADR-0024
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0002: Agentic Framework Strategy

> **⚠️ SUPERSEDED**: This ADR has been superseded by [ADR-0024: Opencode SDK Migration](0024-opencode-sdk-migration.md). The content below describes the original Claude Agent SDK implementation.

## Context and Problem Statement

agentlint is an LLM-powered analysis tool where the agent IS the core of the system (Constitution Principle IX). We need to decide whether to use an existing agentic framework, build a custom agent loop, or adopt a hybrid approach. This decision directly impacts development velocity, debuggability, streaming/tool-calling patterns, and long-term maintainability.

With ADR-0001 establishing TypeScript/Bun as the runtime, we now need to select the agentic infrastructure that will power agentlint's analysis capabilities.

## Decision Drivers

- **Agent-Aware Architecture**: agentlint IS an agentic application—the agent orchestrates all analysis
- **Anthropic Primary Provider**: Claude Code analysis is MVP focus; Anthropic models are the primary target
- **Debuggability**: Long-running analysis sessions (30+ minutes) require transparent, debuggable loops
- **Tool Calling Excellence**: Rich tool ecosystem needed for config parsing, session analysis, git queries
- **Streaming Support**: Progressive output during analysis is a key UX requirement
- **MCP Compatibility**: Model Context Protocol integration for extensibility (DD-017)
- **Single-Threaded Simplicity**: Following Claude Code's pattern for reliability

## Considered Options

1. Claude Agent SDK
2. Vercel AI SDK
3. Custom Loop with Anthropic SDK
4. Vercel AI SDK + Mastra Framework

## Decision Outcome

Chosen option: **"Claude Agent SDK"** because it provides the same proven infrastructure that powers Claude Code, with built-in agent loop, context management, and MCP support optimized for Anthropic models. Combined with an Anthropic-only MVP strategy, this maximizes development velocity while ensuring production-ready reliability.

### Consequences

**Good:**

- Same infrastructure that powers Claude Code—proven at scale
- Built-in agent loop handles tool calling, result feeding, loop termination
- Native MCP connector support for tool extensibility
- Context management with automatic compaction (~92% threshold)
- V2 interface simplifies multi-turn conversations with send()/receive() patterns
- Optimized for Anthropic models (extended thinking, prompt caching)
- Reduces development time—agent loop is battle-tested

**Bad:**

- Couples to Anthropic as LLM provider (acceptable for MVP per decision)
- Less community examples than Vercel AI SDK (newer SDK)
- May need thin adapter layer if multi-provider support needed post-MVP

**Neutral:**

- SDK evolving rapidly—will need to track updates
- Some features in preview (V2 interface)—may need to use stable V1 patterns initially

## Pros and Cons of Options

### Option 1: Claude Agent SDK

The official Anthropic SDK for building AI agents, providing the same tools, agent loop, and context management that power Claude Code.

- Good: Same infrastructure as Claude Code—90% of Claude Code written by itself
- Good: Built-in agent loop: gather context → take action → verify work → repeat
- Good: Native MCP connectors for tool integration
- Good: Context compaction at ~92% usage prevents context overflow
- Good: V2 interface with simplified send()/receive() patterns
- Good: Optimized for Anthropic models (prompt caching, extended thinking)
- Good: Permission management with append_allowed_tools pattern
- Neutral: Newer than Vercel AI SDK—smaller community
- Bad: Anthropic-specific—would need adapter for other providers
- Bad: Some features still in preview

### Option 2: Vercel AI SDK

Provider-agnostic TypeScript toolkit with 2.8M weekly downloads, dominant in the ecosystem.

- Good: Provider-agnostic—switch between OpenAI, Anthropic, Google with one line
- Good: 2.8M weekly downloads—largest TypeScript AI community
- Good: ToolLoopAgent class handles complete tool execution loop
- Good: Agent interface allows custom implementations
- Good: Excellent React/Next.js streaming UI integration
- Good: Human-in-the-loop with needsApproval flag
- Neutral: More assembly required—lower-level toolkit
- Bad: Not optimized for Anthropic-specific features
- Bad: Would need to build context management ourselves
- Bad: Less aligned with Claude Code's proven architecture

### Option 3: Custom Loop with Anthropic SDK

Direct control using base Anthropic TypeScript SDK with manual agent loop implementation.

- Good: Maximum control over loop behavior
- Good: No framework abstraction overhead
- Good: Can exactly replicate Claude Code's patterns
- Good: Full access to all Anthropic API features
- Neutral: Claude Code pattern is well-documented
- Bad: More development effort—rebuild agent loop from scratch
- Bad: Must implement context management, compaction ourselves
- Bad: Miss out on SDK's battle-tested tool handling
- Bad: MCP integration would need custom implementation

### Option 4: Vercel AI SDK + Mastra Framework

High-level framework combining Vercel AI SDK with Mastra's workflows, memory, and evals.

- Good: Built-in memory, workflows, human-in-the-loop persistence
- Good: Eval runner with 15 built-in evaluations
- Good: RAG abstractions for document handling
- Good: From Gatsby team—production-focused
- Neutral: Mastra built on top of Vercel AI SDK
- Bad: Highest complexity—two frameworks to learn
- Bad: More abstraction than needed for agentlint's use case
- Bad: Potential overhead for CLI tool (web-framework-oriented)
- Bad: Less aligned with Claude Code's simplicity philosophy

## Constitution Compliance

| Principle                | Compliance | Notes                                                       |
| ------------------------ | ---------- | ----------------------------------------------------------- |
| I. Local-First           | Yes        | SDK runs locally; user provides Anthropic API key           |
| II. Improvement-Oriented | Yes        | Context management supports long-running analysis sessions  |
| III. Causal-First        | Yes        | Agent loop enables tracing through tool results             |
| IV. Mixed-Methods        | Yes        | Tools for static analysis, agent reasoning for qualitative  |
| V. Language-Agnostic     | Yes        | SDK is language-agnostic for analyzed projects              |
| VI. Agent-Agnostic       | Partial    | Anthropic-only for MVP; adapter layer possible post-MVP     |
| VII. Intelligent Tooling | Yes        | Native MCP support; agent chooses tools freely              |
| VIII. Compounding Value  | Partial    | Context management helps; baseline storage separate concern |
| IX. Agent-Aware          | Yes        | SDK designed for agentic applications—perfect fit           |

**Note on Principle VI**: The decision to go Anthropic-only for MVP is a deliberate trade-off. We accept reduced agent-agnosticism at the LLM provider level in exchange for development velocity and deeper Anthropic optimization. Multi-provider support can be added post-MVP via a thin adapter layer if needed.

## More Information

### Related Documents

- Architecture Vision: [Section 4 - High-Level Architecture](../../vision/agentlint-architecture-vision.md#4-high-level-architecture)
- Design Decisions: [DD-002](../design-decisions.md#dd-002-agentic-framework-strategy)
- Prior Decision: [ADR-0001 - Runtime Platform and Language](./0001-runtime-platform-and-language.md)

### Research Sources

- [Claude Code: Behind-the-scenes of the master agent loop](https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/)
- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Agent SDK TypeScript Reference](https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-typescript)
- [Vercel AI SDK 6](https://vercel.com/blog/ai-sdk-6)
- [Designing Agentic Loops - Simon Willison](https://simonwillison.net/2025/Sep/30/designing-agentic-loops/)
- [Mastra Framework Docs](https://mastra.ai/docs)
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript)

### Implementation Notes

1. **SDK Installation**: `npm install @opencode-ai/sdk`
2. **API Key Strategy**: Delegated to Opencode auth (see ADR-0026)
3. **Agent Loop Pattern**: Use built-in loop for MVP; can customize via V2 interface if needed
4. **Tool Definition**: Leverage MCP-compatible tool definitions for future extensibility
5. **Context Management**: Use SDK's compaction; add baseline hooks for improvement tracking
6. **Streaming**: SDK provides streaming via async generators—integrate with CLI output layer
7. **Subagent Strategy**: Allow single subagent branches (Claude Code pattern) per DD-009

### Future Considerations

- **Multi-Provider Support**: If needed post-MVP, create thin adapter layer wrapping Claude Agent SDK patterns for other providers
- **Testing Strategy**: Converging to Anthropic models simplifies test fixtures and eval baselines (DD-012)
- **MCP Integration**: DD-017 can leverage SDK's native MCP connectors
