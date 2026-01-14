# agentlint: Architecture Vision

## A Local-First Tool for Optimising AI Coding Assistant Effectiveness

**Version**: 0.3
**Status**: Vision & Direction
**Date**: January 2026

---

## 1. Executive Summary

agentlint is a local-first command-line tool that enables continuous improvement of Agentic Software Development (AI SDLC) workflows. By establishing baselines, tracing issues to their origins, and providing preventive recommendations, it helps developers systematically optimise how they work with AI coding assistants.

**The Key Differentiator**: Traditional linters detect issues in code. agentlint focuses on the Agentic system generating the code. It does this by deeply understanding best practices in AI SDLC configuration, prompting and development practices. It uses this knowledge to traces issues within AI SDLC Session logs to their origin (which session? which prompt? which tool call? which config gap?) and recommends preventive changes. The system has an active long term memory system to retain knowledge of project level practices and learnings, ensuring value compounds because each recommendation makes future AI sessions better.

**The Core Insight**: AI SDLC workflows are only as effective as the context they receive. Most developers don't optimise this context—they use default configurations, poorly structured documentation, and miss opportunities to leverage tooling that dramatically improves AI output quality. Worse, research shows developers consistently misjudge their own AI-assisted productivity, making systematic observation essential.

**The Opportunity**: By analysing how developers interact with AI SDLC workflows and correlating this with codebase characteristics over time, we can provide specific, actionable insights that progressively improve AI SDLC workflows. The value compounds through recurring use—each analysis builds on previous baselines.

**The Approach**: An agent-orchestrated analysis strategy where:
- **The agent** decides which approach to use based on what the task requires
- **Static tools** provide deterministic data gathering (config state, session metrics, structure)
- **Agent reasoning** provides deep understanding (causality, quality judgments, semantic context)
- **Temporal tracking** enables trend detection and compounding value

Neither static tools nor direct reasoning is privileged—the agent chooses freely (Principle VII).

The tool runs entirely on the user's machine, with users configuring their own LLM API connections.

**Tagline**: From AI session chaos to systematic excellence. Trace issues, prevent recurrence, master your workflow.

---

## 2. Product Vision

### What We're Building

A command-line tool that answers the question: **"How effective is my AI coding workflow, and how is it improving over time?"**

This is not a one-time diagnostic tool. It's designed for recurring use—like performance monitoring or test coverage tracking—where value compounds through regular analysis and progressive understanding.

The tool provides:

1. **Baseline** - Capture current state with quantitative and qualitative signals
2. **Discovery** - What AI assistant configurations exist in this project?
3. **Assessment** - How effective is the current setup? What's working, what isn't?
4. **Recommendations** - Specific, actionable improvements with clear rationale
5. **Tracking** - Observe changes over time, correlate improvements with specific changes
6. **Automation** - Generated configuration files, documentation templates, and workflow improvements

### Who It's For

**Primary Users (MVP)**:
- Solo developers using AI coding assistants who want to improve their workflows
- Developers experimenting with multiple AI coding agents who need unified configuration management
- "Vibe coders" who rely heavily on AI assistance and want to maximise effectiveness

**Future Users**:
- Development teams establishing AI coding standards
- Tech leads evaluating AI coding agent effectiveness across projects
- Enterprises requiring governance and audit trails for AI-assisted development

### MVP ACT Support

agentlint analyses Agentic Coding Tools (ACTs). For MVP:

- **Primary (full support)**: Claude Code
- **Secondary (configuration detection, basic analysis)**: GitHub Copilot CLI, OpenAI Codex
- **Future**: Cursor, Aider, Windsurf, others via adapter pattern

| ACT | Config Format | Session Logs | MVP Priority |
|-----|---------------|--------------|--------------|
| Claude Code | CLAUDE.md, .claude/, JSONL logs | Rich (tokens, tool calls, cache) | Primary |
| Copilot CLI | copilot-instructions.md | Limited | Secondary |
| Codex | AGENTS.md | Developer-managed | Secondary |
| Cursor | .cursor/rules/, .cursorrules | Debug logs only | Future |
| Aider | .aiderrules, markdown | Human-readable | Future |

### Design Principles

1. **Local-First**: All analysis runs on the user's machine. No data leaves unless explicitly configured. Users provide their own LLM API credentials.

2. **Improvement-Oriented**: Every feature should support the continuous improvement cycle. Prefer capabilities that compound value over time to one-shot utilities. Baseline tracking and historical comparison are core, not afterthoughts.

3. **Causal-First**: Don't just detect issues—trace them to their origin and recommend prevention. Every detected issue should link back to a session, prompt, or config gap. Recommendations should be preventive (enable prevention of recurrence) not just symptomatic (fix immediate problem).

4. **Mixed-Methods (Agent-Orchestrated)**: Combine quantitative signals with qualitative assessment. The agent reasons about which methods to apply based on task context—guidance informs but does not constrain.

5. **Language-Agnostic**: The tool must effectively analyse projects regardless of programming language. Language-specific features should degrade gracefully for unsupported languages.

6. **Agent-Agnostic**: While initially focused on Claude Code, the architecture supports analysis of any AI coding agent through an adapter pattern.

7. **Intelligent Tooling**: Tools exist to serve the agent's cognitive needs. The agent chooses freely between tool use and direct reasoning based on what the task requires—no approach is privileged.

8. **Compounding Value**: Value compounds over time through baselines and trend analysis. Each analysis builds on previous findings, making recommendations increasingly contextual.

9. **Agent-Aware**: The agentlint agent IS the core of the system—not an enhancement. We embody the AX principles we recommend to users. The agent's cognitive experience directly determines agentlint's effectiveness.

---

## 3. What We're Analysing

The tool examines five clear analysis domains that influence ACT effectiveness:

| Domain | What We Analyze | Key Questions |
|--------|-----------------|---------------|
| **ACT Configuration** | CLAUDE.md, AGENTS.md, .cursor/, .aiderrules, Agent Skills, global/project/local hierarchy | Is the ACT well-configured? Conflicts? Gaps? |
| **Documentation Quality** | README, architecture docs, .md files, in-code docs | Does documentation support AI comprehension? Progressive disclosure? |
| **Quality Guardrails** | Static analysis, CI/CD, LSP integration, pre-commit hooks, type systems | Are there automated checks that guide ACTs toward quality? |
| **Session Effectiveness** | Session logs, token usage, iterations, outcomes, failure patterns | Was the session effective? What issues occurred? Why? |
| **Temporal Patterns** | Git history, baselines, config evolution, recommendation tracking | How is effectiveness changing? What's working? |

Each domain is analysed through both static tools (fast, deterministic) and agentic reasoning (deep understanding):

### 3.1 ACT Configuration

**What**: The configuration files, settings, and instructions that control AI coding agent behaviour.

**Configuration Types**:
- **CLAUDE.md files**: Project root, nested directories, global (~/.claude/)
- **AGENTS.md files**: Cross-tool agent instructions (emerging standard)
- **Settings hierarchy**: .claude/settings.json, .cursorrules, .aiderrules
- **Agent Skills**: SKILL.md files (portable procedural knowledge)
- **Custom commands**: .claude/commands/, slash command definitions

**Static Analysis**:
- Do configuration files exist in expected locations?
- What is the configuration hierarchy (global → project → local)?
- Are there secrets or credentials in config files?
- What is the token length of each config file?
- Are MUST/IMPORTANT keywords used appropriately?

**Agentic Analysis**:
- Is the configuration well-structured (not too long, not too short)?
- Is there conflicting or redundant guidance across files?
- Do configurations follow progressive disclosure patterns?
- Are instructions semantically clear and unambiguous?
- Does the configuration cover known failure modes?

**Configuration Gaps That Enable Issues**:

| Gap | Resulting Issue | Detection Signal |
|-----|-----------------|------------------|
| No CLAUDE.md | Agent uses generic behavior | Missing file in expected locations |
| CLAUDE.md too long | Context bloat, key instructions lost | Token count > threshold |
| No credential guidance | Secrets in code/config | Session shows secret handling without instruction |
| No domain glossary | High iteration "not what I meant" | Repeated clarification patterns |
| Conflicting instructions | Inconsistent agent behavior | Different outcomes for similar tasks |

### 3.2 Documentation Quality

**What**: How well project documentation supports AI agent comprehension.

**Documentation Types**:
- **README.md**: Project overview and entry point
- **Architecture docs**: System design, component relationships
- **llms.txt / AI indexes**: Machine-readable project summaries
- **In-code docs**: Docstrings, JSDoc, inline comments

**Static Analysis**:
- Does documentation exist at appropriate levels?
- What is the documentation size relative to context windows?
- Are there index files for navigation?
- Is there an llms.txt or similar AI-focused summary?

**Agentic Analysis**:
- Does documentation follow hierarchical structure (overview → details → reference)?
- Is terminology consistent throughout?
- Can an AI agent understand the project from README alone?
- Are pages self-contained or do they assume external context?
- Is there progressive disclosure (minimal context initially, more on demand)?
- Are cross-document references consistent and correct?

### 3.3 Quality Guardrails

**What**: Automated checks and tooling that guide AI-generated code toward quality.

**Guardrail Types**:
- **Static analysis**: Linters (ESLint, Pylint, Clippy), formatters (Prettier, Black)
- **Type systems**: TypeScript strict mode, mypy, type annotations
- **CI/CD**: GitHub Actions, GitLab CI, quality gates
- **Pre-commit hooks**: Automated checks before commits
- **Security scanning**: SAST, secrets detection, dependency auditing
- **LSP integration**: Language server configuration and capabilities

**Static Analysis**:
- Which guardrails are configured?
- What strictness level is each guardrail set to?
- Are pre-commit hooks installed and active?
- What quality gates exist in CI/CD?

**Agentic Analysis**:
- Do guardrails provide fast feedback loops for agent self-correction?
- Can AI-generated code bypass any quality controls?
- Are type errors surfaced to the agent in a useful way?
- Is there appropriate strictness for the project context?
- Do guardrails catch security issues in AI-generated code?

**Why This Matters**: AI assistants that receive type errors, lint warnings, and can navigate code via LSP features produce dramatically better output. Strict type checking constrains AI outputs and enables self-correction.

### 3.4 Session Effectiveness

**What**: The quality and efficiency of interactions between users and AI coding agents.

**Critical Distinction**: AI session logs are conversation transcripts (user prompts, AI responses, tool calls, outcomes)—NOT system/application logs. Analysis requires semantic reasoning about conversation quality, not just pattern matching.

**Static Metrics Extraction**:
- Token usage (input, output, cache creation, cache read)
- Iteration/turn counts per task
- Tool usage distribution (read/write/bash/search)
- Tool errors and retry patterns
- Compression triggers (context limit approaches)
- Session duration and timing patterns

**Agentic Quality Assessment** (requires LLM reasoning):
- Did the AI understand user intent correctly?
- Where/why did misunderstandings occur?
- Were there hallucination instances? What caused them?
- Was the quality of generated code/output acceptable?
- Was task completion quality good (not just completion status)?
- Was the agentic flow sound (good approach, not just good outcome)?

**Session Health Indicators**:
- Is the agent hitting context window limits?
- What's the ratio of successful tool uses to error recovery?
- Are there signs of cognitive overload (repeated attempts, backtracking)?
- Are sessions capturing hindsight learnings?

**Challenge**: Session logs can be very large. Analysis handles this through indexing, summarisation, and incremental processing rather than loading entire logs into context.

### 3.5 Temporal Patterns

**What**: How effectiveness changes over time and what drives improvement or regression.

**Temporal Data Sources**:
- Baseline snapshots (captured analysis state)
- Git history (commits, blame, change patterns)
- Configuration evolution (diffs over time)
- Recommendation tracking (applied vs. pending)
- Session log trends (aggregated metrics over time)

**Static Analysis**:
- Calculate deltas between current state and baseline
- Correlate configuration changes with git commits
- Track which recommendations were implemented
- Identify when issues first appeared

**Agentic Analysis**:
- Are there improvement or regression patterns?
- What changes correlate with better/worse outcomes?
- Are implemented recommendations having the expected effect?
- What's the trajectory of key effectiveness indicators?
- Are there systemic issues vs. one-off problems?

**Key Questions**:
- How is effectiveness changing over time?
- What's working? What interventions had impact?
- Are there inflection points where things improved/degraded?
- Is the project on an improving trajectory?

---

## 4. High-Level Architecture

### Architectural Foundation

**agentlint IS an agentic application.** An LLM-powered agent orchestrates all analysis, using static analysis capabilities as tools. The agent decides what to analyze, invokes tools to gather data, and synthesizes findings into recommendations.

### Two-Layer Architecture

The system has a clear separation between the agentic reasoning layer and the static analysis layer:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTIC REASONING LAYER                      │
│  The agentlint agent orchestrates analysis, synthesizes         │
│  findings, traces causality, and generates recommendations.     │
│  This IS the product - an LLM-powered continuous improvement    │
│  system that learns what works for YOUR workflow.               │
├─────────────────────────────────────────────────────────────────┤
│                    STATIC ANALYSIS LAYER                        │
│  Fast, deterministic CLI tools that gather context:             │
│  • ACT config parsing (CLAUDE.md, AGENTS.md, .cursor/, etc.)    │
│  • Session log metrics extraction                               │
│  • Git analytics and change detection                           │
│  • Documentation structure analysis                             │
│  • Language-specific tooling integration                        │
│  This layer SERVES the agent - it is not the core value.        │
└─────────────────────────────────────────────────────────────────┘
```

**Static layer** provides fast, deterministic data gathering. It extracts metrics (token counts, iteration counts, tool patterns), parses configurations, and indexes session logs. This layer can run as a standalone CLI.

**Agentic layer** provides deep understanding that static analysis cannot. It reasons about quality, traces causality, understands semantic intent, and generates contextual recommendations. This is where the core value is created.

### Component Overview

The system consists of four main layers:

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Interface                          │
│  Commands: scan, analyse, recommend, compare, baseline      │
│  Output: Terminal, JSON, Markdown                           │
├─────────────────────────────────────────────────────────────┤
│                    Analysis Agent (LLM)                     │
│                                                             │
│  The agent IS the orchestrator. It:                         │
│  • Receives analysis task from CLI                          │
│  • Reasons about what to analyze                            │
│  • Uses tools OR direct reasoning as needed                 │
│  • Synthesizes findings into insights                       │
│  • Generates recommendations                                │
│                                                             │
│  Tools: ConfigParser, SessionStats, GitQuery, ReadFile...   │
├─────────────────────────────────────────────────────────────┤
│                    AI Coding Agent Adapters                 │
│  Pluggable adapters for each AI coding assistant            │
│  Each adapter: detect, parse config, extract logs, generate │
├─────────────────────────────────────────────────────────────┤
│                    Support Services                         │
│  Storage (baselines, history) | Git | LLM Integration       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Discovery Flow**:
1. User runs scan command in a project directory
2. Agent invokes tools to scan for known AI configuration patterns
3. Detected files are parsed and validated
4. Results show what was found

**Analysis Flow**:
1. User runs analyse command
2. Agent receives task: "Analyze this project for AI coding effectiveness"
3. Agent uses tools AND direct reasoning as needed
4. Agent synthesizes findings into insights
5. Agent generates recommendations with causal understanding

**Recommendation Flow**:
1. Agent traces issues to their origin (causal analysis)
2. Agent generates preventive recommendations with rationale
3. Each recommendation has priority, traced origin, and suggested action

---

## 5. Analysis Strategy

### Agent Flexibility: Tools and Reasoning

The agent has **full autonomy** to choose its approach based on what the task requires. No approach is privileged—the agent uses tools AND direct reasoning based on what will produce the best understanding.

**Tools serve the agent's cognitive needs** by helping it understand:
- What is configured (AI config files, CLAUDE.md, etc.)
- How content is structured (docs, code, folders)
- What happened in sessions (metrics, errors, patterns)
- How things evolved (git history, baseline trends)

**Agent reasoning provides deep understanding** that tools cannot:
- **WHY** things happened (not just WHAT)
- **Quality judgments** (was this a good agentic flow? error ≠ bad)
- **Causal analysis** (what led to this outcome?)
- **Semantic understanding** (intent, context, implications)

### Available Tools

| Tool | What It Helps The Agent Understand |
|------|-----------------------------------|
| ConfigParserTool | What's configured, structure, potential issues |
| SessionStatsTool | What happened in sessions (tokens, events, patterns) |
| GitQueryTool | How things evolved, who changed what, when |
| ReadFileTool | Content of files the agent wants to analyze directly |
| LanguageAnalyzerTool | Type coverage, function metrics, language-specific info |
| FTS5SearchTool | Find specific patterns across session logs |
| BaselineQueryTool | How current state compares to past |

### When Agent Reasoning Is Essential

| Analysis Area | Why Direct Reasoning Needed |
|--------------|----------------------------|
| Session analysis | Understanding WHY errors occurred, not just that they did |
| Flow quality evaluation | Judging whether an agentic flow was good (error ≠ bad) |
| Skills assessment | Reasoning about whether better Skills would have helped |
| Configuration quality | Judging semantic clarity, not just structural validity |
| Causal tracing | Understanding root causes, not just correlations |
| Recommendation generation | Contextual, actionable suggestions |

**Example: Session Log Analysis**
- Tools CAN: Parse logs, extract metadata, identify errors, tag positions
- Tools CANNOT: Understand why errors occurred, evaluate flow quality, reason about whether better Skills would have helped
- The agent uses BOTH to produce complete understanding

### Causal Analysis: From Detection to Prevention

A key differentiator is the causal analysis model:

```
DETECT ──▶ TRACE ──▶ UNDERSTAND ──▶ RECOMMEND
```

1. **Issue Detection**: Static analysis or validation identifies an issue
2. **Origin Tracing**: Search session logs and git history for when/how it was introduced
3. **Cause Understanding**: What guidance was missing? What gap led to the issue?
4. **Preventive Recommendation**: Generate specific config changes to prevent recurrence

**Recommendation types**:

| Type | Focus | Example |
|------|-------|---------|
| Symptomatic | Address immediate issue | "Remove the API key from line 42" |
| Preventive | Enable prevention of recurrence | "Add credential guidance to CLAUDE.md" |
| Systemic | Address root patterns | "Add pre-commit hook for secret scanning" |

Preventive and systemic recommendations have higher value because they enable compounding improvement—but the developer chooses what to implement.

---

## 6. Success Indicators

How we will know if agentlint is successful. We use a mixed-methods approach—some indicators are quantitative, others qualitative.

### User Outcomes

**Quantitative signals**:
- Positive directional trends in effectiveness indicators over multiple improvement cycles
- Reduced token usage and iteration counts for comparable tasks over time
- Increased adoption of recommended practices

**Qualitative signals**:
- Users report improved understanding of their AI-assisted workflow
- Recommendations are perceived as actionable and contextually appropriate
- Analysis becomes a regular practice, not a one-time diagnostic

### Product Signals

**Leading indicators** (predict future success):
- Recurring usage patterns (users run analysis multiple times per month)
- Baseline retention (users maintain history across multiple analysis runs)
- Recommendation exploration rate (users investigate suggested improvements)

**Lagging indicators** (confirm past success):
- Improvement trends visible in user data over time
- Community contributions (templates, adapters, patterns)
- Positive qualitative feedback on insight quality

### Technical Indicators

- Analysis speed: Full scan completes in acceptable time for typical projects
- Historical query performance: Trend comparisons are responsive
- Detection accuracy: High precision in identifying AI coding agent configurations
- Signal reliability: Consistent results for unchanged inputs

### What We're Still Learning

AI-assisted development is an evolving practice. We should expect:
- Our understanding of "what matters" to evolve as we gather more data
- Some initially-promising indicators to prove less predictive than expected
- New signals to emerge that we haven't yet identified
- The need for exploratory analysis alongside structured metrics

---

## 7. agentlint Agent Design

agentlint applies Agent Experience (AX) principles not just as analysis criteria, but to its own agentic components. We "eat our own dog food"—our analysis agents should embody the same principles we recommend to users.

### 7.1 Our Agent's Cognitive Workspace

When performing agentic analysis, agentlint structures context as a hierarchical working memory:

```
┌─────────────────────────────────────────┐
│ TASK GOAL                               │
│ What are we analyzing? Why?             │
├─────────────────────────────────────────┤
│ PROJECT CONTEXT (compressed)            │
│ Detected configs, language, structure   │
├─────────────────────────────────────────┤
│ ANALYSIS PROGRESS                       │
│ Completed: [x] Config, [ ] Sessions     │
├─────────────────────────────────────────┤
│ FINDINGS                                │
│ Issues: 3, Traces: 1 in progress        │
├─────────────────────────────────────────┤
│ BASELINE (if available)                 │
│ Previous score: 72, Current: --         │
└─────────────────────────────────────────┘
```

This structure preserves task goals, decisions, and error traces while enabling adaptive compression as context grows.

### 7.2 Context Compression Strategy

For large inputs (session logs, codebases), agentlint applies hierarchical compression:

1. **Structured extraction where appropriate**: Pull metrics, counts, patterns via tools when that's the right approach
2. **Hierarchical summarization**: Coarse summary → targeted deep dives only where needed
3. **Threshold triggers**: Compress when approaching context limits
4. **Preserve critical info**: Task goals, errors, decisions, and traced origins always retained

The agent decides how to handle large inputs based on what understanding is needed—sometimes tools are faster, sometimes direct reasoning is essential.

### 7.3 AX/UX Separation

agentlint deliberately separates what our agent sees from what users see:

| Layer | Content |
|-------|---------|
| **Agent sees (AX)** | Compressed summaries, statistics, code samples, distilled findings |
| **User sees (UX)** | Full reports, traced origins with evidence, detailed recommendations, trend visualizations |

This separation prevents agent cognitive overload while maintaining user interpretability. The agent works with distilled context; the user receives rich, explainable output.

### 7.4 Learning and Improvement

**Initial approach**: Stateless for reproducibility—same input produces same output.

**Future considerations**:
- Per-project baseline memory (agent remembers previous analyses)
- Recommendation effectiveness tracking (which suggestions were adopted?)
- Meta-agent for prompt/config improvement (agentlint improves itself)
- Cross-project learning (patterns that transfer)

These align with the continuous improvement model but require careful design to maintain reproducibility.

### 7.5 Learning System Architecture

agentlint implements a hybrid learning approach:

**Project-Level Working Memory** (per analysis session):
- Stores project-specific context, findings, and recommendations
- Enables trend tracking within a single project
- Maintains baseline history for comparison
- Stored in `.agentlint/` within the project

**Global Learnings** (cross-project, generalisable):
- Stored in `~/.agentlint/learnings/`
- Loaded at session start to inform analysis
- Captures patterns that transfer across projects
- Examples: "Projects without type checking have 3x more iteration loops"

**Learning Flow**:
```
1. At session start: Load global learnings as context
2. During analysis: Use project working memory
3. At session end: Optionally promote learnings to global store
4. Tools provided: `agentlint learn --global` to persist generalisable insights
```

**What Makes a Learning Generalisable**:
- Applies to multiple projects, not just this one
- Based on observed correlation (e.g., config gap → outcome pattern)
- Validated through recurrence across contexts

---

## 8. Conclusion

agentlint addresses a genuine gap in the AI-assisted development ecosystem: the lack of tooling to help developers systematically improve their AI coding workflows over time. This is not a one-time diagnostic tool but a continuous improvement practice—like test coverage or performance monitoring—that compounds value through regular use.

**The key architectural insights**:

1. **Continuous improvement is core**: Baseline establishment, historical tracking, and trend comparison are foundational capabilities, not future enhancements. Value comes from observing change over time.

2. **Causal analysis differentiates**: Don't just detect issues—trace them to their origin and recommend preventive changes. Each recommendation makes future AI sessions better.

3. **Mixed methods matter**: Quantitative signals provide objective anchors, but qualitative assessment tells us *why* things work. The best insights emerge from correlating both.

4. **Agent flexibility**: The agent has full autonomy to use tools AND direct reasoning. Tools serve the agent's cognitive needs; no approach is privileged.

5. **Embrace uncertainty**: AI-assisted development is an evolving practice. We're developing understanding alongside our users, not just measuring against fixed benchmarks.

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **ACT (Agentic Coding Tool)** | Tools like Claude Code, Cursor, Copilot CLI, Aider, Codex that provide AI-assisted coding |
| **ACT Configuration** | Rules, memory files, and settings that shape ACT behavior (CLAUDE.md, AGENTS.md, .cursorrules, etc.) |
| **Agent** | An LLM-powered system that can take actions (read files, run commands, etc.) |
| **Agent Skills** | Portable procedural knowledge packages that work across ACTs (per agentskills.io) |
| **Agentic Analysis** | Analysis that uses LLM reasoning to assess quality and generate recommendations |
| **Baseline** | A snapshot of signals at a point in time, used for comparison in continuous improvement |
| **Causal Analysis** | Tracing issues to their origin to enable preventive recommendations |
| **Development Context** | The combined state of config, docs, tooling, and codebase that shapes ACT effectiveness |
| **Global Learnings** | Generalisable insights that transfer across projects, stored in ~/.agentlint/learnings/ |
| **Lagging Indicator** | A signal that reflects past outcomes (e.g., task completion rate) |
| **Leading Indicator** | A signal that predicts future outcomes (e.g., type coverage) |
| **Meta-Inference** | Insight that emerges from correlating multiple signals across types |
| **Mixed Methods** | Research approach combining quantitative and qualitative data |
| **Progressive Disclosure** | Pattern of providing minimal context initially, loading more on demand |
| **Qualitative Signal** | Non-numeric assessment of quality or effectiveness |
| **Quantitative Signal** | Numeric measurement that can be tracked and compared over time |
| **Session** | A single interaction period with an ACT, captured in logs |
| **Session Log** | JSONL record of interactions between a user and an AI coding assistant |
| **Static Analysis** | Code analysis without execution, using parsing and pattern matching |
| **Working Memory** | Project-specific context and learnings maintained during analysis |

## Appendix B: Related Documents

- **North Star**: `docs/north-star.md` - Mission, principles, success indicators
- **Design Questions**: `docs/design-questions.md` - Open technical decisions and implementation considerations
- **Personas**: `docs/requirements/personas.md` - User personas
- **Use Cases**: `docs/requirements/use-cases.md` - Detailed use case specifications
- **Constitution**: `.specify/memory/constitution.md` - Governing principles

## Appendix C: External Resources

- **llms.txt specification**: https://llmstxt.org/
- **AGENTS.md standard**: https://github.com/agentsmd/agents.md

---

*This document represents the vision and direction for agentlint. Implementation decisions are captured in the Design Questions document and resolved through research and prototyping.*
