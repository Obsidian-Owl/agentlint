---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0024: CLI Design and Help System

## Context and Problem Statement

agentlint needs a well-designed command-line interface that provides excellent developer experience across multiple use cases:

1. **First-time setup** - Interactive wizard guiding users through configuration
2. **Daily use** - Quick commands for analysis, recommendations, and tracing
3. **Automation** - Scriptable interface for CI/CD and hooks
4. **Discovery** - Help system that teaches users about capabilities

This ADR establishes:
- Command structure and naming conventions
- CLI framework selection (Bun-compatible)
- Help system design
- Shell completion strategy
- Init command workflow

### Prior ADR Influences

| ADR | Influence |
|-----|-----------|
| ADR-0001 | Bun runtime - framework must be Bun-compatible |
| ADR-0004 | TOML config, XDG paths, `agentlint init` creates config |
| ADR-0012 | Frequency modes (Calm/Regular/Active) for init wizard |
| ADR-0020 | Output modes, flags (`--output-format`, `--quiet`, `--verbose`) |
| ADR-0022 | Exit codes (0-4), CI/CD integration |
| ADR-0023 | Git hooks integration, init wizard hook selection |

## Decision Drivers

- **Human-first design**: CLI should be intuitive for humans ([clig.dev](https://clig.dev/))
- **Bun compatibility**: Framework must work with Bun runtime (ADR-0001)
- **Type safety**: TypeScript-native with strong typing
- **Progressive disclosure**: Simple default usage, advanced options available
- **Consistency**: Follow established conventions (git, npm, gh patterns)
- **Scriptability**: Support both interactive and non-interactive modes
- **Discoverability**: Help system that teaches capabilities

## Considered Options

### Command Structure
1. Subcommand-based (git/npm style)
2. Flat with flags
3. Hybrid

### CLI Framework
1. Clerc (Bun-native, strongly-typed)
2. Commander.js (popular, well-documented)
3. Oclif (enterprise-grade, plugin architecture)
4. Citty (UnJS ecosystem)

## Decision Outcome

Chosen options:
- **Command Structure**: Subcommand-based (git/npm style)
- **CLI Framework**: Clerc (Bun-native, strongly-typed)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLI ARCHITECTURE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ COMMAND STRUCTURE (Subcommand-based)                                 │   │
│  │                                                                      │   │
│  │ agentlint                                                           │   │
│  │ ├── init          # First-run wizard                                │   │
│  │ ├── analyse       # Run analysis (primary command)                  │   │
│  │ ├── baseline      # Create/manage baselines                         │   │
│  │ ├── compare       # Compare baselines                               │   │
│  │ ├── recommend     # Show recommendations                            │   │
│  │ ├── trace         # Trace issue to origin                           │   │
│  │ ├── scan          # Discover AI tools in project                    │   │
│  │ ├── hooks         # Manage git hooks                                │   │
│  │ ├── cache         # Manage analysis cache                           │   │
│  │ ├── config        # View/edit configuration                         │   │
│  │ └── completion    # Generate shell completions                      │   │
│  │                                                                      │   │
│  │ Global flags (available on all commands):                           │   │
│  │ --help, -h        # Show help                                       │   │
│  │ --version, -V     # Show version                                    │   │
│  │ --quiet, -q       # Suppress non-essential output                   │   │
│  │ --verbose, -v     # Show detailed output                            │   │
│  │ --no-color        # Disable colored output                          │   │
│  │ --output-format   # json, text, sarif, junit, markdown (ADR-0020)   │   │
│  │ --config, -c      # Path to config file                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ FRAMEWORK: CLERC                                                     │   │
│  │                                                                      │   │
│  │ Why Clerc:                                                          │   │
│  │ • Explicitly Bun-native (Node, Deno, Bun)                           │   │
│  │ • Strongly-typed (TypeScript-first)                                 │   │
│  │ • Zero dependencies                                                 │   │
│  │ • Built-in shell completion generation                              │   │
│  │ • Modern, maintained                                                │   │
│  │                                                                      │   │
│  │ import { cli, command } from 'clerc';                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Command Reference

#### Primary Commands

| Command | Description | Example |
|---------|-------------|---------|
| `agentlint init` | First-run wizard | `agentlint init` |
| `agentlint analyse` | Run analysis | `agentlint analyse --output-format json` |
| `agentlint baseline` | Manage baselines | `agentlint baseline create` |
| `agentlint compare` | Compare baselines | `agentlint compare main..HEAD` |
| `agentlint recommend` | Show recommendations | `agentlint recommend --top 5` |
| `agentlint trace` | Trace issue origin | `agentlint trace --issue "test placement"` |

#### Utility Commands

| Command | Description | Example |
|---------|-------------|---------|
| `agentlint scan` | Discover AI tools | `agentlint scan` |
| `agentlint hooks` | Manage hooks | `agentlint hooks install` |
| `agentlint cache` | Manage cache | `agentlint cache clear` |
| `agentlint config` | View/edit config | `agentlint config show` |
| `agentlint completion` | Shell completions | `agentlint completion bash` |

### Command Details

#### `agentlint init` - First-Run Wizard

The init command provides an interactive wizard for first-time setup:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ $ agentlint init                                                            │
│                                                                             │
│ Welcome to agentlint! Let's set up your project.                           │
│                                                                             │
│ STEP 1: PROJECT DETECTION                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━                                                 │
│                                                                             │
│ 🔍 Detected AI coding tools:                                               │
│    ✓ Claude Code (CLAUDE.md found)                                         │
│    ○ Cursor (not detected)                                                 │
│    ○ Aider (not detected)                                                  │
│                                                                             │
│ 📁 Project: myproject (/Users/me/myproject)                                │
│                                                                             │
│ STEP 2: FREQUENCY MODE                                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━                                                    │
│                                                                             │
│ ? How often should agentlint analyse your AI sessions?                     │
│                                                                             │
│   ○ 🌙 Calm      Weekly digest, manual trigger only (~$1-5/month)         │
│   ● ⚖️  Regular   After every 5 AI sessions (~$10-20/month) [Recommended] │
│   ○ ⚡ Active    After every AI session (~$30-50/month)                    │
│                                                                             │
│ [↑↓ to select, Enter to confirm]                                          │
│                                                                             │
│ STEP 3: HOOKS                                                              │
│ ━━━━━━━━━━━━━━                                                             │
│                                                                             │
│ Based on Regular mode, these hooks will be installed:                      │
│                                                                             │
│   ☑ Git post-push hook (analyses after pushing)                           │
│   ☐ Git post-commit hook (disabled - too frequent)                        │
│                                                                             │
│ ? Install hooks? [Y/n]                                                     │
│                                                                             │
│ STEP 4: TELEMETRY                                                          │
│ ━━━━━━━━━━━━━━━━━                                                          │
│                                                                             │
│ 📊 Help improve agentlint with anonymous usage data?                       │
│    (command timing, feature usage - never code or prompts)                 │
│                                                                             │
│ ? Enable telemetry? [y/N]                                                  │
│                                                                             │
│ STEP 5: COMPLETE                                                           │
│ ━━━━━━━━━━━━━━━━                                                           │
│                                                                             │
│ ✅ Configuration saved to .agentlint/config.toml                           │
│                                                                             │
│ Summary:                                                                    │
│   Frequency: Regular (every 5 sessions)                                    │
│   Hooks: Git post-push                                                     │
│   Telemetry: Disabled                                                      │
│   Est. cost: ~$10-20/month                                                 │
│                                                                             │
│ ? Run initial baseline now? (1-2 min, ~$0.10-0.50) [Y/n]                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Init Command Flags**:

```bash
# Interactive wizard (default)
agentlint init

# Skip wizard, use defaults (Regular mode, no telemetry)
agentlint init --defaults

# Non-interactive with specific options
agentlint init --frequency calm --no-telemetry --no-hooks

# Force reinitialize (overwrite existing config)
agentlint init --force

# Initialize global config instead of project
agentlint init --global

# Skip initial baseline
agentlint init --no-baseline
```

**Files Created**:

```
.agentlint/
├── config.toml        # Project configuration
├── state.json         # Staleness tracking (gitignored)
└── .gitignore         # Ignores state.json

.git/hooks/
└── post-push          # Git hook (if requested)
```

#### `agentlint analyse` - Primary Analysis Command

```bash
# Basic analysis
agentlint analyse

# Output formats (ADR-0020)
agentlint analyse --output-format json
agentlint analyse --output-format sarif
agentlint analyse --output-format junit

# Analysis scope
agentlint analyse --domains config,sessions  # Specific domains
agentlint analyse --model claude-haiku       # Cost control via model (ADR-0022)

# Baseline comparison
agentlint analyse --baseline ./baseline.json

# CI/CD integration (ADR-0022)
agentlint analyse --output ci                # Auto-detect CI output format

# Background execution (ADR-0023)
agentlint analyse --trigger=post-push --background --notify
```

#### `agentlint completion` - Shell Completions

```bash
# Generate bash completion
agentlint completion bash > /etc/bash_completion.d/agentlint

# Generate zsh completion
agentlint completion zsh > ~/.zsh/completions/_agentlint

# Generate fish completion
agentlint completion fish > ~/.config/fish/completions/agentlint.fish

# Show installation instructions
agentlint completion --help
```

### Help System Design

#### Tiered Help Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HELP TIERS                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ TIER 1: Root Help (agentlint --help)                                       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                      │
│                                                                             │
│ agentlint - Analyse and improve AI-assisted development workflows          │
│                                                                             │
│ USAGE                                                                       │
│   agentlint <command> [options]                                            │
│                                                                             │
│ COMMANDS                                                                    │
│   init        Set up agentlint for this project                            │
│   analyse     Run analysis on the current project                          │
│   baseline    Create or manage analysis baselines                          │
│   compare     Compare two baselines                                        │
│   recommend   Show improvement recommendations                             │
│   trace       Trace an issue to its origin                                 │
│                                                                             │
│   hooks       Manage git hooks                                             │
│   cache       Manage analysis cache                                        │
│   config      View or edit configuration                                   │
│   scan        Discover AI tools in this project                            │
│   completion  Generate shell completion scripts                            │
│                                                                             │
│ EXAMPLES                                                                    │
│   agentlint init              # Set up agentlint                           │
│   agentlint analyse           # Run analysis                               │
│   agentlint recommend --top 3 # Show top 3 recommendations                 │
│                                                                             │
│ GLOBAL OPTIONS                                                              │
│   -h, --help           Show help                                           │
│   -V, --version        Show version                                        │
│   -q, --quiet          Suppress non-essential output                       │
│   -v, --verbose        Show detailed output                                │
│   --no-color           Disable colored output                              │
│   -c, --config <path>  Path to config file                                 │
│                                                                             │
│ Learn more: https://agentlint.dev/docs                                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ TIER 2: Command Help (agentlint analyse --help)                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                            │
│                                                                             │
│ agentlint analyse - Run analysis on the current project                    │
│                                                                             │
│ USAGE                                                                       │
│   agentlint analyse [options]                                              │
│                                                                             │
│ OPTIONS                                                                     │
│   -f, --output-format <format>  Output format (text, json, sarif, junit)  │
│   -d, --domains <domains>       Comma-separated analysis domains          │
│   -b, --baseline <path>         Compare against baseline file             │
│   -m, --model <model>           Model for cost control (haiku, sonnet)    │
│                                                                             │
│ EXAMPLES                                                                    │
│   agentlint analyse                          # Full analysis               │
│   agentlint analyse --output-format json     # JSON output                 │
│   agentlint analyse --model claude-haiku     # Fast/cheap model            │
│   agentlint analyse --model claude-sonnet    # Balanced model              │
│                                                                             │
│ EXIT CODES (per ADR-0022)                                                  │
│   0  Success (analysis completed)                                          │
│   1  Critical issues found                                                 │
│   2  Warnings only                                                         │
│   3  Analysis error                                                        │
│   4  Invalid arguments                                                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ TIER 3: Contextual Error Help                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                              │
│                                                                             │
│ $ agentlint analize                                                        │
│                                                                             │
│ ❌ Unknown command: analize                                                │
│                                                                             │
│ Did you mean?                                                              │
│   agentlint analyse   # Run analysis on the current project               │
│                                                                             │
│ Run 'agentlint --help' for a list of commands.                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Help Design Principles

Per [clig.dev](https://clig.dev/) guidelines:

1. **Immediate value**: `--help` output should answer "what does this do?"
2. **Examples first**: Examples are the most-read part of help
3. **Progressive disclosure**: Brief help by default, detailed with `--help --verbose`
4. **Suggest on error**: Typo? Suggest similar commands
5. **Exit code documentation**: Document what each code means

### Error Handling UX

Per ADR-0020, errors are **conversational**, not raw codes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ $ agentlint analyse                                                         │
│                                                                             │
│ ⚠️  Analysis incomplete                                                     │
│                                                                             │
│ I couldn't connect to the Anthropic API (rate limit exceeded).             │
│ Static analysis completed successfully, but I couldn't run the             │
│ semantic analysis that provides deeper insights.                           │
│                                                                             │
│ What worked:                                                                │
│   ✓ Config detection (Claude Code configured)                              │
│   ✓ Session indexing (23 sessions found)                                   │
│   ✓ Repository metrics (TypeScript, 94% type coverage)                     │
│                                                                             │
│ What I couldn't do:                                                         │
│   ✗ Config quality assessment                                              │
│   ✗ Recommendation generation                                              │
│                                                                             │
│ 💡 Try again in a few minutes. The rate limit should reset shortly.        │
│                                                                             │
│ Partial results saved. Run 'agentlint analyse' later to retry.             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Structure

```typescript
// src/cli/index.ts
import { cli, command } from 'clerc';
import { version } from '../package.json';

const agentlint = cli('agentlint', version)
  .describe('Analyse and improve AI-assisted development workflows')
  // Global options
  .option('--quiet, -q', 'Suppress non-essential output')
  .option('--verbose, -v', 'Show detailed output')
  .option('--no-color', 'Disable colored output')
  .option('--config, -c <path>', 'Path to config file')
  .option('--output-format, -f <format>', 'Output format');

// src/cli/commands/init.ts
export const initCommand = command('init')
  .describe('Set up agentlint for this project')
  .option('--defaults', 'Skip wizard, use default settings')
  .option('--frequency <mode>', 'Analysis frequency (calm, regular, active)')
  .option('--no-telemetry', 'Disable telemetry')
  .option('--no-hooks', 'Skip hook installation')
  .option('--force', 'Overwrite existing configuration')
  .option('--global', 'Initialize global config instead of project')
  .option('--no-baseline', 'Skip initial baseline creation')
  .action(async (options) => {
    if (options.defaults) {
      return runNonInteractiveInit(options);
    }
    return runInteractiveWizard(options);
  });

// src/cli/commands/analyse.ts
export const analyseCommand = command('analyse')
  .describe('Run analysis on the current project')
  .option('--domains, -d <domains>', 'Comma-separated analysis domains')
  .option('--baseline, -b <path>', 'Compare against baseline file')
  .option('--model, -m <model>', 'Model for cost control (claude-haiku, claude-sonnet)')
  .option('--trigger <trigger>', 'Trigger source (manual, post-push, ci)')
  .option('--background', 'Run in background mode')
  .option('--notify', 'Send desktop notification on completion')
  .action(async (options) => {
    const renderer = createRenderer(detectOutputMode(options));
    return runAnalysis(options, renderer);
  });

// src/cli/commands/completion.ts
export const completionCommand = command('completion')
  .describe('Generate shell completion scripts')
  .argument('<shell>', 'Shell to generate completion for (bash, zsh, fish)')
  .option('--install', 'Show installation instructions')
  .action(async (shell, options) => {
    if (options.install) {
      return showInstallInstructions(shell);
    }
    return generateCompletion(shell);
  });

// Register all commands
agentlint
  .command(initCommand)
  .command(analyseCommand)
  .command(baselineCommand)
  .command(compareCommand)
  .command(recommendCommand)
  .command(traceCommand)
  .command(scanCommand)
  .command(hooksCommand)
  .command(cacheCommand)
  .command(configCommand)
  .command(completionCommand);

// Run CLI
agentlint.parse();
```

### Flag Conventions

Following [clig.dev](https://clig.dev/) and industry standards:

| Pattern | Convention | Example |
|---------|------------|---------|
| Help | `-h, --help` | `agentlint --help` |
| Version | `-V, --version` | `agentlint --version` |
| Quiet | `-q, --quiet` | `agentlint analyse -q` |
| Verbose | `-v, --verbose` | `agentlint analyse -v` |
| Force | `-f, --force` | `agentlint init --force` |
| Dry run | `-n, --dry-run` | `agentlint hooks install -n` |
| JSON output | `--json` | `agentlint analyse --json` |
| Config file | `-c, --config` | `agentlint -c ./config.toml` |
| Output format | `-f, --output-format` | `agentlint analyse -f sarif` |

### Shell Completion Strategy

Clerc provides built-in completion generation. The `agentlint completion` command generates scripts for bash, zsh, and fish:

```bash
# Bash (add to ~/.bashrc)
eval "$(agentlint completion bash)"

# Zsh (add to ~/.zshrc)
eval "$(agentlint completion zsh)"

# Fish (auto-loaded from ~/.config/fish/completions/)
agentlint completion fish > ~/.config/fish/completions/agentlint.fish
```

**Completion Features**:
- Command names (`agentlint ana<TAB>` → `analyse`)
- Option names (`agentlint analyse --out<TAB>` → `--output-format`)
- Option values (`agentlint analyse --output-format <TAB>` → `json`, `sarif`, `junit`, `text`, `markdown`)
- File paths for path arguments

### Consequences

**Good:**
- Intuitive git/npm-style subcommand structure
- Clerc provides Bun-native, type-safe CLI framework
- Comprehensive help system with examples
- Shell completion for productivity
- Interactive wizard for first-time setup
- Non-interactive mode for automation
- Conversational error messages

**Bad:**
- Clerc is newer, smaller community than Commander.js
- Multiple subcommands to learn (though discoverable via help)
- Shell completion requires user setup

**Neutral:**
- Some flags overlap with ADR-0020 (intentional consistency)
- Init wizard adds UX complexity but reduces time-to-value

## Pros and Cons of Options

### Command Structure: Subcommand-based (Chosen)

Git/npm style with distinct commands for each operation.

- Good: Natural for multiple distinct operations
- Good: Easy to extend with new commands
- Good: Familiar to developers (git, npm, gh pattern)
- Good: Clear help per command
- Neutral: More commands to discover
- Bad: Slightly more typing than flat flags

### Command Structure: Flat with Flags

Single command with mode flags (`agentlint --analyse`).

- Good: Simpler structure
- Good: Fewer commands to remember
- Bad: Less scalable as features grow
- Bad: Harder to document
- Bad: Uncommon pattern for complex tools

### Framework: Clerc (Chosen)

Bun-native, strongly-typed CLI framework.

- Good: Explicitly supports Bun, Node, Deno
- Good: TypeScript-first with strong typing
- Good: Zero dependencies
- Good: Built-in shell completion
- Good: Modern, actively maintained
- Neutral: Smaller community than Commander.js
- Bad: Less documentation/examples available

### Framework: Commander.js

Most popular Node.js CLI framework.

- Good: Most popular, well-documented
- Good: Large community, many examples
- Good: Bun-compatible (though not native)
- Neutral: Not TypeScript-first
- Bad: Additional @types package needed
- Bad: Not explicitly Bun-native

### Framework: Oclif

Salesforce/Heroku enterprise-grade framework.

- Good: Plugin architecture for extensibility
- Good: Enterprise-tested
- Bad: Heavy dependency footprint
- Bad: Uncertain Bun compatibility
- Bad: Over-engineered for agentlint's needs

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | CLI runs locally; all data stays local |
| II. Improvement-Oriented | Yes | Init wizard captures frequency preference for continuous improvement |
| III. Causal-First | Yes | `trace` command supports origin tracing |
| IV. Mixed-Methods | Yes | Output formats support both quantitative (JSON) and qualitative (text) |
| V. Language-Agnostic | Yes | CLI design is independent of target language |
| VI. Tool-Agnostic | Yes | Commands work with any AI tool adapter |
| VII. Intelligent Tooling | Yes | CLI provides model selection for cost control |
| VIII. Compounding Value | Yes | Init wizard sets up baselines for compound improvement |
| IX. Agent-Aware | Yes | MCP mode (ADR-0020) optimizes for agent consumption |

## More Information

### Related Documents
- [ADR-0001: Language and Runtime Selection](./0001-language-and-runtime-selection.md) - Bun runtime
- [ADR-0004: Configuration File Locations](./0004-configuration-file-locations.md) - Config paths, init creates config
- [ADR-0012: Incremental Analysis Strategy](./0012-incremental-analysis-strategy.md) - Frequency modes
- [ADR-0020: Output Formats and Execution UX](./0020-output-formats-and-execution-ux.md) - Output modes, flags
- [ADR-0022: CI/CD Integration Patterns](./0022-cicd-integration-patterns.md) - Exit codes, CI output
- [ADR-0023: Git Hooks Integration](./0023-git-hooks-integration.md) - Hook installation via init
- Design Questions: [Section 7.1 - CLI Design & Help System](../../design-questions.md#71-cli-design--help-system)

### Research Sources

**CLI Design Guidelines:**
- [clig.dev - Command Line Interface Guidelines](https://clig.dev/) - Comprehensive CLI UX guide
- [Better CLI](https://bettercli.org/) - CLI design reference
- [Heroku CLI Style Guide](https://devcenter.heroku.com/articles/cli-style-guide) - Industry standard
- [Atlassian: 10 Design Principles for Delightful CLIs](https://www.atlassian.com/blog/it-teams/10-design-principles-for-delightful-clis) - Design principles
- [Evil Martians: CLI UX Progress Patterns](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays) - Progress display

**CLI Frameworks:**
- [Clerc GitHub](https://github.com/mrozio13pl/clerc) - Bun-native CLI framework
- [Commander.js vs Others](https://app.studyraid.com/en/read/11908/379336/commanderjs-vs-other-cli-frameworks) - Framework comparison
- [Stricli Alternatives](https://bloomberg.github.io/stricli/docs/getting-started/alternatives) - Bloomberg's comparison
- [Optique TypeScript CLI Parsing](https://www.blog.brightcoding.dev/2025/09/24/type-safe-cli-argument-parsing-for-typescript-an-in-depth-look-at-optique/) - Type-safe parsing

**Shell Completion:**
- [Click Shell Completion](https://click.palletsprojects.com/en/stable/shell-completion/) - Completion patterns
- [kubectl completion](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_completion/) - kubectl example
- [Docker CLI Completion](https://docs.docker.com/engine/cli/completion/) - Docker example

### Implementation Notes

#### 1. Interactive Prompting with @clack/prompts

For the init wizard, use [@clack/prompts](https://github.com/natemoo-re/clack) for beautiful interactive prompts:

```typescript
import * as p from '@clack/prompts';

async function runInteractiveWizard(): Promise<void> {
  p.intro('Welcome to agentlint!');

  const project = await p.group({
    frequency: () => p.select({
      message: 'How often should agentlint analyse your AI sessions?',
      options: [
        { value: 'calm', label: '🌙 Calm', hint: '~$1-5/month' },
        { value: 'regular', label: '⚖️ Regular (Recommended)', hint: '~$10-20/month' },
        { value: 'active', label: '⚡ Active', hint: '~$30-50/month' },
      ],
      initialValue: 'regular',
    }),
    hooks: () => p.confirm({
      message: 'Install git hooks?',
      initialValue: true,
    }),
    telemetry: () => p.confirm({
      message: 'Enable anonymous telemetry?',
      initialValue: false,
    }),
    baseline: () => p.confirm({
      message: 'Run initial baseline now?',
      initialValue: true,
    }),
  }, {
    onCancel: () => {
      p.cancel('Setup cancelled.');
      process.exit(0);
    },
  });

  p.outro('Configuration saved to .agentlint/config.toml');
}
```

#### 2. Command Aliasing

Support common aliases for convenience:

```typescript
// Aliases
agentlint.alias('a', 'analyse');     // agentlint a → agentlint analyse
agentlint.alias('i', 'init');        // agentlint i → agentlint init
agentlint.alias('r', 'recommend');   // agentlint r → agentlint recommend
```

#### 3. Version Command

```bash
$ agentlint --version
agentlint 1.0.0 (bun v1.1.0, darwin-arm64)
```

### Follow-Up Decisions

This ADR surfaces the need for:

1. **Logging & Debugging** (Section 7.2): How should `--verbose` and `--debug` work?
2. **Error Message Catalog**: Standard error messages and codes for common failures
3. **Man Pages**: Generate man pages for Unix systems
