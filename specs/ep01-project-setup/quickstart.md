# Quickstart: Project Setup

> For contributors getting started with agentlint development

---

## Prerequisites

- **Bun** 1.x or later ([install](https://bun.sh/docs/installation))
- **Git** for version control
- **GitHub account** (for CI/releases)

---

## Installation (Binary)

For users who just want to run agentlint:

```bash
# macOS / Linux
curl -fsSL https://agentlint.dev/install.sh | bash

# Verify installation
agentlint --version
```

Then add to your PATH:
```bash
export PATH="$HOME/.agentlint/bin:$PATH"
```

---

## Installation (npm)

Alternative for Node.js users:

```bash
# Requires Node.js 22+
npm install -g @agentlint/cli

# Verify
agentlint --version
```

---

## Development Setup

For contributors:

```bash
# Clone the repository
git clone https://github.com/Obsidian-Owl/agentlint.git
cd agentlint

# Install dependencies
bun install

# Run tests
bun test

# Run linting
bun run lint

# Build TypeScript
bun run build

# Build native binary (current platform)
bun run build:binary
```

---

## Common Tasks

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/cli.test.ts

# Run with coverage
bun test --coverage
```

### Code Quality

```bash
# Lint code
bun run lint

# Fix lint issues
bun run lint:fix

# Format code
bun run format

# Type check (no emit)
bun run typecheck
```

### Building

```bash
# Build TypeScript to dist/
bun run build

# Build native binary for current platform
bun run build:binary

# Build for all platforms (CI only)
bun run build:all
```

---

## Project Structure

```
agentlint/
├── src/                 # Source code
│   ├── cli.ts          # CLI entry point
│   └── commands/       # Command implementations
├── tests/              # Test files
├── scripts/            # Build and install scripts
├── .github/workflows/  # CI/CD configuration
├── package.json        # Project manifest
├── tsconfig.json       # TypeScript config
└── CONTRIBUTING.md     # Contribution guide
```

---

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `bun run build` | Compile TypeScript |
| `build:binary` | `bun run build:binary` | Create native executable |
| `test` | `bun test` | Run test suite |
| `lint` | `bun run lint` | Check code style |
| `lint:fix` | `bun run lint:fix` | Fix lint issues |
| `format` | `bun run format` | Format with Prettier |
| `typecheck` | `bun run typecheck` | Type check only |

---

## Troubleshooting

### Bun not found

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Reload shell
source ~/.bashrc  # or ~/.zshrc
```

### Permission denied on binary

```bash
chmod +x ~/.agentlint/bin/agentlint
```

### npm install fails (Node.js version)

```bash
# Check Node version
node --version  # Must be 22.x or higher

# Use nvm to switch
nvm use 22
```

---

## Next Steps

After EP01 setup is complete:
- EP02: Claude Agent SDK integration
- EP03: SQLite persistence layer
- EP04: CLI commands implementation
