# 7. Deployment View

This section describes the technical infrastructure, distribution, and installation topology for agentlint.

## 7.1 Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DEPLOYMENT TOPOLOGY                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    DEVELOPER MACHINE                                 │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                      agentlint CLI                            │  │   │
│  │  │              (Bun executable + bundled deps)                  │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  │                              │                                      │   │
│  │         ┌────────────────────┼────────────────────┐                │   │
│  │         │                    │                    │                │   │
│  │         ▼                    ▼                    ▼                │   │
│  │  ┌────────────┐      ┌────────────┐      ┌────────────┐           │   │
│  │  │  ~/.config │      │  ~/.cache  │      │~/.local/   │           │   │
│  │  │  /agentlint│      │  /agentlint│      │ share/     │           │   │
│  │  │            │      │            │      │ agentlint  │           │   │
│  │  │ config.toml│      │ cache.db   │      │ data.db    │           │   │
│  │  │ (global)   │      │ (LLM cache)│      │ (findings, │           │   │
│  │  └────────────┘      └────────────┘      │  baselines)│           │   │
│  │                                          └────────────┘           │   │
│  │                              │                                      │   │
│  │         ┌────────────────────┼────────────────────┐                │   │
│  │         │                    │                    │                │   │
│  │         ▼                    ▼                    ▼                │   │
│  │  ┌────────────┐      ┌────────────┐      ┌────────────┐           │   │
│  │  │  Project/  │      │  Project/  │      │  Project/  │           │   │
│  │  │ .agentlint/│      │ .git/hooks/│      │  CLAUDE.md │           │   │
│  │  │            │      │            │      │  (AI config)│           │   │
│  │  │ config.toml│      │ post-push  │      │            │           │   │
│  │  │ (project)  │      │ (hook)     │      │            │           │   │
│  │  └────────────┘      └────────────┘      └────────────┘           │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              │ HTTPS (user-provided credentials)           │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    EXTERNAL SERVICES (Optional)                       │  │
│  │                                                                       │  │
│  │  ┌────────────┐      ┌────────────┐      ┌────────────┐             │  │
│  │  │ Anthropic  │      │  OpenAI    │      │  GitHub    │             │  │
│  │  │ API        │      │  API       │      │  API       │             │  │
│  │  │            │      │            │      │            │             │  │
│  │  │ Claude     │      │ GPT models │      │ PR comments│             │  │
│  │  │ models     │      │            │      │ (CI only)  │             │  │
│  │  └────────────┘      └────────────┘      └────────────┘             │  │
│  │                                                                       │  │
│  │  Note: LLM provider required for analysis                             │  │
│  │        Interactive setup prompts for credentials on first use        │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7.2 Distribution Channels

### Primary: npm Package

```bash
# Global installation (recommended)
npm install -g agentlint

# Or with specific package manager
bun add -g agentlint
pnpm add -g agentlint
yarn global add agentlint
```

**Package Details:**
| Attribute | Value |
|-----------|-------|
| Package name | `agentlint` |
| Registry | npmjs.com |
| Binary name | `agentlint` |
| Entry point | `bin/agentlint` |
| License | MIT |

### Secondary: Homebrew (macOS/Linux)

```bash
# Tap and install
brew tap agentlint/agentlint
brew install agentlint
```

**Formula Details:**
| Attribute | Value |
|-----------|-------|
| Tap | `agentlint/agentlint` |
| Formula | `agentlint` |
| Dependencies | `bun` (cask dependency) |
| Update | `brew upgrade agentlint` |

### Future: Binary Releases

| Platform | Binary | Status |
|----------|--------|--------|
| macOS (arm64) | `agentlint-darwin-arm64` | Planned |
| macOS (x64) | `agentlint-darwin-x64` | Planned |
| Linux (x64) | `agentlint-linux-x64` | Planned |
| Windows (x64) | `agentlint-windows-x64.exe` | Planned |

## 7.3 File System Layout

### XDG Base Directory Compliance

| Directory | Purpose | Default Path (macOS/Linux) |
|-----------|---------|---------------------------|
| Config | Global configuration | `~/.config/agentlint/` |
| Data | Persistent storage (DB) | `~/.local/share/agentlint/` |
| Cache | Temporary data | `~/.cache/agentlint/` |
| State | Runtime state | `~/.local/state/agentlint/` |

### Environment Variable Overrides

| Variable | Default | Purpose |
|----------|---------|---------|
| `XDG_CONFIG_HOME` | `~/.config` | Config directory root |
| `XDG_DATA_HOME` | `~/.local/share` | Data directory root |
| `XDG_CACHE_HOME` | `~/.cache` | Cache directory root |
| `XDG_STATE_HOME` | `~/.local/state` | State directory root |

### Project-Level Files

```
project/
├── .agentlint/
│   ├── config.toml       # Project-specific config
│   ├── state.json        # Staleness tracking (gitignored)
│   └── .gitignore        # Ignores state.json
├── .git/
│   └── hooks/
│       ├── post-push     # agentlint hook (if installed)
│       └── post-commit   # agentlint hook (optional)
└── CLAUDE.md             # AI config (analyzed, not created)
```

## 7.4 Database Files

### SQLite Database Structure

| Database | Location | Purpose | Mode |
|----------|----------|---------|------|
| `data.db` | `~/.local/share/agentlint/` | Findings, baselines, hindsight | WAL |
| `cache.db` | `~/.cache/agentlint/` | LLM response cache | WAL |

**data.db Schema (simplified):**
```sql
-- Core analysis data
findings, baselines, hindsight_notes, causal_traces

-- Full-text search
sessions_fts, hindsight_fts

-- Project-specific memory
project_memory, analysis_checkpoints
```

**cache.db Schema (simplified):**
```sql
-- Multi-layer cache
cache_entries (key, value, layer, expires_at)
-- Layers: memory, disk, prompt
```

## 7.5 CI/CD Deployment

### GitHub Actions

```yaml
# .github/workflows/agentlint.yml
name: agentlint Analysis

on:
  pull_request:
  push:
    branches: [main]

jobs:
  analyse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install agentlint
        run: bun add -g agentlint

      - name: Run Analysis
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          AGENTLINT_MODEL: ${{ vars.AGENTLINT_MODEL || 'claude-haiku' }}
        run: |
          agentlint analyse \
            --output ci \
            --report-artifact analysis-report.json

      - name: Upload Report
        uses: actions/upload-artifact@v4
        with:
          name: agentlint-report
          path: analysis-report.json
```

### GitLab CI

```yaml
# .gitlab-ci.yml
agentlint:
  image: oven/bun:latest
  stage: test
  variables:
    AGENTLINT_MODEL: claude-haiku
  script:
    - bun add -g agentlint
    - agentlint analyse --output ci
  artifacts:
    reports:
      codequality: analysis-report.json
```

## 7.6 Runtime Requirements

### Minimum Requirements

| Requirement | Specification | Notes |
|-------------|---------------|-------|
| **Bun** | ≥1.0 | Runtime environment |
| **Node.js** | N/A | Not required (Bun is standalone) |
| **Git** | ≥2.0 | For causal tracing |
| **Disk** | ~100MB | CLI + SQLite databases |
| **Memory** | ~256MB | During analysis |

### Optional Requirements

| Requirement | Purpose | When Needed |
|-------------|---------|-------------|
| **API Key** | LLM analysis | Required for analysis |
| **Keychain** | Secure credential storage | macOS/Linux with keychain |
| **notify-send** | Desktop notifications | Linux with hooks enabled |

## 7.7 Security Considerations

### Credential Handling

| Credential | Storage Location | Access Method | ADR |
|------------|------------------|---------------|-----|
| Anthropic API Key | Env var or keychain | `ANTHROPIC_API_KEY` | [ADR-0005](../adr/0005-credential-storage-strategy.md) |
| OpenAI API Key | Env var or keychain | `OPENAI_API_KEY` | [ADR-0005](../adr/0005-credential-storage-strategy.md) |
| GitHub Token | Env var (CI only) | `GITHUB_TOKEN` | [ADR-0022](../adr/0022-cicd-integration-patterns.md) |

### File Permissions

| File | Mode | Rationale |
|------|------|-----------|
| Config files | 0644 | Readable by user |
| SQLite databases | 0600 | Private to user |
| Git hooks | 0755 | Executable |
| Cache files | 0600 | Private to user |

### Network Access

| Endpoint | Purpose | When Used |
|----------|---------|-----------|
| `api.anthropic.com` | Claude API | Analysis with Anthropic provider |
| `api.openai.com` | OpenAI API | Analysis with OpenAI provider |
| `api.github.com` | PR comments | CI/CD with GitHub |

## 7.8 Upgrade Path

### Version Migration

```bash
# Check current version
agentlint --version

# Upgrade via npm
npm update -g agentlint

# Upgrade via Homebrew
brew upgrade agentlint

# Database migrations run automatically on first use
agentlint analyse  # Triggers migration if needed
```

### Migration Strategy

| Version | Migration | Automatic |
|---------|-----------|-----------|
| 0.x → 1.0 | Schema migration | Yes |
| 1.x → 1.y | Additive changes | Yes |
| 1.x → 2.0 | Breaking changes | Prompted |

## Related ADRs

- [ADR-0002](../adr/0002-distribution-and-packaging-strategy.md) - Distribution strategy
- [ADR-0003](../adr/0003-local-storage-strategy.md) - Storage locations
- [ADR-0004](../adr/0004-configuration-file-locations.md) - Config paths
- [ADR-0005](../adr/0005-credential-storage-strategy.md) - Credential handling
- [ADR-0017](../adr/0017-versioning-and-migration-strategy.md) - Version migrations
- [ADR-0022](../adr/0022-cicd-integration-patterns.md) - CI/CD deployment
