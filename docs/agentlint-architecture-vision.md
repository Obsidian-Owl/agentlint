# agentlint: Architecture Vision

## A Local-First Tool for Optimising AI Coding Assistant Effectiveness

**Version**: 0.3
**Status**: Vision & Direction
**Date**: January 2026

---

## 1. Executive Summary

agentlint is a local-first command-line tool that enables continuous improvement of AI-assisted development workflows. By establishing baselines, tracing issues to their origins, and providing preventive recommendations, it helps developers systematically optimise how they work with AI coding assistants.

**The Key Differentiator**: Traditional linters detect issues. agentlint goes further—it traces issues to their origin (which session? which prompt? which config gap?) and recommends preventive changes. Value compounds because each recommendation makes future AI sessions better.

**The Core Insight**: AI coding assistants are only as effective as the context they receive. Most developers don't optimise this context—they use default configurations, poorly structured documentation, and miss opportunities to leverage tooling that dramatically improves AI output quality. Worse, research shows developers consistently misjudge their own AI-assisted productivity, making systematic observation essential.

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

5. **Language-Agnostic**: The tool must effectively analyse projects regardless of programming language. Language-specific features should degrade gracefully for unsupported languages.

6. **Tool-Agnostic**: While initially focused on one AI assistant, the architecture supports analysis of any AI coding assistant through an adapter pattern.

7. **Static-First**: Prefer deterministic static analysis over LLM-based analysis where possible. Use LLMs only where semantic understanding is genuinely required.

8. **Progressive Value**: Provide useful insights even without LLM configuration. LLM integration enhances analysis but isn't required for basic functionality.

---

## 3. What We're Analysing

The tool examines eight interconnected areas that influence AI coding assistant effectiveness:

### 3.1 AI Assistant Configuration

**What**: The configuration files that control AI assistant behaviour.

**Analysis Questions**:
- Do configuration files exist? Are they in the expected locations?
- Are configurations well-structured (not too long, not too short)?
- Is there conflicting or redundant guidance?
- Are path-specific rules used appropriately?
- Do configurations follow progressive disclosure patterns?

### 3.2 AI Session Effectiveness

**What**: The logs generated by AI coding assistants during use.

**Outcome Metrics**:
- What is the completion rate for tasks? (Did the AI achieve what was asked?)
- How many turns/iterations are typically needed?
- What is the token efficiency? (Useful output relative to input)

**Agent Cognitive Health**:
- Is the agent hitting context window limits (compression triggers)?
- What's the ratio of successful tool uses to error recovery?
- Are there signs of cognitive overload (repeated attempts, backtracking)?
- Is working memory being utilized effectively?

**Learning Signals**:
- Are sessions capturing hindsight learnings?
- Do repeated task types improve over time?
- What error patterns recur vs. get resolved?

**Behavioral Patterns**:
- Which tools does the AI use most frequently?
- Where does the AI struggle? What error patterns emerge?
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

### 3.4 Agent Cognitive Environment

**What**: The factors that shape the AI agent's ability to reason effectively about your codebase. This is not just tooling—it's the complete cognitive landscape the agent operates within.

**Analysis Subdomains**:

#### 3.4.1 Tooling Feedback Loop

Type systems, linters, LSP that provide AI with better context and error signals:

- **Type Systems**: Are type errors surfaced to the agent? What strictness level?
- **Linters and Formatters**: Can the agent see and respond to lint warnings?
- **Language Servers (LSP)**: Can the agent navigate code via LSP features?
- **Rapid feedback**: Is there a fast loop for self-correction?

**Why This Matters**: AI assistants that receive type errors, lint warnings, and can navigate code via LSP features produce dramatically better output. Strict type checking constrains AI outputs and enables self-correction through error messages.

#### 3.4.2 Context Organization

How configuration, documentation, and instructions are structured:

- Is context hierarchical (overview → details → reference)?
- Is information compressed appropriately (distilled vs. verbose)?
- Are critical instructions salient and unambiguous?
- Is there progressive disclosure (minimal context initially, more on demand)?

**Analysis Questions**:
- Does the CLAUDE.md follow hierarchical structure?
- Are there redundant or conflicting instructions?
- Is the configuration appropriately sized (not too long, not too short)?

#### 3.4.3 Working Memory Pressure

Factors that affect the agent's context window utilization:

- Configuration file sizes and structure
- Session log verbosity and compression
- Documentation density and relevance
- Trigger points for adaptive compression

**Analysis Questions**:
- Is the total context likely to exceed model limits?
- Are there verbose sections that could be compressed?
- Is documentation indexed for selective loading?

#### 3.4.4 Cross-Session Learning

How knowledge persists and compounds across sessions:

- Are failure modes documented for prevention?
- Is there hindsight capture (what was learned from previous sessions)?
- Do repeated patterns get resolved faster over time?
- Is knowledge reusable across projects?

**Analysis Questions**:
- Does the configuration include learnings from past issues?
- Are there documented error patterns and resolutions?
- Is there evidence of iterative improvement?

**Key Insight**: The agent is a first-class stakeholder in the development workflow. Optimizing for its cognitive experience directly improves outcomes for human users.

### 3.5 DevSecOps and Quality Controls

**What**: The automated checks and balances that ensure AI-generated code meets quality standards.

**Analysis Questions**:
- Are pre-commit hooks configured? What do they check?
- Is there CI/CD pipeline? What quality gates exist?
- Are there branch protection rules requiring reviews?
- Is test coverage measured and enforced?
- Is security scanning in place?
- Can AI-generated code bypass any of these controls?

**Why This Matters**: AI assistants can generate code that passes initial review but contains subtle issues. Robust DevSecOps practices catch these issues regardless of whether code was written by a human or AI.

### 3.6 Documentation Quality

**What**: How well documentation supports AI agent comprehension through progressive disclosure.

**Analysis Questions**:
- Does documentation exist? Is it current?
- Is there a clear hierarchy (overview → details → reference)?
- Are pages self-contained or do they assume context from other pages?
- Is terminology consistent throughout?
- Can an AI agent understand the project from README alone?
- Is there an index for efficient documentation discovery?
- Are code examples complete and runnable?

### 3.7 Code Patterns

**What**: Code-level characteristics that affect AI comprehension and generation quality.

**Analysis Questions**:
- What is the type annotation coverage?
- Are functions appropriately sized? (Very long functions are harder to reason about)
- Is there documentation on public interfaces?
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

## 4. High-Level Architecture

### Component Overview

The system consists of four main layers:

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Interface                          │
│  Commands: scan, analyse, recommend, compare, baseline      │
│  Output: Terminal, JSON, Markdown                           │
├─────────────────────────────────────────────────────────────┤
│                     Analysis Engine                         │
│  ┌─────────────────────┐    ┌─────────────────────────────┐│
│  │  Static Analysers   │    │    Agentic Analysers        ││
│  │  (No LLM required)  │    │    (Requires LLM API)       ││
│  └─────────────────────┘    └─────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                    AI Tool Adapters                         │
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
2. File system is scanned for known AI configuration patterns
3. Detected files are parsed and validated
4. Results show what was found

**Analysis Flow**:
1. User runs analyse command
2. Static analysers extract deterministic metrics
3. If LLM is configured, agentic analysers perform semantic assessment
4. Results are combined into a unified report

**Recommendation Flow**:
1. Based on analysis results, recommendations are generated
2. Issues are traced to their origin (causal analysis)
3. Preventive recommendations are prioritised
4. Each recommendation has priority, rationale, and traced origin

---

## 5. Analysis Strategy

### The Static-First Principle

Maximise the use of static analysis before invoking LLM-based analysis:

- **Reduces cost**: Static analysis is essentially free; LLM calls have token costs
- **Improves speed**: Static analysis is deterministic and cacheable
- **Ensures reliability**: Static analysis produces consistent results
- **Maintains privacy**: No data needs to leave the user's machine for static analysis

### What Static Analysis Handles

| Analysis Area | Static Approach |
|--------------|-----------------|
| Configuration detection | File existence and location checks |
| Configuration parsing | Parsers for Markdown, YAML, TOML, JSON |
| Type system coverage | Run existing type checkers, parse output |
| Linter error counts | Run existing linters, count results |
| Function/file metrics | Abstract Syntax Tree (AST) analysis |
| Git integration | Read repository state, history, branches |
| Session log statistics | Parse logs, extract token counts, tool usage |

### What Requires Agentic Analysis

| Analysis Area | Why LLM Needed |
|--------------|----------------|
| Architecture assessment | Understanding design patterns, judging quality |
| Documentation quality | Evaluating clarity, completeness, coherence |
| Recommendation generation | Contextual, actionable suggestions |
| Configuration quality | Judging whether instructions are clear and complete |
| Log summarisation | Extracting meaning from lengthy session transcripts |

### Causal Analysis: From Detection to Prevention

A key differentiator is the causal analysis model:

```
DETECT ──▶ TRACE ──▶ UNDERSTAND ──▶ PREVENT
```

1. **Issue Detection**: Static analysis or validation identifies an issue
2. **Origin Tracing**: Search session logs and git history for when/how it was introduced
3. **Cause Understanding**: What guidance was missing? What gap led to the issue?
4. **Preventive Recommendation**: Generate specific config changes to prevent recurrence

**Recommendation types**:

| Type | Focus | Value |
|------|-------|-------|
| Symptomatic | Fix immediate issue | Low (fixes symptom only) |
| Preventive | Stop recurrence | High (prevents future issues) |
| Systemic | Address root patterns | Highest (catches all variants) |

agentlint prioritises preventive and systemic recommendations because they compound value over time.

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
- Detection accuracy: High precision in identifying AI tool configurations
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

1. **Static extraction first**: Pull metrics, counts, patterns deterministically (fast, cheap, reproducible)
2. **Hierarchical summarization**: Coarse summary → targeted deep dives only where needed
3. **Threshold triggers**: Compress when approaching context limits
4. **Preserve critical info**: Task goals, errors, decisions, and traced origins always retained

This aligns with the static-first principle—maximize deterministic analysis before invoking LLM reasoning.

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

---

## 8. Conclusion

agentlint addresses a genuine gap in the AI-assisted development ecosystem: the lack of tooling to help developers systematically improve their AI coding workflows over time. This is not a one-time diagnostic tool but a continuous improvement practice—like test coverage or performance monitoring—that compounds value through regular use.

**The key architectural insights**:

1. **Continuous improvement is core**: Baseline establishment, historical tracking, and trend comparison are foundational capabilities, not future enhancements. Value comes from observing change over time.

2. **Causal analysis differentiates**: Don't just detect issues—trace them to their origin and recommend preventive changes. Each recommendation makes future AI sessions better.

3. **Mixed methods matter**: Quantitative signals provide objective anchors, but qualitative assessment tells us *why* things work. The best insights emerge from correlating both.

4. **Static-first remains essential**: Extract maximum value from deterministic analysis before invoking costly LLM reasoning. This keeps the tool fast, affordable, and reliable.

5. **Embrace uncertainty**: AI-assisted development is an evolving practice. We're developing understanding alongside our users, not just measuring against fixed benchmarks.

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **AI Coding Assistant** | Tools like Claude Code, Cursor, GitHub Copilot that help developers write code |
| **Agent** | An LLM-powered system that can take actions (read files, run commands, etc.) |
| **Agentic Analysis** | Analysis that uses LLM reasoning to assess quality and generate recommendations |
| **Baseline** | A snapshot of signals at a point in time, used for comparison in continuous improvement |
| **Causal Analysis** | Tracing issues to their origin to enable preventive recommendations |
| **Lagging Indicator** | A signal that reflects past outcomes (e.g., task completion rate) |
| **Leading Indicator** | A signal that predicts future outcomes (e.g., type coverage) |
| **Meta-Inference** | Insight that emerges from correlating multiple signals across types |
| **Mixed Methods** | Research approach combining quantitative and qualitative data |
| **Progressive Disclosure** | Pattern of providing minimal context initially, loading more on demand |
| **Qualitative Signal** | Non-numeric assessment of quality or effectiveness |
| **Quantitative Signal** | Numeric measurement that can be tracked and compared over time |
| **Session Log** | Record of interactions between a user and an AI coding assistant |
| **Static Analysis** | Code analysis without execution, using parsing and pattern matching |

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
