# Functional Requirements

> Derived from architecture vision, use cases, and research (January 2026)

---

## FR-1: ACT Configuration Analysis

### FR-1.1: Configuration Detection
- FR-1.1.1: Detect CLAUDE.md files (root, nested directories, global ~/.claude/)
- FR-1.1.2: Detect AGENTS.md files
- FR-1.1.3: Detect .claude/ directory structure (settings.json, commands/)
- FR-1.1.4: Detect Agent Skills (SKILL.md files)
- FR-1.1.5: [Secondary] Detect Copilot CLI configuration
- FR-1.1.6: [Secondary] Detect OpenAI Codex configuration
- FR-1.1.7: [Future] Detect .cursor/rules/*.mdc and .cursorrules
- FR-1.1.8: [Future] Detect .aiderrules

### FR-1.2: Configuration Parsing
- FR-1.2.1: Parse CLAUDE.md markdown structure (sections, headings, code blocks)
- FR-1.2.2: Parse JSON settings files with schema validation
- FR-1.2.3: Extract configuration metrics (length, sections, keywords)
- FR-1.2.4: Identify configuration hierarchy (global → project → local)

### FR-1.3: Configuration Quality Assessment
- FR-1.3.1: Assess length (too short = missing guidance, too long = context bloat)
- FR-1.3.2: Assess structure (sections, progressive disclosure)
- FR-1.3.3: Detect secrets and credentials (API keys, tokens, passwords)
- FR-1.3.4: Check for conflicting guidance across config files
- FR-1.3.5: Evaluate instruction clarity (MUST, IMPORTANT keywords)
- FR-1.3.6: Assess completeness against best practices checklist

---

## FR-2: Documentation Quality Analysis

### FR-2.1: Documentation Discovery
- FR-2.1.1: Locate README.md files at all levels
- FR-2.1.2: Locate architecture documentation (docs/, ARCHITECTURE.md)
- FR-2.1.3: Identify llms.txt or similar AI-focused indexes
- FR-2.1.4: Discover in-code documentation (docstrings, JSDoc, etc.)

### FR-2.2: Documentation Assessment
- FR-2.2.1: Evaluate README completeness (purpose, setup, usage, examples)
- FR-2.2.2: Assess hierarchical structure (overview → details → reference)
- FR-2.2.3: Measure documentation size relative to context windows
- FR-2.2.4: Detect cross-document inconsistencies
- FR-2.2.5: Evaluate progressive disclosure patterns
- FR-2.2.6: Check discoverability (index files, navigation)

---

## FR-3: Quality Guardrails Analysis

### FR-3.1: Static Analysis Detection
- FR-3.1.1: Detect linter configuration (ESLint, Pylint, Clippy, etc.)
- FR-3.1.2: Detect formatter configuration (Prettier, Black, etc.)
- FR-3.1.3: Assess type system strictness (TypeScript strict mode, mypy, etc.)
- FR-3.1.4: Detect security scanning tools (secrets scanning, SAST)

### FR-3.2: CI/CD Integration Analysis
- FR-3.2.1: Detect CI/CD configuration (GitHub Actions, GitLab CI, etc.)
- FR-3.2.2: Identify quality gates (test requirements, coverage thresholds)
- FR-3.2.3: Detect pre-commit hook configuration
- FR-3.2.4: Identify branch protection rules

### FR-3.3: LSP Integration Assessment
- FR-3.3.1: Detect language server configuration
- FR-3.3.2: Assess LSP integration with ACT workflows

---

## FR-4: AI Session Log Analysis

**Critical distinction**: AI session logs are conversation transcripts (user prompts, AI responses, tool calls, outcomes) - NOT system/application logs. Analysis requires semantic reasoning about conversation quality, not just pattern matching.

### FR-4.1: Session Discovery and Parsing (Static Layer)
- FR-4.1.1: Locate Claude Code session logs (~/.claude/projects/)
- FR-4.1.2: Parse JSONL session format (messages, tool_calls, tool_results)
- FR-4.1.3: Extract session metadata (timestamps, project, duration)
- FR-4.1.4: Index sessions for tracing with position markers (supports FR-6)
- FR-4.1.5: Create session summaries for agent consumption (avoid raw log ingestion)

### FR-4.2: Session Metrics Extraction (Static Layer)
- FR-4.2.1: Calculate token usage (input, output, total, per-turn)
- FR-4.2.2: Count iterations/turns per task
- FR-4.2.3: Categorize tool usage distribution (read/write/bash/search)
- FR-4.2.4: Identify tool errors and retry patterns
- FR-4.2.5: Detect compression triggers (context limit approaches)
- FR-4.2.6: Calculate efficiency ratios (tokens per outcome)
- FR-4.2.7: Extract prompt patterns (question types, instruction styles)

### FR-4.3: Session Quality Assessment (Agentic Layer - requires LLM reasoning)
- FR-4.3.1: Assess whether AI understood user intent correctly
- FR-4.3.2: Identify where/why AI misunderstood requirements
- FR-4.3.3: Detect hallucination instances and their likely causes
- FR-4.3.4: Evaluate quality of AI-generated code/output
- FR-4.3.5: Assess task completion quality (not just completion status)
- FR-4.3.6: Identify prompt quality issues that led to poor outcomes
- FR-4.3.7: Trace session failures to configuration gaps
- FR-4.3.8: Evaluate agentic flow quality (was the approach sound?)

---

## FR-5: Temporal Analysis

### FR-5.1: Baseline Management
- FR-5.1.1: Capture baseline snapshot on command
- FR-5.1.2: Store baselines with timestamps
- FR-5.1.3: Support multiple baseline history
- FR-5.1.4: Enable baseline comparison

### FR-5.2: Trend Analysis
- FR-5.2.1: Calculate deltas between current state and baseline
- FR-5.2.2: Identify improvement/regression patterns
- FR-5.2.3: Correlate changes with git history
- FR-5.2.4: Track recommendation implementation status

### FR-5.3: Learning Persistence
- FR-5.3.1: Store project-level working memory
- FR-5.3.2: Support global learnings storage (~/.agentlint/learnings/)
- FR-5.3.3: Load global learnings at session start
- FR-5.3.4: Provide tool to promote learnings to global store

---

## FR-6: Causal Analysis (Agentic Layer)

**Note**: Causal analysis is fundamentally an agentic task requiring LLM reasoning. Static tools gather evidence; the agent reasons about causality.

### FR-6.1: Evidence Collection (Static + Correlation)
- FR-6.1.1: Search session logs for issue-related prompts and responses
- FR-6.1.2: Extract temporal data (when was issue first observed?)
- FR-6.1.3: Correlate with git commits (git blame, pickaxe search)
- FR-6.1.4: Capture configuration state at time of issue
- FR-6.1.5: Index sessions with position markers for agent reference

### FR-6.2: Causal Chain Reasoning (Agentic)
- FR-6.2.1: Generate structured evidence chains linking trigger → gap → mechanism → effect
- FR-6.2.2: Distinguish symptoms from root causes
- FR-6.2.3: Identify specific configuration gaps that enabled issues
- FR-6.2.4: Assess confidence levels using validation checklist (specificity, temporal, mechanistic, evidence, reproducibility, alternatives)
- FR-6.2.5: Generate counterfactual analysis ("if X were present, Y wouldn't have happened")

### FR-6.3: Pattern Recognition (Agentic + Static)
- FR-6.3.1: Identify recurring issue patterns across sessions
- FR-6.3.2: Cluster similar issues by root cause category
- FR-6.3.3: Detect systemic vs. one-off issues
- FR-6.3.4: Track issue frequency and severity over time
- FR-6.3.5: Learn from resolved issues to improve future detection

### FR-6.4: Concrete Tracing Examples
The system must handle traces like:
- "AI hallucinated API endpoint" → "llms.txt missing API reference" → "Add API docs"
- "15 iterations for simple task" → "User said 'not what I meant' 8x" → "Add domain glossary"
- "Secret in config" → "Session: 'add my API config'" → "Add credential guidance"

---

## FR-7: Recommendation Engine

### FR-7.1: Recommendation Generation
- FR-7.1.1: Generate symptomatic recommendations (fix immediate issue)
- FR-7.1.2: Generate preventive recommendations (stop recurrence)
- FR-7.1.3: Generate systemic recommendations (address root patterns)
- FR-7.1.4: Provide specific, actionable configuration changes
- FR-7.1.5: Include rationale and traced origin for each recommendation

### FR-7.2: Recommendation Management
- FR-7.2.1: Prioritize recommendations by expected impact
- FR-7.2.2: Track recommendation history
- FR-7.2.3: Detect whether recommendations were implemented
- FR-7.2.4: Correlate implementation with outcome changes

---

## FR-8: Reporting and Output

### FR-8.1: Report Formats
- FR-8.1.1: Generate terminal-friendly reports (default)
- FR-8.1.2: Generate JSON output for tooling integration
- FR-8.1.3: Generate Markdown reports
- FR-8.1.4: Provide comparison views (current vs baseline)

### FR-8.2: Visualization
- FR-8.2.1: Display trend indicators (↑ ↓ →)
- FR-8.2.2: Show causal chains (issue → origin → prevention)
- FR-8.2.3: Summarize key findings prominently

---

## FR-9: CLI Interface

### FR-9.1: Core Commands
- FR-9.1.1: `agentlint scan` - Discover ACT configurations
- FR-9.1.2: `agentlint analyse` - Run full analysis
- FR-9.1.3: `agentlint baseline` - Establish/update baseline
- FR-9.1.4: `agentlint compare` - Compare to baseline
- FR-9.1.5: `agentlint recommend` - Get improvement recommendations
- FR-9.1.6: `agentlint trace` - Trace specific issue origins
- FR-9.1.7: `agentlint validate` - Validate configuration quality
- FR-9.1.8: `agentlint learn --global` - Promote learnings to global store

### FR-9.2: Command Options
- FR-9.2.1: `--format` flag for output format (terminal, json, markdown)
- FR-9.2.2: `--sessions` flag to include session analysis
- FR-9.2.3: `--compare` flag to include baseline comparison
- FR-9.2.4: `--verbose` flag for detailed output

---

## Traceability Matrix

| Use Case | Primary FRs |
|----------|-------------|
| UC-000: Establish Baseline | FR-5.1, FR-5.3.3, FR-9.1.3 |
| UC-001: Discover Configs | FR-1.1, FR-9.1.1 |
| UC-002: Assess Config | FR-1.2, FR-1.3, FR-9.1.2 |
| UC-003: Analyse Sessions | FR-4.1, FR-4.2, FR-4.3, FR-9.1.2 |
| UC-004: Recommendations | FR-7.1, FR-7.2, FR-9.1.5 |
| UC-006: Compare to Baseline | FR-5.2, FR-9.1.4 |
| UC-007: Validate Config | FR-1.3, FR-9.1.7 |
| UC-008: Trace Issue Origins | FR-6.1, FR-6.2, FR-6.3, FR-9.1.6 |
| UC-009: Validate Recommendation Effectiveness | FR-7.2.3, FR-7.2.4 |
| UC-010: Trend Analysis | FR-5.2.1, FR-5.2.2 |
| UC-011: Persist Global Learnings | FR-5.3.2, FR-5.3.4, FR-9.1.8 |
