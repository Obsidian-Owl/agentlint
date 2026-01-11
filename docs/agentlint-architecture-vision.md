# agentlint: Architecture Vision

## A Local-First Tool for Optimising AI Coding Assistant Effectiveness

**Version**: 0.2 (Draft for Design Phase)  
**Status**: Vision & Direction - Design Decisions Pending  
**Date**: January 2026

---

## 1. Executive Summary

agentlint is a local-first command-line tool that enables continuous improvement of AI-assisted development workflows. By establishing baselines, tracing issues to their origins, and providing preventive recommendations, it helps developers systematically optimise how they work with AI coding assistants.

**The Key Differentiator**: Traditional linters detect issues. agentlint goes further—it traces issues to their origin (which session? which prompt? which config gap?) and recommends preventive changes. Value compounds because each recommendation makes future AI sessions better.

**The Core Insight**: AI coding assistants (Claude Code, Cursor, GitHub Copilot, Codex, Gemini Code Assist) are only as effective as the context they receive. Most developers don't optimise this context—they use default configurations, poorly structured documentation, and miss opportunities to leverage tooling that dramatically improves AI output quality. Worse, research shows developers consistently misjudge their own AI-assisted productivity, making systematic observation essential.

**The Opportunity**: By analysing how developers interact with AI assistants and correlating this with codebase characteristics over time, we can provide specific, actionable insights that progressively improve AI-assisted development workflows. The value compounds through recurring use—each analysis builds on previous baselines.

**The Approach**: A mixed-methods analysis strategy that combines:
- **Quantitative signals**: Static analysis for deterministic metrics (fast, cheap, reproducible)
- **Qualitative assessment**: LLM-powered semantic analysis (nuanced understanding, contextual recommendations)
- **Temporal tracking**: Historical comparison to observe improvement trends

The tool runs entirely on the user's machine, with users configuring their own LLM API connections.

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
- Developers experimenting with multiple AI tools who need unified configuration management
- "Vibe coders" who rely heavily on AI assistance and want to maximise effectiveness

**Future Users**:
- Development teams establishing AI coding standards
- Tech leads evaluating AI tool effectiveness across projects
- Enterprises requiring governance and audit trails for AI-assisted development

### Design Principles

1. **Local-First**: All analysis runs on the user's machine. No data leaves unless explicitly configured. Users provide their own LLM API credentials.

2. **Improvement-Oriented**: Every feature should support the continuous improvement cycle. Prefer capabilities that compound value over time to one-shot utilities. Baseline tracking and historical comparison are core, not afterthoughts.

3. **Causal-First**: Don't just detect issues—trace them to their origin and recommend prevention. Every detected issue should link back to a session, prompt, or config gap. Recommendations should be preventive (stop recurrence) not just symptomatic (fix immediate problem).

4. **Mixed-Methods**: Combine quantitative signals with qualitative assessment. Neither alone tells the full story. Value exploratory analysis alongside structured metrics. Embrace uncertainty—AI-assisted development is an evolving practice.

5. **Language-Agnostic**: The tool must effectively analyse projects regardless of programming language—TypeScript, Python, Go, Rust, Java, and others.

6. **Tool-Agnostic**: While initially focused on Claude Code, the architecture supports analysis of any AI coding assistant through an adapter pattern.

7. **Static-First**: Prefer deterministic static analysis over LLM-based analysis where possible. Use LLMs only where semantic understanding is genuinely required.

8. **Progressive Value**: Provide useful insights even without LLM configuration. LLM integration enhances analysis but isn't required for basic functionality.

---

## 3. What We're Analysing

The tool examines eight interconnected areas that influence AI coding assistant effectiveness:

### 3.1 AI Assistant Configuration

**What**: The configuration files that control AI assistant behaviour.

**Files to Detect**:
- Claude Code: CLAUDE.md, settings files, hooks, commands, rules, skills
- Cursor: Legacy .cursorrules files, modern rule files with frontmatter
- GitHub Copilot: Instruction files, agent definitions, prompt templates
- OpenAI Codex: AGENTS.md, configuration files
- Gemini Code Assist: GEMINI.md, AGENT.md, style guides, configuration

**Analysis Questions**:
- Do configuration files exist? Are they in the expected locations?
- Are configurations well-structured (not too long, not too short)?
- Is there conflicting or redundant guidance?
- Are path-specific rules used appropriately?
- Do configurations follow progressive disclosure patterns?

### 3.2 AI Session Effectiveness

**What**: The logs generated by AI coding assistants during use.

**Data Sources**:
- Claude Code session logs (JSONL format in user's home directory)
- Other tools as log formats are documented or reverse-engineered

**Analysis Questions**:
- What is the completion rate for tasks? (Did the AI achieve what was asked?)
- How many turns/iterations are typically needed?
- What is the token efficiency? (Useful output relative to input)
- Which tools does the AI use most frequently?
- What error patterns emerge? Where does the AI struggle?
- Are there signs of confusion—terminology mismatches, repeated attempts?

**Challenge**: Session logs can be very large. Analysis must handle this through summarisation, sampling, or incremental processing rather than loading entire logs into context.

### 3.3 Repository Structure

**What**: How the codebase is organised and whether that organisation helps or hinders AI comprehension.

**Analysis Questions**:
- Is the folder structure logical and consistent?
- Are files appropriately sized? (Very large files are harder for AI to reason about)
- Is there clear separation of concerns?
- Are naming conventions consistent and descriptive?
- Is there unnecessary complexity or deeply nested structures?
- How discoverable are key files (entry points, configuration, tests)?

### 3.4 Developer Tooling (Agent Experience)

**What**: The tools and configurations that provide AI assistants with better context and feedback.

**Key Tooling Categories**:

**Type Systems**:
- TypeScript configuration and strictness level
- Python type hints (and type checker configuration like pyright, mypy)
- Go's built-in type system
- Other statically-typed languages

**Linters and Formatters**:
- ESLint, Prettier, Biome (JavaScript/TypeScript)
- Ruff, Black, isort (Python)
- golangci-lint (Go)
- Language-specific equivalents

**Language Servers (LSP)**:
- Which LSP servers are configured?
- Are they providing AI assistants with go-to-definition, find-references, diagnostics?

**Why This Matters**: AI assistants that receive type errors, lint warnings, and can navigate code via LSP features produce dramatically better output. TypeScript strict mode, for example, constrains AI outputs and enables self-correction through error messages.

### 3.5 DevSecOps and Quality Controls

**What**: The automated checks and balances that ensure AI-generated code meets quality standards.

**Analysis Questions**:
- Are pre-commit hooks configured? What do they check?
- Is there CI/CD pipeline? What quality gates exist?
- Are there branch protection rules requiring reviews?
- Is test coverage measured and enforced?
- Is security scanning in place (SAST, dependency scanning)?
- Can AI-generated code bypass any of these controls?

**Why This Matters**: AI assistants can generate code that passes initial review but contains subtle issues. Robust DevSecOps practices catch these issues regardless of whether code was written by a human or AI.

### 3.6 Documentation Quality

**What**: How well documentation supports AI agent comprehension through progressive disclosure.

**Files to Analyse**:
- README files
- Documentation directories
- Architecture Decision Records (ADRs)
- API documentation (OpenAPI specs, etc.)
- llms.txt files (the emerging standard for LLM-friendly documentation indexes)
- AGENTS.md files (the cross-tool standard for agent instructions)

**Analysis Questions**:
- Does documentation exist? Is it current?
- Is there a clear hierarchy (overview → details → reference)?
- Are pages self-contained or do they assume context from other pages?
- Is terminology consistent throughout?
- Can an AI agent understand the project from README alone?
- Is there an llms.txt index for efficient documentation discovery?
- Are code examples complete and runnable?

### 3.7 Code Patterns

**What**: Code-level characteristics that affect AI comprehension and generation quality.

**Analysis Questions**:
- What is the type annotation coverage?
- Are functions appropriately sized? (Very long functions are harder to reason about)
- Is there documentation (docstrings, JSDoc, etc.) on public interfaces?
- Are imports organised logically?
- Is the code consistent in style?
- Are there complex patterns that might confuse AI assistants?

### 3.8 Cross-Cutting Concerns

**What**: Additional factors that influence overall AI effectiveness.

**Analysis Questions**:
- Are there multiple AI tools configured? Do their configurations conflict?
- Is there evidence of "configuration drift" over time?
- Are there deprecated patterns being used?
- What's the overall "AI-readiness score" of the project?

---

## 4. Architecture Overview

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         agentlint CLI                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │   Commands   │  │    Output    │  │      Configuration       │  │
│  │              │  │              │  │                          │  │
│  │  • scan      │  │  • Terminal  │  │  • User preferences      │  │
│  │  • analyse   │  │  • JSON      │  │  • LLM API credentials   │  │
│  │  • recommend │  │  • Markdown  │  │  • Tool-specific config  │  │
│  │  • generate  │  │  • Reports   │  │                          │  │
│  │  • watch     │  │              │  │                          │  │
│  └──────────────┘  └──────────────┘  └────────────────────────────┘  │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                        Analysis Engine                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────┐    ┌────────────────────────────────┐  │
│  │    Static Analysers    │    │      Agentic Analysers         │  │
│  │                        │    │                                │  │
│  │  • Config detection    │    │  • Semantic assessment         │  │
│  │  • File parsing        │    │  • Recommendation generation   │  │
│  │  • Metric extraction   │    │  • Log summarisation           │  │
│  │  • Pattern matching    │    │  • Quality scoring             │  │
│  │  • AST analysis        │    │  • Natural language output     │  │
│  │                        │    │                                │  │
│  │  (No LLM required)     │    │  (Requires LLM API)            │  │
│  └────────────────────────┘    └────────────────────────────────┘  │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                      AI Tool Adapters                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Claude  │ │  Cursor  │ │ Copilot  │ │  Codex   │ │  Gemini  │  │
│  │   Code   │ │          │ │          │ │          │ │          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                                      │
│  Each adapter knows how to:                                          │
│  • Detect if the tool is present                                    │
│  • Parse its configuration files                                    │
│  • Extract session logs (where available)                           │
│  • Generate configurations in the correct format                    │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                        Support Services                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │   Storage    │  │     Git      │  │     LLM Integration      │  │
│  │              │  │              │  │                          │  │
│  │  • Analysis  │  │  • History   │  │  • Provider abstraction  │  │
│  │    cache     │  │  • Branches  │  │  • Streaming             │  │
│  │  • Session   │  │  • Commits   │  │  • Token counting        │  │
│  │    history   │  │  • Staging   │  │  • Cost tracking         │  │
│  │  • Metrics   │  │              │  │                          │  │
│  └──────────────┘  └──────────────┘  └────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Discovery Flow**:
1. User runs `agentlint scan` in a project directory
2. File system is scanned for known AI configuration file patterns
3. Detected files are parsed and validated
4. Results are presented showing what was found

**Analysis Flow**:
1. User runs `agentlint analyse`
2. Static analysers extract deterministic metrics (no LLM needed)
3. If LLM is configured, agentic analysers perform semantic assessment
4. Results are combined into a unified report with scores and findings

**Recommendation Flow**:
1. Based on analysis results, recommendations are generated
2. Each recommendation has priority, effort estimate, and rationale
3. User can choose to apply recommendations automatically where possible

---

## 5. Analysis Strategy

### The Static-First Principle

A key architectural decision is to maximise the use of static analysis before invoking LLM-based analysis. This approach:

- **Reduces cost**: Static analysis is essentially free; LLM calls have token costs
- **Improves speed**: Static analysis is deterministic and cacheable
- **Ensures reliability**: Static analysis produces consistent results
- **Maintains privacy**: No data needs to leave the user's machine for static analysis

### What Static Analysis Handles

The following can be determined without any LLM involvement:

| Analysis Area | Static Approach |
|--------------|-----------------|
| Configuration detection | File existence and location checks |
| Configuration parsing | Language-specific parsers for Markdown, YAML, TOML, JSON |
| Type system coverage | Run existing type checkers, parse their output |
| Linter error counts | Run existing linters, count results |
| Function/file metrics | Abstract Syntax Tree (AST) analysis |
| Import structure | AST analysis of import statements |
| Tooling detection | Check for configuration files (tsconfig.json, pyproject.toml, etc.) |
| Git integration | Read repository state, history, branches |
| Session log statistics | Parse JSONL, extract token counts, tool usage, error rates |

### What Requires Agentic Analysis

Some analysis genuinely requires semantic understanding:

| Analysis Area | Why LLM Needed |
|--------------|----------------|
| Architecture assessment | Understanding design patterns, judging quality |
| Documentation quality | Evaluating clarity, completeness, coherence |
| Recommendation generation | Contextual, actionable suggestions |
| Prompt effectiveness | Understanding intent, identifying ambiguity |
| Configuration quality | Judging whether instructions are clear and complete |
| Log summarisation | Extracting meaning from lengthy session transcripts |

### Hybrid Approach for Session Logs

Session logs present a particular challenge due to their potential size. The strategy:

1. **Statistical Pre-filtering**: Extract quantitative metrics without LLM (token counts, tool distribution, error frequency, timing)

2. **Phase Detection**: Identify natural phases in the session (setup, implementation, debugging, testing) using heuristics

3. **Hierarchical Summarisation**: If LLM analysis is needed, summarise each phase independently, then combine summaries into an overall assessment

4. **Targeted Retrieval**: For specific questions, use keyword and semantic search to find relevant log segments rather than processing everything

### Causal Analysis: From Detection to Prevention

A key differentiator is the causal analysis model. Traditional linters stop at detection. agentlint traces issues to their origin and recommends preventive changes.

```
DETECT ──▶ TRACE ──▶ UNDERSTAND ──▶ PREVENT
```

**Implementation approach**:

1. **Issue Detection**: Static analysis or validation identifies an issue (e.g., secret in config, high iteration session, deprecated pattern used)

2. **Origin Tracing**:
   - Search session logs for when/how the issue was introduced
   - Correlate with git history (when was content added, by AI or human?)
   - Identify the prompt or action that triggered the issue

3. **Cause Understanding**:
   - What guidance was missing from CLAUDE.md?
   - What documentation gap led to the AI making this mistake?
   - Is this a recurring pattern across sessions?

4. **Preventive Recommendation**:
   - Generate specific config changes to prevent recurrence
   - Prioritise preventive recommendations over symptomatic fixes
   - Link recommendation back to traced origin for user understanding

**Example flow**:

| Step | Example: Secret in Config |
|------|--------------------------|
| DETECT | "API key found on line 42 of CLAUDE.md" |
| TRACE | "Added in session 2024-01-10 when user prompted 'add my database config'" |
| UNDERSTAND | "CLAUDE.md has no guidance on credential handling" |
| PREVENT | "Add to CLAUDE.md: 'Never hardcode secrets. Use environment variables for all credentials.'" |

**Recommendation types**:

| Type | Focus | Value |
|------|-------|-------|
| Symptomatic | Fix immediate issue | Low (fixes symptom only) |
| Preventive | Stop recurrence | High (prevents future issues) |
| Systemic | Address root patterns | Highest (catches all variants) |

agentlint prioritises preventive and systemic recommendations because they compound value over time.

---

## 6. The "Claude Code Analysing Claude Code" Approach

### MVP Strategy

For the initial version, we are considering using Claude Code itself as the analysis engine rather than building a custom agent framework. This approach:

**Leverages existing capabilities**:
- Claude Code can read files, search codebases, and navigate project structures
- It understands its own configuration formats intimately
- It can process its own session logs with full context of what they mean

**Reduces development complexity**:
- No need to build custom tool-use orchestration
- No need to implement file reading, search, or codebase navigation
- Can focus on analysis logic rather than agent infrastructure

**Potential implementation**:
- Invoke Claude Code programmatically with analysis prompts
- Restrict available tools to read-only operations
- Use structured output (JSON) for machine-readable results
- Combine with static pre-processing for efficiency

### Considerations

**Advantages**:
- Faster path to MVP
- Battle-tested agent capabilities
- Native understanding of AI coding workflows

**Risks**:
- Dependency on Claude Code CLI stability
- Less control over agent behaviour
- May not support users who don't have Claude Code

**Alternative**: Build a custom agent using an LLM SDK (Vercel AI SDK or similar) that can work with any supported LLM provider. This offers more control but requires more development effort.

**Decision Required**: This is a key architectural decision that needs to be resolved during the design phase.

---

## 7. Language and Ecosystem Support

### Multi-Language Philosophy

The tool must analyse projects regardless of programming language. This requires:

**Language-Specific Parsers**: For AST analysis, type checking, and linting, we need to either:
- Invoke existing language-specific tools (type checkers, linters) and parse their output
- Use multi-language parsing libraries where available
- Fall back to text-based analysis for unsupported languages

**Configuration Detection**: Each language ecosystem has its own conventions:

| Language | Type Config | Lint Config | Package Config |
|----------|------------|-------------|----------------|
| TypeScript/JavaScript | tsconfig.json, jsconfig.json | eslint.config.js, biome.json | package.json |
| Python | pyrightconfig.json, pyproject.toml | ruff.toml, .flake8 | pyproject.toml, requirements.txt |
| Go | (built-in) | .golangci.yml | go.mod |
| Rust | (built-in) | clippy.toml | Cargo.toml |
| Java | (varies) | checkstyle.xml | pom.xml, build.gradle |

**Graceful Degradation**: For languages without explicit support:
- Still detect AI configuration files (CLAUDE.md works for any language)
- Still analyse documentation structure
- Still assess repository organisation
- Skip language-specific metrics

### Priority Languages for MVP

Based on AI coding assistant adoption patterns:
1. TypeScript/JavaScript (dominant in AI-assisted development)
2. Python (second most common)
3. Go (growing adoption)

Other languages can be added incrementally through the adapter pattern.

---

## 8. Design Questions

The following questions need to be explored and resolved during the detailed design phase.

### Runtime Environment

**Question**: Which runtime should the CLI be built on?

**Options**:
- Bun: Fastest startup time, native TypeScript, built-in SQLite
- Node.js: Most mature ecosystem, widest compatibility
- Deno: Strong security model, native TypeScript

**Considerations**: CLI startup time matters for developer experience. Ecosystem compatibility affects library choices.

### Analysis Engine Approach

**Question**: How should agentic analysis be implemented?

**Options**:
- Claude Code wrapper: Use Claude Code CLI as the analysis engine
- Custom agent: Build agent using LLM SDK with tool orchestration
- Hybrid: Static analysis core with optional LLM enhancement

**Considerations**: Development speed vs control vs user requirements.

### Local Storage Strategy

**Question**: How should analysis results, session history, and cache be stored?

**Options**:
- SQLite: Full query capability, single file, widely supported
- Flat files: Simpler, human-readable, no dependencies
- Hybrid: SQLite for structured data, files for large content

**Considerations**: Query patterns, export capability, storage location standards.

### LLM Provider Abstraction

**Question**: How should multiple LLM providers be supported?

**Options**:
- Vercel AI SDK: Unified interface, many providers, TypeScript-native
- LangChain: Feature-rich but heavy
- Direct SDK usage: Most control but most code
- Provider-specific adapters: Custom abstraction layer

**Considerations**: Provider coverage, streaming support, tool use capabilities.

### Session Log Analysis Strategy

**Question**: How should large session logs be processed within context limits?

**Options**:
- Hierarchical summarisation: Phase detection → per-phase summary → synthesis
- Sampling: Analyse representative portions
- Embedding-based retrieval: Vector search for relevant segments
- Streaming analysis: Process sequentially, maintain running summary

**Considerations**: Analysis quality, token costs, implementation complexity.

### Plugin Architecture

**Question**: How should support for new AI tools be added?

**Options**:
- Compiled adapters: Part of core distribution
- Runtime plugins: Dynamically loaded modules
- Configuration-based: Declarative definitions of file patterns and parsers

**Considerations**: Extensibility, maintenance burden, third-party contributions.

### Configuration File Locations

**Question**: Where should agentlint store its own configuration?

**Options**:
- XDG Base Directory Specification: Standard on Linux, adaptable elsewhere
- User home directory: Simple, universal
- Per-project configuration: Allows project-specific settings

**Considerations**: Cross-platform compatibility, user expectations, multiple project support.

### Credential Storage

**Question**: How should LLM API credentials be securely stored?

**Options**:
- System keychain: Native security, platform-specific
- Encrypted file: Portable, requires password
- Environment variables only: Simplest, user manages security

**Considerations**: Security requirements, cross-platform support, user convenience.

### Output Formats and Reporting

**Question**: What output formats should be supported?

**Options**:
- Terminal output: Human-readable, immediate feedback
- JSON: Machine-readable, scriptable
- Markdown: Shareable reports
- HTML: Rich formatting, charts

**Considerations**: Use cases, integration with other tools, complexity.

### Incremental Analysis and Caching

**Question**: How should repeated analysis be optimised?

**Options**:
- Content-addressed cache: Cache by file hash + analysis type
- Git-aware cache: Invalidate based on commits
- Time-based expiry: Simple TTL approach
- No caching: Always fresh analysis

**Considerations**: Performance, correctness, storage requirements.

---

## 9. Phased Development Approach

### Phase 1: Foundation (MVP)

**Goal**: Prove the continuous improvement concept with Claude Code analysis.

**Capabilities**:
- **Baseline establishment**: Capture initial state with quantitative and qualitative signals
- Detect Claude Code configuration files
- Parse and validate configuration syntax
- Extract session log statistics (token usage, tool distribution, iteration patterns)
- **Historical storage**: Persist analysis results for trend comparison
- Provide effectiveness indicators (both quantitative metrics and qualitative assessments)
- Generate basic recommendations
- **Trend comparison**: Compare current analysis to previous baselines

**Non-Goals for Phase 1**:
- Multi-tool support beyond Claude Code
- Deep semantic analysis requiring extensive LLM usage
- Automated fix application
- Web dashboard
- Cross-machine sync of history

### Phase 2: Analysis Depth

**Goal**: Rich analysis with actionable insights.

**Capabilities**:
- Full repository structure analysis
- Documentation quality assessment
- Developer tooling detection (LSP, linters, type systems)
- Hierarchical session log analysis
- Detailed recommendations with effort estimates

### Phase 3: Multi-Tool Support

**Goal**: Unified analysis across AI coding assistants.

**Capabilities**:
- Cursor configuration analysis
- GitHub Copilot configuration analysis
- Cross-tool consistency checking
- Configuration migration assistance
- Unified effectiveness metrics

### Phase 4: Automation and Integration

**Goal**: Seamless workflow integration.

**Capabilities**:
- Automated configuration improvements
- Pre-commit hook integration
- CI/CD workflow integration
- DevSecOps assessment
- Continuous monitoring (watch mode)

---

## 10. Open Questions

The following questions need further research or stakeholder input:

### Product Questions

1. **Pricing model**: How should the tool be monetised? Open source core with paid features? Subscription? One-time purchase?

2. **Telemetry**: Should anonymised usage data be collected to improve the tool? How to balance improvement with privacy?

3. **Community**: Should there be a public repository of configuration templates and best practices?

### Technical Questions

1. **Cursor session logs**: Are they accessible? What format? Can they be analysed similarly to Claude Code?

2. **Copilot telemetry**: GitHub Copilot doesn't expose session logs. Can effectiveness be inferred from git history and patterns?

3. **MCP integration**: Should agentlint expose itself as an MCP server so AI assistants can query it directly?

4. **Real-time analysis**: Is there value in analysing AI sessions in real-time rather than post-hoc?

### Ecosystem Questions

1. **Anthropic partnership**: Would Anthropic provide guidance, API access, or promotion for a tool that improves Claude Code effectiveness?

2. **IDE integration**: Should there be VS Code / Cursor / JetBrains extensions in addition to the CLI?

3. **Enterprise features**: What governance, audit, and compliance features would enterprises require?

---

## 11. Success Indicators

How we will know if agentlint is successful. We use a mixed-methods approach—some indicators are quantitative, others qualitative. The most valuable insights emerge from correlating signals across types.

### User Outcomes

**Quantitative signals**:
- Positive directional trends in effectiveness indicators over multiple improvement cycles
- Reduced token usage and iteration counts for comparable tasks over time
- Increased adoption of recommended practices (type coverage, documentation completeness)

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
- Detection accuracy: High precision in identifying AI tool configurations
- Signal reliability: Consistent results for unchanged inputs
- Cost efficiency: Meaningful insights per LLM token spent

### What We're Still Learning

AI-assisted development is an evolving practice. We should expect:
- Our understanding of "what matters" to evolve as we gather more data
- Some initially-promising indicators to prove less predictive than expected
- New signals to emerge that we haven't yet identified
- The need for exploratory analysis alongside structured metrics

---

## 12. Conclusion

agentlint addresses a genuine gap in the AI-assisted development ecosystem: the lack of tooling to help developers systematically improve their AI coding workflows over time. This is not a one-time diagnostic tool but a continuous improvement practice—like test coverage or performance monitoring—that compounds value through regular use.

**The key architectural insights**:

1. **Continuous improvement is core**: Baseline establishment, historical tracking, and trend comparison are foundational capabilities, not future enhancements. Value comes from observing change over time.

2. **Mixed methods matter**: Quantitative signals (tokens, iterations, coverage) provide objective anchors, but qualitative assessment (configuration clarity, documentation coherence) tells us *why* things work. The best insights emerge from correlating both.

3. **Static-first remains essential**: Extract maximum value from deterministic analysis before invoking costly LLM reasoning. This keeps the tool fast, affordable, and reliable.

4. **Embrace uncertainty**: AI-assisted development is an evolving practice. We're developing understanding alongside our users, not just measuring against fixed benchmarks.

The **Claude Code wrapper approach** for MVP offers a pragmatic path to market: instead of building complex agent infrastructure, leverage Claude Code's existing capabilities to analyse Claude Code usage. This can be expanded to custom agent implementation later if needed.

The next step is to explore the key design questions through deeper research and prototyping, then proceed with Phase 1 implementation targeting Claude Code analysis with continuous improvement capabilities from day one.

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **AI Coding Assistant** | Tools like Claude Code, Cursor, GitHub Copilot that help developers write code |
| **Agent** | An LLM-powered system that can take actions (read files, run commands, etc.) |
| **Agentic Analysis** | Analysis that uses LLM reasoning to assess quality and generate recommendations |
| **AST** | Abstract Syntax Tree - structured representation of code for analysis |
| **Baseline** | A snapshot of signals at a point in time, used for comparison in continuous improvement |
| **Context Window** | The maximum amount of text an LLM can process at once |
| **Lagging Indicator** | A signal that reflects past outcomes (e.g., bugs in production, task completion rate) |
| **Leading Indicator** | A signal that predicts future outcomes (e.g., type coverage, documentation completeness) |
| **LSP** | Language Server Protocol - standard for IDE features like go-to-definition |
| **Meta-Inference** | Insight that emerges from correlating multiple signals across quantitative and qualitative types |
| **Mixed Methods** | Research approach combining quantitative and qualitative data for richer understanding |
| **Progressive Disclosure** | Pattern of providing minimal context initially, loading more on demand |
| **Qualitative Signal** | Non-numeric assessment of quality, clarity, or effectiveness (often LLM-assessed) |
| **Quantitative Signal** | Numeric measurement that can be tracked and compared over time |
| **Session Log** | Record of interactions between a user and an AI coding assistant |
| **Static Analysis** | Code analysis without execution, using parsing and pattern matching |
| **Token** | Unit of text processing for LLMs (roughly 4 characters in English) |

## Appendix B: Related Resources

- **llms.txt specification**: https://llmstxt.org/
- **AGENTS.md standard**: https://github.com/agentsmd/agents.md
- **Claude Code documentation**: https://docs.anthropic.com/claude-code
- **Cursor documentation**: https://docs.cursor.com
- **GitHub Copilot documentation**: https://docs.github.com/copilot

---

*This document represents the current vision and direction for agentlint. All architectural decisions are subject to revision based on research, prototyping, and stakeholder feedback during the design phase.*
