# agentlint Conceptual Architecture

> A technology-agnostic conceptual model for building a local-first, agent-orchestrated analysis system for AI-assisted development workflows.

**Version**: 1.0.0
**Status**: Conceptual Design
**Date**: January 2026

---

## 1. Executive Summary

agentlint is an **agentic application**—an LLM-powered agent that orchestrates analysis of AI-assisted development workflows. This document defines the conceptual architecture that guides implementation decisions while remaining agnostic to specific technology choices.

### Core Architectural Identity

agentlint embodies a fundamental insight from modern agentic systems: **simplicity scales**. Research into production AI agents—including Claude Code, Cursor, and other autonomous coding tools—reveals that the most effective architectures are not complex graphs or multi-threaded systems, but rather simple, composable patterns:

- A **single-threaded master loop** that maintains a flat message history
- **Tools that serve the agent's cognitive needs**, not rigid pipelines
- **Hybrid memory systems** combining session context with persistent learnings
- **Human-in-the-loop collaboration** where the agent recommends and the user decides

This architecture positions agentlint as both a **consumer of agentic patterns** (analyzing other AI coding tools) and an **exemplar of those patterns** (embodying the principles it recommends).

---

## 2. Foundational Concepts

### 2.1 The Agentic Nature of agentlint

Unlike traditional static analysis tools, agentlint is fundamentally agentic:

| Traditional Static Analysis | agentlint (Agentic) |
|----------------------------|---------------------|
| Predefined rule execution | Agent-directed analysis |
| Pattern matching | Semantic reasoning |
| Point-in-time detection | Causal understanding |
| Fixed output | Contextual recommendations |
| No learning | Compounding value over time |

The agent orchestrates all analysis, deciding which tools to invoke, what questions to investigate, and how to synthesize findings into actionable insights.

### 2.2 The Two Complementary Analysis Modes

agentlint operates through two complementary analysis modes:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTIC REASONING                            │
│  Deep understanding, causal analysis, quality judgments,        │
│  semantic interpretation, contextual recommendations            │
│                                                                 │
│  THE AGENT PROVIDES: Why things happened, whether they're       │
│  good or bad, what should change, how to prevent recurrence     │
├─────────────────────────────────────────────────────────────────┤
│                    STATIC DATA GATHERING                        │
│  Fast, deterministic extraction of facts:                       │
│  - Configuration parsing and metrics                            │
│  - Session log statistics                                       │
│  - Git history and change detection                             │
│  - Documentation structure analysis                             │
│                                                                 │
│  STATIC TOOLS PROVIDE: What is configured, what happened,       │
│  how things are structured, what changed                        │
└─────────────────────────────────────────────────────────────────┘
```

Neither mode is privileged. The agent decides freely which approach serves the analysis task best.

### 2.3 The Collaborative Model

agentlint is a **recommendation system**, not an automation system. The interaction model preserves user agency:

```
ANALYSE → DISCUSS → RECOMMEND → DECIDE → IMPLEMENT
   │         │          │          │          │
   │         │          │          │          └── Developer approves changes
   │         │          │          └── Developer chooses what to implement
   │         │          └── Agent proposes options with rationale
   │         └── Agent presents findings, asks clarifying questions
   └── Agent gathers context and identifies issues
```

The agent may ask questions, present options, and make recommendations. The developer maintains control over all decisions and changes.

---

## 3. Conceptual Architecture Layers

### 3.1 Layer Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INTERFACE LAYER                       │
│  CLI Commands, Output Formatting, Progress Reporting            │
├─────────────────────────────────────────────────────────────────┤
│                      ORCHESTRATION LAYER                        │
│  Master Agent Loop, Tool Selection, Context Management,         │
│  Human-in-the-Loop Coordination                                 │
├─────────────────────────────────────────────────────────────────┤
│                      TOOL LAYER                                 │
│  Static Analysis Tools, Data Gathering, Search & Index          │
├─────────────────────────────────────────────────────────────────┤
│                      ADAPTER LAYER                              │
│  ACT Adapters (Claude Code, Cursor, Copilot, etc.)              │
├─────────────────────────────────────────────────────────────────┤
│                      PERSISTENCE LAYER                          │
│  Baselines, Learnings, Session State, Configuration             │
├─────────────────────────────────────────────────────────────────┤
│                      INTEGRATION LAYER                          │
│  LLM Provider, Filesystem, Git, External APIs                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 User Interface Layer

**Responsibility**: Translate user intent into agent tasks and present results in consumable formats.

**Key Concepts**:
- **Command Interpretation**: Parse CLI commands into analysis tasks
- **Progressive Output**: Stream findings as they're discovered (critical for long sessions)
- **Format Adaptation**: Render results for terminal, JSON, or structured formats
- **Progress Indication**: Communicate analysis state during extended operations

**Design Principle**: The interface layer is thin. It translates between user expectations and the orchestration layer without embedding analysis logic.

### 3.3 Orchestration Layer

**Responsibility**: The cognitive core of agentlint. The agent reasons about analysis tasks, selects tools, synthesizes findings, and generates recommendations.

#### 3.3.1 Master Loop Architecture

Following patterns proven in production agentic systems, agentlint uses a **single-threaded master loop**:

```
┌──────────────────────────────────────────────────────────────┐
│                      MASTER LOOP                              │
│                                                               │
│  while (analysis_active):                                     │
│    1. Assess current context and task state                   │
│    2. Reason about next action (tool use OR direct reasoning) │
│    3. If tool needed: invoke tool, observe result             │
│    4. If user input needed: pause for human-in-the-loop       │
│    5. Update working memory with findings                     │
│    6. Check termination conditions                            │
│                                                               │
│  Output: Synthesized findings, recommendations, learnings     │
└──────────────────────────────────────────────────────────────┘
```

**Key Characteristics**:
- **Single thread, flat history**: Enhances debuggability and predictability
- **Tool invocation is optional**: Agent may reason directly without tools
- **Graceful interruption**: Analysis can be paused, resumed, or redirected
- **Checkpointing**: State saved after major phases for resumability

#### 3.3.2 Agent Cognitive Workspace

The agent's context is structured as hierarchical working memory:

```
┌─────────────────────────────────────────────────────────────────┐
│ TASK GOAL                                                       │
│ What are we analyzing? What does the user want to understand?   │
├─────────────────────────────────────────────────────────────────┤
│ PROJECT CONTEXT (compressed)                                    │
│ Detected configs, languages, structure, prior analysis         │
├─────────────────────────────────────────────────────────────────┤
│ ANALYSIS PROGRESS                                               │
│ Completed phases, current findings, open questions              │
├─────────────────────────────────────────────────────────────────┤
│ ACCUMULATED FINDINGS                                            │
│ Issues detected, traces completed, recommendations pending      │
├─────────────────────────────────────────────────────────────────┤
│ BASELINE AWARENESS (if available)                               │
│ Previous analysis state for comparison                          │
├─────────────────────────────────────────────────────────────────┤
│ GLOBAL LEARNINGS                                                │
│ Cross-project patterns loaded at session start                  │
└─────────────────────────────────────────────────────────────────┘
```

**Context Compression Strategy**:
- Static tools pre-process data before agent consumption
- Large inputs (session logs, codebases) are indexed and summarized
- Compression triggers activate as context utilization increases
- Critical information (task goals, errors, decisions) is always preserved

#### 3.3.3 Sub-Agent and Multi-Agent Patterns

agentlint supports delegation to sub-agents for complex or parallelizable tasks. Research into production multi-agent systems (including Claude Code, Anthropic's research system, and enterprise patterns) reveals several proven approaches.

##### Multi-Agent Orchestration Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      MASTER AGENT                               │
│  Orchestrates overall analysis, maintains authoritative context │
│                          │                                      │
│     ┌────────────────────┼────────────────────┐                 │
│     │                    │                    │                 │
│     ▼                    ▼                    ▼                 │
│ ┌────────────┐     ┌────────────┐     ┌────────────┐           │
│ │ Config     │     │ Session    │     │ Causal     │           │
│ │ Analysis   │     │ Analysis   │     │ Tracing    │           │
│ │ Sub-Agent  │     │ Sub-Agent  │     │ Sub-Agent  │           │
│ └────────────┘     └────────────┘     └────────────┘           │
│       │                  │                  │                   │
│       └──────────────────┴──────────────────┘                   │
│                          │                                      │
│                          ▼                                      │
│              Results synthesized by Master                      │
└─────────────────────────────────────────────────────────────────┘
```

##### Pattern 1: Orchestrator-Workers

The master agent decomposes tasks and delegates to specialized workers:

- **Master agent**: Analyzes task, develops strategy, spawns sub-agents
- **Sub-agents**: Execute focused subtasks with clear boundaries
- **Synthesis**: Master collects and integrates results

This pattern excels when tasks can be cleanly partitioned into independent domains.

##### Pattern 2: Agents as Tools

Sub-agents are wrapped as callable tools that the master agent invokes:

```
┌─────────────────────────────────────────────────────────────────┐
│  MASTER AGENT                                                   │
│  ├── Tool: ConfigAnalyzer (wraps config analysis sub-agent)     │
│  ├── Tool: SessionAnalyzer (wraps session analysis sub-agent)   │
│  ├── Tool: CausalTracer (wraps tracing sub-agent)               │
│  └── Tool: ReadFile, GitQuery, etc. (static tools)              │
│                                                                 │
│  The master treats sub-agents as tools—invoking them when       │
│  domain expertise is needed, receiving structured results.      │
└─────────────────────────────────────────────────────────────────┘
```

This creates a uniform interface where the master agent decides when to invoke specialized capabilities, whether those are static tools or agentic sub-agents.

##### Pattern 3: Parallel Execution

Independent sub-tasks execute simultaneously for efficiency:

- Master spawns multiple sub-agents in parallel (not serially)
- Each sub-agent works within its own context window
- Results are collected and synthesized when all complete
- Can reduce analysis time significantly for complex queries

##### Sub-Agent Constraints

To maintain system coherence and prevent runaway complexity:

| Constraint | Rationale |
|------------|-----------|
| **Depth limits** | Sub-agents typically cannot spawn their own sub-agents (prevents proliferation) |
| **Scoped context** | Sub-agents receive only the context they need for their task |
| **Focused tool access** | Principle of least privilege—only tools relevant to the subtask |
| **Clear task boundaries** | Each sub-agent needs objective, output format, and scope |
| **Result synthesis** | Master agent integrates sub-agent outputs into coherent findings |

##### When to Use Sub-Agents

| Use Case | Approach |
|----------|----------|
| Parallel exploration of large codebase | Multiple sub-agents explore different areas simultaneously |
| Domain-specialized analysis | Dedicated sub-agent with focused expertise and prompts |
| Token-intensive tasks | Offload to sub-agent with its own context window |
| Independent subtasks | Parallelize for efficiency |

##### When NOT to Use Sub-Agents

| Situation | Prefer Instead |
|-----------|----------------|
| Simple, sequential tasks | Direct execution in master loop |
| Tasks requiring shared state | Single agent with working memory |
| Tightly coupled subtasks | Sequential execution with checkpointing |

### 3.4 Tool Layer

**Responsibility**: Provide the agent with deterministic, fast access to information it needs for reasoning.

#### 3.4.1 Tool Design Philosophy

Tools exist to serve the agent's cognitive needs. Drawing from research into effective agentic systems:

> "Invest equivalent effort in Agent-Computer Interface (ACI) as Human-Computer Interface (HCI)."

**Tool Design Principles**:

| Principle | Application |
|-----------|-------------|
| **Descriptive, not prescriptive** | Tool descriptions explain capabilities; agent decides when to use |
| **Atomic operations** | Each tool does one thing well |
| **Structured output** | Results are formatted for agent consumption |
| **Error transparency** | Failures are informative, not opaque |
| **Poka-yoke** | Design prevents common misuse (e.g., absolute paths only) |

#### 3.4.2 Tool Categories

```
DISCOVERY TOOLS
├── Config Detection: Find AI configuration files
├── Log Discovery: Locate session logs
├── Structure Analysis: Map project layout
└── Guardrail Detection: Identify quality tooling

DATA EXTRACTION TOOLS
├── Config Parser: Extract metrics and structure from configs
├── Session Statistics: Calculate usage patterns from logs
├── Git Query: Access history, blame, changes
└── Documentation Analysis: Assess doc structure and coverage

SEARCH & INDEX TOOLS
├── Full-Text Search: Find patterns across session logs
├── Position Indexing: Enable precise references for tracing
└── Baseline Query: Compare current state to stored snapshots

REASONING SUPPORT TOOLS
├── File Reader: Load specific content for agent analysis
├── Summary Generator: Compress large content for context
└── Correlation Tools: Link signals across domains
```

#### 3.4.3 Tool Results and Agent Reasoning

Tools return structured data; the agent provides interpretation:

| Tool Returns | Agent Provides |
|--------------|----------------|
| Token counts, iteration stats | Assessment of efficiency |
| Error patterns in logs | Understanding of why errors occurred |
| Configuration structure | Quality judgment and recommendations |
| Temporal deltas | Insight into improvement trajectory |

### 3.5 Adapter Layer

**Responsibility**: Abstract the differences between AI Coding Tools (ACTs) behind a consistent interface.

#### 3.5.1 Adapter Contract

Each ACT adapter implements a standard interface:

```
ACT Adapter Interface:
├── detect()      → Does this ACT exist in the project?
├── parseConfig() → Extract configuration with standard schema
├── locateLogs()  → Find session log files
├── parseLogs()   → Extract metrics with standard schema
├── getMetadata() → ACT-specific information
└── generate()    → Create or modify configuration (future)
```

#### 3.5.2 ACT Abstraction Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      CORE ANALYSIS ENGINE                       │
│  Works with normalized data: Config, Sessions, Docs, Signals    │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│ Generalized  │ Claude Code  │ Cursor       │ Future ACTs...     │
│ Adapter      │ Adapter      │ Adapter      │                    │
│ (Default)    │              │              │                    │
├──────────────┼──────────────┼──────────────┼────────────────────┤
│ Common       │ CLAUDE.md    │ .cursorrules │                    │
│ patterns &   │ .claude/     │ .cursor/     │                    │
│ heuristics   │ JSONL logs   │ debug logs   │                    │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

#### 3.5.3 The Generalized Adapter

The **Generalized Adapter** serves as the default when:
- No specific ACT is detected or configured
- The user works with multiple ACTs and wants unified analysis
- The user hasn't committed to a specific tool yet

**How It Differs from Specific Adapters**:

| Aspect | Specific ACT Adapter | Generalized Adapter |
|--------|---------------------|---------------------|
| Config locations | Precise paths (e.g., `CLAUDE.md`, `.claude/`) | Common patterns, likely locations |
| Log formats | Exact schema knowledge | Heuristic parsing of common formats |
| System prompts | ACT-specific guidance and terminology | General AI workflow patterns |
| Recommendations | Tool-specific best practices | Cross-tool best practices, AGENTS.md |

The Generalized Adapter doesn't disable functionality—it operates with broader guidance. The agent still attempts all analysis domains but uses general heuristics rather than precise ACT-specific knowledge to locate configurations, interpret logs, and generate recommendations.

**Key Principle**: agentlint provides value regardless of which coding assistant the user has chosen. The Generalized Adapter ensures the system works out-of-the-box, while specific adapters provide optimized, targeted analysis for users who have committed to a particular tool.

**Graceful Degradation**: When an ACT lacks certain data (e.g., limited logs), analysis proceeds with available information rather than failing.

### 3.6 Persistence Layer

**Responsibility**: Maintain state across sessions to enable continuous improvement and compounding value.

#### 3.6.1 Storage Domains

```
PROJECT-LOCAL STORAGE (.agentlint/)
├── baselines/       → Timestamped analysis snapshots
├── session-state/   → Checkpoints for resumable analysis
├── cache/           → Indexed session logs, parsed configs
└── recommendations/ → Tracked recommendations with status

GLOBAL STORAGE (~/.agentlint/)
├── learnings/       → Cross-project transferable insights
├── config/          → User preferences and defaults
└── credentials/     → LLM API configuration (never transmitted)
```

#### 3.6.2 Memory Model

Following patterns from agentic memory research, agentlint implements a hybrid memory system:

**Short-Term Memory (Session Context)**:
- Current analysis state and findings
- Recent tool results and reasoning
- Active task goals and progress

**Long-Term Memory (Persistent)**:
- **Episodic**: Baselines capturing analysis snapshots over time
- **Semantic**: Global learnings about patterns that transfer across projects
- **Procedural**: Tracked recommendation effectiveness

**Memory Operations**:
- **Store**: Persist significant findings to appropriate memory type
- **Retrieve**: Load relevant context at session start
- **Update**: Refine learnings based on new evidence
- **Promote**: Elevate project-specific insights to global learnings

### 3.7 Integration Layer

**Responsibility**: Interface with external systems while maintaining local-first principles.

#### 3.7.1 LLM Provider Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                      LLM PROVIDER ABSTRACTION                   │
│                                                                 │
│  ┌─────────────┐     ┌──────────────┐     ┌──────────────────┐  │
│  │ Provider A  │     │ Provider B   │     │ Local Model      │  │
│  │ (Anthropic) │     │ (OpenAI)     │     │ (Ollama, etc.)   │  │
│  └─────────────┘     └──────────────┘     └──────────────────┘  │
│                                                                 │
│  Abstraction provides:                                          │
│  - Consistent tool calling interface                            │
│  - Streaming response handling                                  │
│  - Token counting and context management                        │
│  - Error handling and retry logic                               │
└─────────────────────────────────────────────────────────────────┘
```

**Critical Requirement**: The LLM provider abstraction must support the tool-calling patterns required for agentic operation while remaining provider-agnostic.

#### 3.7.2 External System Interfaces

| System | Interface | Local-First Consideration |
|--------|-----------|--------------------------|
| Filesystem | Direct access | All data remains local |
| Git | CLI or library | History queries run locally |
| LLM API | HTTP/streaming | Only interface that contacts external services |
| Future: MCP | Protocol-based | Optional; enables tool extensibility |

---

## 4. Core Architectural Patterns

### 4.1 The Continuous Improvement Loop

The fundamental operating model that enables compounding value:

```
        ┌─────────────────────────────────────────────────┐
        │                                                 │
        ▼                                                 │
    BASELINE ──▶ CHANGE ──▶ OBSERVE ──▶ UNDERSTAND ──▶ REFINE
        │                       │            │            │
        │                       │            └── TRACE    │
        │                       │                issues   │
        │                       │                to       │
        │                       │                origin   │
        │                       │                         │
        └───────────────────────┴─────────────────────────┘
```

**Architectural Implications**:
- Baselines are first-class entities, not afterthoughts
- Every analysis can compare to previous state
- Recommendations track implementation and effectiveness
- Value accrues through repeated use

### 4.2 The Causal Analysis Model

agentlint's key differentiator: tracing issues to their origin and recommending prevention.

```
DETECT ──▶ TRACE ──▶ UNDERSTAND ──▶ RECOMMEND
   │          │           │             │
   │          │           │             └── Generate preventive changes
   │          │           └── Identify the gap that allowed the issue
   │          └── Search sessions/git for origin
   └── Static analysis or agent identifies issue
```

**Architectural Support**:
- Session logs are indexed with position markers for precise tracing
- Git integration enables temporal correlation
- Evidence chains link issues to origins to recommendations
- Three recommendation tiers: symptomatic, preventive, systemic

### 4.3 The Mixed-Methods Analysis Model

Combining quantitative signals with qualitative assessment:

```
QUANTITATIVE SIGNALS              QUALITATIVE ASSESSMENT
├── Token usage metrics           ├── Intent understanding
├── Iteration counts              ├── Flow quality judgment
├── Tool distribution             ├── Semantic clarity
├── Error frequencies             ├── Causal reasoning
└── Temporal deltas               └── Contextual recommendations
        │                                    │
        └────────────────┬───────────────────┘
                         │
                         ▼
               META-INFERENCES
        (Correlating signals across types)
```

**Signal Types**:
- **Leading**: Predict future outcomes (config coverage, type strictness)
- **Lagging**: Reflect past outcomes (token efficiency, error frequency)
- **Qualitative**: Semantic assessments (clarity, coherence)
- **Causal**: Traced origins (session→issue links)

### 4.4 The Agent-Orchestrated Analysis Pattern

The agent reasons about which methods to apply, rather than following rigid pipelines:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANALYSIS GUIDANCE                            │
│  Method descriptions, signal taxonomies, domain knowledge       │
│                          │                                      │
│                          ▼                                      │
│              ┌─────────────────────┐                            │
│              │   AGENT REASONING   │                            │
│              │                     │                            │
│              │ - What does the     │                            │
│              │   task require?     │                            │
│              │ - Which methods     │                            │
│              │   are relevant?     │                            │
│              │ - Skip or adapt     │                            │
│              │   as needed         │                            │
│              └─────────────────────┘                            │
│                          │                                      │
│                          ▼                                      │
│           CONTEXTUAL, ADAPTIVE ANALYSIS                         │
└─────────────────────────────────────────────────────────────────┘
```

**Anti-Pattern**: Forced sequential pipelines where every analysis runs every method regardless of relevance.

---

## 5. Cross-Cutting Concerns

### 5.1 Context Management

**Challenge**: Large inputs (session logs, codebases) can exceed context limits.

**Strategies**:
1. **Hierarchical Summarization**: Coarse overview → targeted deep dives
2. **Static Pre-Processing**: Tools extract structure before agent receives content
3. **Incremental Loading**: Load detail on demand, not upfront
4. **Compression Triggers**: Automatic summarization as context utilization increases
5. **Priority Preservation**: Task goals, errors, and decisions always retained

### 5.2 Long-Running Session Support

**Philosophy**: Deep analysis takes time. 30+ minute sessions are expected for thorough analysis.

**Architectural Support**:
- **Streaming Output**: Findings visible as discovered
- **Checkpointing**: State saved after major phases
- **Resumability**: Interrupted sessions continue from last checkpoint
- **Pause/Resume**: User can pause for review, then continue
- **Progress Indication**: Clear communication of analysis state

### 5.3 Security and Privacy

**Local-First is Non-Negotiable**:
- All analysis runs on user's machine
- No data transmitted without explicit consent
- User provides own LLM API credentials
- Secrets detected but never stored or transmitted
- Appropriate file permissions for local storage

### 5.4 Extensibility

**Plugin Points**:
- ACT adapters for new AI coding tools
- Analysis rules and heuristics
- Output formatters
- Tool extensions (future: MCP integration)

**Design Constraint**: Core analysis logic never changes when adding new ACT support.

---

## 6. Stakeholder Experience Framework

agentlint optimizes three interconnected experiences:

### 6.1 Agent Experience (AX)

*How well does the architecture serve the agentlint agent's cognitive needs?*

- Is context distilled and structured for stable reasoning?
- Is working memory organized hierarchically?
- Does tool design prevent common errors?
- Can the agent self-correct through feedback loops?

### 6.2 User Experience (UX)

*How well can developers understand and act on analysis results?*

- Can issues be traced to their origin?
- Are recommendations actionable and well-explained?
- Is improvement visible over time?
- Is the developer consulted before changes?

### 6.3 Developer Experience (DX)

*How observable, maintainable, and extensible is the system?*

- Are results reproducible?
- Is the tool modular and testable?
- Can new ACTs be added without core changes?
- Is the architecture documented and understandable?

**Key Insight**: What the agent needs differs from what humans need. The architecture serves both through appropriate abstraction: agent receives distilled context; users receive rich, explainable output.

---

## 7. Quality Attributes

### 7.1 Derived from Constitution Principles

| Principle | Architectural Implication |
|-----------|--------------------------|
| I. Local-First | No external data transmission; user owns credentials |
| II. Improvement-Oriented | Baseline storage and comparison are core capabilities |
| III. Causal-First | Session indexing with position markers; evidence chain tracking |
| IV. Mixed-Methods | Static tools + agentic reasoning; no forced pipelines |
| V. Language-Agnostic | Core analysis independent of programming language |
| VI. Agent-Agnostic | Adapter pattern for ACT abstraction |
| VII. Intelligent Tooling | Tools serve agent; agent chooses freely |
| VIII. Compounding Value | Global learnings; recommendation effectiveness tracking |
| IX. Agent-Aware | Hierarchical context; cognitive workspace optimization |

### 7.2 Non-Functional Requirements Alignment

| NFR Category | Architectural Response |
|--------------|----------------------|
| Performance | Static layer for fast data gathering; agentic layer for depth |
| Privacy | Local-first; no telemetry; user-owned credentials |
| Extensibility | Adapter pattern; plugin architecture |
| Reliability | Checkpointing; resumability; graceful degradation |
| Usability | Progressive output; streaming; clear progress indication |

---

## 8. Architectural Invariants

These constraints must hold across all implementation decisions:

1. **Single Orchestration Authority**: The master agent maintains authoritative context and coordinates all analysis. Sub-agents may execute in parallel, but the master synthesizes results and maintains the coherent view of findings. This is about coordination authority, not prohibiting parallelism.
2. **Tool Transparency**: Agent can always see what tools returned
3. **Human Agency**: No changes without user approval
4. **Local Execution**: All analysis runs on user's machine
5. **Baseline Primacy**: Comparison to previous state is always available
6. **Graceful Degradation**: Missing data leads to partial analysis, not failure
7. **Provider Agnosticism**: LLM provider can be swapped without architecture changes
8. **Bounded Delegation**: Sub-agents operate within defined constraints (depth limits, scoped context, focused tools) to prevent uncontrolled proliferation while enabling effective parallelism

---

## 9. Relationship to External Standards

### 9.1 Model Context Protocol (MCP)

MCP provides a standardized way to connect AI models to tools and data sources. agentlint's tool layer is conceptually compatible with MCP:

- Tool definitions can be expressed as MCP tools
- MCP servers could provide additional data sources
- Future extensibility through MCP ecosystem

**Decision Point**: Whether to adopt MCP as the primary tool interface or maintain a custom layer with optional MCP bridging.

### 9.2 AGENTS.md Standard

The emerging AGENTS.md standard for cross-tool agent instructions aligns with agentlint's agent-agnostic principle. agentlint should:

- Analyze AGENTS.md files when present
- Consider AGENTS.md as a configuration source
- Generate AGENTS.md recommendations where appropriate

### 9.3 Agent Skills Standard

[Agent Skills](https://agentskills.io) is an open standard originally developed by Anthropic for packaging procedural knowledge that AI agents can discover and use. Skills are portable, version-controlled packages of instructions, scripts, and resources that work across multiple agent products.

#### What Agent Skills Provide

| Capability | Description |
|------------|-------------|
| **Procedural Knowledge** | Step-by-step instructions for specific tasks |
| **Domain Expertise** | Specialized knowledge packaged as reusable instructions |
| **New Capabilities** | Extend agent abilities (creating presentations, analyzing datasets, etc.) |
| **Repeatable Workflows** | Multi-step tasks as consistent, auditable processes |
| **Interoperability** | Same skill works across skills-compatible agents |

#### SKILL.md Format

A skill is a directory containing at minimum a `SKILL.md` file with YAML frontmatter and Markdown instructions:

```
skill-name/
├── SKILL.md           # Required: metadata + instructions
├── scripts/           # Optional: executable code (Python, Bash, JS)
├── references/        # Optional: additional documentation
└── assets/            # Optional: templates, data files
```

**Progressive Disclosure Model**:
| Level | Content | When Loaded |
|-------|---------|-------------|
| Metadata | name + description (~100 tokens) | At startup for all skills |
| Body | Main SKILL.md (<5,000 tokens recommended) | When skill activated |
| Supporting | Scripts, references, assets | On demand only |

#### Adoption

Agent Skills are supported by leading AI development tools including Claude Code, Cursor, VS Code (Copilot), GitHub, OpenAI Codex, Gemini CLI, and others—making it a true cross-platform standard.

#### Relevance to agentlint

Agent Skills are significant to agentlint in multiple ways:

1. **Analysis Target**: agentlint should detect and analyze SKILL.md files as part of ACT configuration assessment
2. **Quality Assessment**: Evaluate skill quality (description clarity, size limits, structure)
3. **Recommendation Format**: agentlint's own recommendations could be packaged as Agent Skills
4. **agentlint as a Skill**: agentlint's analysis capabilities could be exposed as an Agent Skill, enabling other agents to invoke agentlint analysis

**Decision Point**: Whether agentlint should be packageable as an Agent Skill itself, enabling integration into broader agent workflows.

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **ACT** | Agentic Coding Tool—tools like Claude Code, Cursor, Copilot CLI |
| **Agent** | LLM-powered system that can take actions through tool use |
| **Agent Skills** | Open standard for portable procedural knowledge packages (SKILL.md) |
| **Agentic Layer** | The reasoning component that provides understanding |
| **AX** | Agent Experience—how well architecture serves agent cognition |
| **Baseline** | Snapshot of analysis state at a point in time |
| **Causal Analysis** | Tracing issues to origin to enable prevention |
| **Global Learnings** | Insights that transfer across projects |
| **Master Loop** | Single-threaded main execution loop for agent |
| **MCP** | Model Context Protocol—standard for AI-tool integration |
| **Static Layer** | Fast, deterministic tools for data gathering |
| **Sub-Agent** | Delegated agent instance that executes focused subtasks under master coordination |
| **Working Memory** | Session-scoped context maintained during analysis |

---

## References

This conceptual architecture draws from:

- agentlint Constitution v1.2.0
- agentlint Architecture Vision v0.3
- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Anthropic: Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Claude Code Agent Architecture](https://www.zenml.io/llmops-database/claude-code-agent-architecture-single-threaded-master-loop-for-autonomous-coding)
- [Google Cloud: Agentic AI Design Patterns](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system)
- [Model Context Protocol](https://docs.anthropic.com/en/docs/build-with-claude/mcp)
- [Agent Skills Standard](https://agentskills.io)
- [AWS: Agents as Tools Pattern](https://dev.to/aws/build-multi-agent-systems-using-the-agents-as-tools-pattern-jce)
- ReAct: Synergizing Reasoning and Acting in Language Models (Yao et al., 2023)

---

*This document defines the conceptual architecture for agentlint. Specific technology selections and implementation details will be captured in Architecture Decision Records (ADRs) following research and evaluation against these concepts.*
