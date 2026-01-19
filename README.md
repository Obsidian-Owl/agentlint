# agentlint

[![CI](https://github.com/Obsidian-Owl/agentlint/actions/workflows/ci.yml/badge.svg)](https://github.com/Obsidian-Owl/agentlint/actions/workflows/ci.yml)
[![Release](https://github.com/Obsidian-Owl/agentlint/actions/workflows/release.yml/badge.svg)](https://github.com/Obsidian-Owl/agentlint/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/@agentlint/cli.svg)](https://www.npmjs.com/package/@agentlint/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Local-first CLI tool for continuous improvement of AI-assisted development workflows.

## Overview

agentlint traces issues to their origins and provides preventive recommendations that compound value over time. Unlike traditional linters, agentlint analyzes the AI development system itself—configuration quality, session effectiveness, and workflow optimization.

## Installation

### Binary (Recommended)

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Obsidian-Owl/agentlint/main/scripts/install.sh | bash
```

### npm

```bash
# Requires Node.js 22+
npm install -g @agentlint/cli
```

### From Source

```bash
# Requires Bun 1.x
git clone https://github.com/Obsidian-Owl/agentlint.git
cd agentlint
bun install
bun run src/cli.ts --version
```

## Usage

```bash
# Show version
agentlint --version

# Show help
agentlint --help

# Update to latest version
agentlint update
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Lint code
bun run lint

# Format code
bun run format

# Type check
bun run typecheck

# Build
bun run build
```

## Architecture

agentlint follows a 6-layer architecture:

1. **CLI** - Command-line interface
2. **Orchestration** - Claude Agent SDK integration
3. **Tools** - Analysis capabilities
4. **ACT Adapters** - Agent context tool adapters
5. **Persistence** - SQLite storage
6. **Integration** - External service connections

See [docs/architecture](docs/architecture) for detailed documentation.

## Temporal Analysis (EP09)

Track workflow effectiveness over time with mixed-methods measurement:
- **Quantitative**: Baseline capture, delta comparison, trend analysis
- **Qualitative**: Structured reviews with 6 dimensions and Likert scoring

See [`src/temporal/README.md`](src/temporal/README.md) and [`specs/ep09-temporal-analysis/quickstart.md`](specs/ep09-temporal-analysis/quickstart.md).

## License

MIT
