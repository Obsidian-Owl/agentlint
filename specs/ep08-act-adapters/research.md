# Research Findings: EP08 ACT Subagents

> Deep research on AI Coding Tool architectures and context engineering best practices to inform subagent system prompts.

---

## 1. Claude Code Architecture

### 1.1 Installation & Storage

| Location | Purpose |
|----------|---------|
| `~/.claude/` | User-level storage (settings, memory, agents) |
| `~/.claude/settings.json` | User-level configuration |
| `~/.claude/CLAUDE.md` | User-level memory/instructions |
| `~/.claude/projects/` | **Session logs** (URL-encoded project paths) |
| `~/.claude/agents/` | User-level subagent definitions |
| `.claude/` | Project-level storage |
| `.claude/settings.json` | Shared project settings (git-tracked) |
| `.claude/settings.local.json` | Local overrides (auto-gitignored) |
| `.claude/skills/*/SKILL.md` | Project skills |
| `.claude/agents/` | Project subagent definitions |
| `.claude/rules/*.md` | Modular topic-specific rules |
| `CLAUDE.md` or `.claude/CLAUDE.md` | Project memory |

### 1.2 Settings Hierarchy (Precedence Order)

```
1. Managed settings (highest - cannot override)
   /Library/Application Support/ClaudeCode/  (macOS)
   /etc/claude-code/                          (Linux)
   C:\Program Files\ClaudeCode\               (Windows)

2. Command line arguments

3. Local project settings (.claude/settings.local.json)

4. Shared project settings (.claude/settings.json)

5. User settings (~/.claude/settings.json)
```

### 1.3 Memory Hierarchy

```
User Memory (~/.claude/CLAUDE.md)
     ↓ inherits from
Project Memory (CLAUDE.md or .claude/CLAUDE.md)
     ↓ inherits from
Project Rules (.claude/rules/*.md)
     ↓ can be overridden by
Local Memory (.claude/settings.local.md)
```

Memory files are:
- Loaded recursively from cwd up directory tree
- Merged with user-level memory
- Can import files using `@path/to/file` syntax (max depth: 5)

### 1.4 Agent Loop Architecture

Claude Code uses a **single-threaded master loop** (codenamed "nO"):

```
User Input
    ↓
Model Analyzes & Decides
    ↓
[Tool Needed?] → Yes → Execute Tool → Results Feed Back ↑
    ↓ No
Final Answer
    ↓
Control Returns to User
```

**Key characteristics:**
- Single main thread, flat message history
- At most one subagent branch at a time
- Tool calls: JSON → sandboxed execution → plain text results
- Compaction triggers at ~92% context usage

### 1.5 Tool Categories

| Category | Tools | Purpose |
|----------|-------|---------|
| Discovery | View, LS, Glob | Read files, list directories |
| Search | GrepTool | Regex-powered search (no embeddings) |
| Editing | Edit, Write, Replace | Surgical diffs, file operations |
| Execution | Bash | Sandboxed command execution |
| External | WebFetch, MCPs | External data access |
| Batching | BatchTool | Grouped operations |

### 1.6 Context Management

**Compactor (wU2):**
- Triggers at ~92% context window usage
- Summarizes conversation to Markdown
- Preserves architectural decisions, unresolved bugs
- Discards redundant tool outputs

**CLAUDE.md as long-term memory:**
- Loaded at conversation start
- Can be updated during sessions
- Persists across context resets

**Sources:**
- [Claude Code Overview](https://code.claude.com/docs/en/overview)
- [Claude Code Settings](https://code.claude.com/docs/en/settings)
- [Claude Code Memory](https://code.claude.com/docs/en/memory)
- [Claude Code Internals](https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/)

---

## 2. Cursor AI Architecture

### 2.1 Configuration Files

| Legacy | New Format | Purpose |
|--------|------------|---------|
| `.cursorrules` | `.cursor/rules/*.mdc` | Project rules (deprecated → migrated) |

### 2.2 MDC File Format

```yaml
---
description: RPC Service boilerplate
globs:
  - src/services/**/*.ts
alwaysApply: false
---
- Use our internal RPC pattern when defining services
- Always use snake_case for service names
```

**Frontmatter properties:**
- `description`: Natural language description for matching
- `globs`: File patterns for auto-attachment
- `alwaysApply`: Whether to always include

### 2.3 Rule Types & Precedence

1. **Local (Manual)** - Explicitly included with `@ruleName`
2. **Auto Attached** - Files matching glob patterns
3. **User Rules** - Settings > General > Rules for AI
4. **Project Rules** - `.cursor/rules/` (version-controlled)

**Sources:**
- [Cursor Rules Documentation](https://docs.cursor.com/context/rules)
- [Awesome Cursorrules](https://github.com/PatrickJS/awesome-cursorrules)

---

## 3. Aider Architecture

### 3.1 Configuration Files

| File | Purpose |
|------|---------|
| `.aider.conf.yml` | YAML configuration |
| `CONVENTIONS.md` | Coding conventions |
| `.aiderignore` | Files to ignore (gitignore syntax) |

### 3.2 Convention Loading

```yaml
# .aider.conf.yml
read:
  - CONVENTIONS.md
  - anotherfile.txt
```

Or per-session: `/read CONVENTIONS.md` or `aider --read CONVENTIONS.md`

### 3.3 Conventions Best Practices

- Keep files concise and focused
- Use bullet-point lists
- Specify library preferences
- Include code style requirements
- Load as read-only for prompt caching

**Sources:**
- [Aider Conventions](https://aider.chat/docs/usage/conventions.html)
- [Aider Configuration](https://aider.chat/docs/config.html)

---

## 4. GitHub Copilot CLI Architecture

### 4.1 Configuration Files

| File | Purpose |
|------|---------|
| `.github/copilot-instructions.md` | Repository-wide instructions |
| `.github/instructions/*.instructions.md` | Path-specific instructions |
| `AGENTS.md` | Agent rules (standard) |

### 4.2 Path-Specific Instructions

```yaml
---
applyTo: "**/*.ts,**/*.tsx"
excludeAgent: "code-review"  # Optional
---
Natural language instructions here...
```

**Glob patterns:** `src/**/*.py`, `**/*.ts,**/*.tsx`

### 4.3 Best Practices

- Instructions should be non-task-specific
- Maximum ~2 pages length
- Cover: repository summary, build/test procedures, project layout, CI/CD steps

**Sources:**
- [GitHub Copilot Custom Instructions](https://docs.github.com/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)
- [Copilot CLI Documentation](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli)

---

## 5. Context Engineering Best Practices

### 5.1 Core Principles

From Anthropic's [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents):

| Principle | Description |
|-----------|-------------|
| **Finite Resource** | Context windows degrade with size; treat as precious |
| **Quality Over Quantity** | Smallest possible set of high-signal tokens |
| **Iterative Curation** | Continuously refine as agent loops execute |
| **Context Rot** | Retrieval accuracy decreases as context expands |

### 5.2 System Prompt "Right Altitude"

**Anti-Pattern 1: Over-specification**
- Hardcoded brittle logic
- Creates fragility and maintenance overhead

**Anti-Pattern 2: Under-specification**
- Vague guidance assuming shared context
- Fails to ground model behavior

**Optimal approach:**
- Organize into distinct sections (XML tags or Markdown headers)
- Include: background, instructions, tool guidance, output format
- Start minimal; add clarifications based on failure modes
- "Minimal does not mean short" - sufficient information upfront

### 5.3 Information Hierarchy for Subagent Prompts

```
┌─────────────────────────────────────────┐
│ SYSTEM LAYER                             │
│ Core identity, capabilities, constraints │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ TASK LAYER                               │
│ Specific instructions for current task   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ TOOL LAYER                               │
│ Descriptions and usage for each tool     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ MEMORY LAYER                             │
│ Relevant historical context, learnings   │
└─────────────────────────────────────────┘
```

### 5.4 Tool Description Best Practices

- **Clarity**: Each tool's purpose and parameters unambiguous
- **Minimal Overlap**: Eliminates decision ambiguity
- **Self-containment**: Robust error handling, clear intent
- **Token Efficiency**: Returns minimal-context information

### 5.5 Memory & State Strategies

| Strategy | When to Use |
|----------|-------------|
| **Compaction** | Extensive back-and-forth conversations |
| **Structured Note-taking** | Iterative development with milestones |
| **Sub-agent Architectures** | Complex research, parallel exploration |

### 5.6 Common Pitfalls to Avoid

1. Stuffing edge cases instead of curating canonical examples
2. Bloated tool sets with ambiguous selection logic
3. Over-aggressive compaction losing subtle context
4. Agents wasting context through tool misuse
5. Assuming shared context without explicit grounding

**Sources:**
- [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)

---

## 6. Key Design Decisions for EP08

### Decision 1: Subagent Prompt Structure

**Choice**: Use hierarchical layered structure with explicit sections

**Rationale**: Aligns with context engineering best practices; provides clear separation between identity, task guidance, tool usage, and domain knowledge.

### Decision 2: Claude Code Specialist Knowledge Scope

**Choice**: Embed deep knowledge of Claude Code's file hierarchy, settings schema, and session log format

**Knowledge to include:**
- Full settings hierarchy (managed → user → project → local)
- Memory file locations and import syntax
- Session log directory structure (`~/.claude/projects/` with URL-encoded paths)
- Tool categories and their purposes
- Compaction behavior at 92% threshold

### Decision 3: Generalized Analyzer Scope

**Choice**: Focus on common patterns across ACTs

**Patterns to include:**
- AGENTS.md standard format
- Common config locations (root, .github/, hidden directories)
- Heuristics for detecting ACT type from file presence
- Graceful degradation messaging

### Decision 4: Tool Access for Subagents

**Choice**: Restrict subagents to EP05/EP06 tools only

**Rationale**:
- Subagents analyze ACT configurations, not modify them
- Read-only tools reduce risk
- Aligns with SDK's tool restriction pattern

**Tools to allow:**
- `discover_configs` - Find config files
- `parse_config` - Parse CLAUDE.md, settings.json
- `analyze_hierarchy` - Understand config precedence
- `search_sessions` - Query session logs
- `get_session_stats` - Session metrics

---

## 7. Subagent Instruction Template Structure

Based on context engineering research, each subagent prompt should follow this structure:

```markdown
# {ROLE IDENTITY}

You are {role description with expertise areas}.

## CONTEXT

{Domain knowledge the subagent needs to function}

### {ACT Name} Architecture
{File locations, hierarchies, key concepts}

### Configuration Schema
{Settings structure, precedence rules}

### Session/Log Format
{How logs are stored and structured}

## YOUR TASK

{What this subagent is responsible for analyzing}

## TOOLS AVAILABLE

{List of tools and when to use each}

## ANALYSIS APPROACH

{Step-by-step guidance on how to approach analysis}

## OUTPUT FORMAT

{How to structure findings for the orchestrator}

## IMPORTANT NOTES

{Constraints, edge cases, things to watch for}
```

This structure:
- Establishes identity at the "right altitude"
- Provides sufficient domain knowledge upfront
- Gives clear guidance without over-constraining
- Enables intelligent tool selection

---

## 8. Research Summary

| Topic | Key Finding | Impact on EP08 |
|-------|-------------|----------------|
| Claude Code Storage | Files at `~/.claude/` and `.claude/` with clear hierarchy | Subagent must know all locations |
| Settings Precedence | 5 levels: Managed > CLI > Local > Project > User | Analysis must respect hierarchy |
| Session Logs | `~/.claude/projects/` with URL-encoded paths | Subagent must handle encoding |
| Agent Loop | Single-threaded, tool → result → repeat | Subagent design aligns |
| Context Engineering | Quality > Quantity, hierarchical structure | Prompt structure follows |
| Tool Descriptions | Clear, minimal overlap, token-efficient | Tool restrictions match |
| Cursor/Aider/Copilot | Different file formats, similar patterns | Generalized analyzer viable |
