# Section 7: Deployment View

> Installation, development setup, and CI/CD pipeline.

**Last Updated**: January 2026
**Related Sections**: [Constraints](02-constraints.md), [Risks](11-risks-technical-debt.md)

---

## 7.1 End-User Installation

### Primary: Native Binary

```bash
curl -fsSL https://agentlint.dev/install.sh | bash
```

- Downloads pre-compiled Bun binary
- Installs to `~/.agentlint/bin/`
- Adds to PATH via shell profile
- Platforms: macOS (arm64, x64), Linux (x64)

### Secondary: npm

```bash
npm install -g agentlint
```

- Requires Node.js 20.x or 22.x
- Falls back to Node runtime

---

## 7.2 Runtime Layout

```
~/.agentlint/                    # Global storage
├── bin/agentlint                # Installed binary
├── config/                      # User preferences
├── learnings/                   # Cross-project insights
└── credentials/                 # API key config

/path/to/project/
└── .agentlint/                  # Project-local storage
    ├── baselines/               # Analysis snapshots
    ├── recommendations/         # Tracked recommendations
    ├── learnings/               # Project-specific insights
    ├── session-state/           # Checkpoints
    ├── sessions.db              # Session log index
    └── baselines.db             # Baseline metadata
```

---

## 7.3 Developer Setup

```bash
git clone https://github.com/[org]/agentlint.git
cd agentlint
bun install
bun test
```

### Build Targets

| Command | Output |
|---------|--------|
| `bun run build` | TypeScript compilation |
| `bun run build:binary` | Native binary (bun compile) |
| `bun run build:npm` | npm package |

### Project Structure

```
agentlint/
├── src/
│   ├── cli/              # CLI layer
│   ├── orchestration/    # Agent loop
│   ├── tools/            # Tool definitions
│   ├── adapters/         # ACT adapters
│   ├── persistence/      # Storage layer
│   └── integration/      # External interfaces
├── tests/
├── docs/
└── .specify/             # Speckit templates
```

---

## 7.4 CI/CD Pipeline

### On Push/PR

1. Lint (ESLint + Prettier)
2. Type Check (`tsc --noEmit`)
3. Unit Tests (`bun test`)
4. Integration Tests
5. Build verification

### On Release

1. All checks above
2. Build binaries (macOS arm64, macOS x64, Linux x64)
3. Build npm package
4. Publish to npm
5. Upload to GitHub releases
6. Update install script
