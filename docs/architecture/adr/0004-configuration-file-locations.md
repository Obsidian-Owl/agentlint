---
status: accepted
date: 2026-01-12
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0004: Configuration File Locations

## Context and Problem Statement

agentlint needs to store user configuration for settings like LLM provider preferences, analysis options, and output formatting. The configuration system must support both global defaults (applying to all projects) and per-project overrides. With ADR-0003 establishing XDG-compliant locations for data storage, this decision addresses configuration file locations and format.

## Decision Drivers

- **Cross-platform compatibility**: Must work on macOS (MVP), Linux, and Windows
- **User familiarity**: Follow conventions from similar CLI tools
- **Human-editability**: Configuration will be manually edited by users
- **Cascading needs**: Global defaults with per-project override capability
- **Bun ecosystem alignment**: Consistency with runtime conventions (bunfig.toml)
- **Compounding Value principle**: Tool should work with zero configuration

## Considered Options

1. XDG-compliant Global + Per-Project Override (TOML)
2. Home Directory Only (TOML)
3. Per-Project Only (TOML)
4. XDG-compliant Global + Per-Project (JSON)

## Decision Outcome

Chosen option: **"XDG-compliant Global + Per-Project Override (TOML)"** because it follows established standards, provides maximum flexibility, aligns with the Bun ecosystem (bunfig.toml), and supports both power users who want per-project customization and casual users who want global defaults.

### Configuration Locations

**Global Configuration** (user defaults):
- Linux: `$XDG_CONFIG_HOME/agentlint/config.toml` → `~/.config/agentlint/config.toml`
- macOS: `~/.config/agentlint/config.toml` (CLI tool convention)
- Windows: `%LOCALAPPDATA%\agentlint\config.toml`

**Per-Project Configuration** (project-specific overrides):
- `.agentlint/config.toml` in project root

**Resolution Order** (most specific wins):
1. Command-line flags (highest priority)
2. Environment variables (`AGENTLINT_*`)
3. Per-project config (`.agentlint/config.toml`)
4. Global config (`~/.config/agentlint/config.toml`)
5. Built-in defaults (lowest priority)

### Auto-Creation Behavior

On first run, agentlint will:
1. Create `~/.config/agentlint/config.toml` with commented defaults
2. Include inline documentation explaining each option
3. Leave all values at defaults (commented out) so users can selectively enable

### Consequences

**Good:**
- Follows XDG standard, keeping home directory clean
- TOML supports comments for inline documentation
- Cascading allows global defaults with project-specific overrides
- Consistent with Bun's bunfig.toml convention
- Cross-platform with well-defined paths per OS
- Auto-creation provides discoverability

**Bad:**
- More complex resolution logic than single-file approaches
- Users must understand two configuration locations
- Requires TOML parser dependency

**Neutral:**
- Different path conventions on Windows vs Unix-like systems
- Need to document both global and project config locations

## Pros and Cons of Options

### Option 1: XDG-compliant Global + Per-Project Override (TOML)

XDG standard locations for global config, hidden directory in project root for overrides, TOML format.

- Good: Follows established standards (XDG, Bun convention)
- Good: TOML supports comments for inline documentation
- Good: Maximum flexibility (global defaults + per-project)
- Good: Cross-platform with defined mappings
- Neutral: Requires TOML parser
- Bad: More complex resolution logic
- Bad: Two locations to understand

### Option 2: Home Directory Only (TOML)

Single `~/.agentlint/config.toml` file, no per-project configuration.

- Good: Simplest implementation
- Good: One obvious location
- Bad: Pollutes home directory (anti-XDG)
- Bad: No per-project customization
- Bad: Violates Improvement-Oriented (can't optimize per-project)

### Option 3: Per-Project Only (TOML)

Configuration only in `.agentlint/config.toml` per project, no global defaults.

- Good: Simple resolution (only one location per project)
- Good: Explicit per-project settings
- Bad: No shared defaults across projects
- Bad: Repetitive configuration
- Bad: Hurts Compounding Value (requires setup per project)

### Option 4: XDG-compliant Global + Per-Project (JSON)

Same as Option 1 but using JSON format.

- Good: Universal parsing support
- Good: No additional dependency (JSON built into every runtime)
- Bad: No comments allowed (poor for user-edited config)
- Bad: Less human-friendly syntax
- Bad: Inconsistent with Bun ecosystem (uses TOML)

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All configuration stored locally |
| II. Improvement-Oriented | Yes | Per-project overrides support optimization per codebase |
| III. Causal-First | N/A | Configuration doesn't affect tracing |
| IV. Mixed-Methods | N/A | Configuration doesn't affect analysis methods |
| V. Language-Agnostic | Yes | Configuration is independent of target language |
| VI. Tool-Agnostic | Yes | Supports configuring multiple AI tool adapters |
| VII. Intelligent Tooling | N/A | Configuration doesn't affect analysis approach |
| VIII. Compounding Value | Yes | Works with zero config, auto-creates on first run |
| IX. Agent-Aware | N/A | Configuration doesn't directly affect agent architecture |

## More Information

### Related Documents
- [ADR-0003: Local Storage Strategy](./0003-local-storage-strategy.md) - Establishes XDG locations for data/cache
- Design Questions: [Section 1.4 - Configuration File Locations](../../design-questions.md#14-configuration-file-locations)
- Design Questions: [Section 1.5 - Credential Storage](../../design-questions.md#15-credential-storage)

### Research Sources
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html) - Official specification
- [XDG Base Directory - ArchWiki](https://wiki.archlinux.org/title/XDG_Base_Directory) - Comprehensive guide
- [adrg/xdg](https://github.com/adrg/xdg) - Cross-platform XDG implementation reference
- [JSON vs YAML vs TOML 2026](https://dev.to/jsontoall_tools/json-vs-yaml-vs-toml-which-configuration-format-should-you-use-in-2026-1hlb) - Format comparison
- [Configuration Format Comparison](https://schoenwald.aero/posts/2025-05-03_configuration-format-comparison/) - Detailed analysis
- [Bun bunfig.toml](https://bun.sh/docs/runtime/bunfig) - Bun's TOML configuration
- [Biome Configuration](https://biomejs.dev/guides/configure-biome/) - Similar CLI tool pattern
- [Starship Configuration](https://starship.rs/config/) - XDG + TOML example
- [Git Config Cascading](https://git-scm.com/docs/git-config) - Cascading configuration model

### Example Configuration Structure

```toml
# ~/.config/agentlint/config.toml
# agentlint global configuration
# Uncomment and modify values to override defaults

# [llm]
# provider = "anthropic"  # anthropic, openai, or local
# model = "claude-sonnet-4-20250514"

# [analysis]
# verbosity = "normal"    # quiet, normal, verbose, debug

# [output]
# format = "terminal"     # terminal, json, markdown
# color = true

# [baseline]
# auto_create = true      # Automatically create baseline on first analysis
```

### Implementation Notes

1. **TOML Parsing**: Use `@iarna/toml` or similar for TypeScript/Bun
2. **Path Resolution**: Use `@folder/xdg` npm package for cross-platform XDG paths
3. **Merging Strategy**: Deep merge with per-project values overriding global
4. **Validation**: Validate config on load, warn on unknown keys
5. **Environment Variables**: Support `AGENTLINT_*` overrides (e.g., `AGENTLINT_LLM_PROVIDER`)
6. **Init Command**: `agentlint init` creates per-project `.agentlint/config.toml`
