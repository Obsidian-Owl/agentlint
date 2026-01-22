# Contributing to agentlint

Thank you for your interest in contributing to agentlint!

## Prerequisites

- **Bun** 1.x or later - [Install Bun](https://bun.sh/docs/installation)
- **Git** for version control
- **Node.js** 22+ (optional, for npm compatibility testing)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Obsidian-Owl/agentlint.git
cd agentlint
```

### 2. Install Dependencies

```bash
bun install
```

This should complete in under 30 seconds.

### 3. Verify Setup

```bash
# Run tests
bun test

# Check types
bun run typecheck

# Lint code
bun run lint

# Build
bun run build
```

All commands should pass without errors.

## Development Workflow

### Running the CLI

```bash
# Run directly
bun run src/cli.ts --version

# Or use the bin entry
bun run agentlint --version
```

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `test` | `bun run test` | Run safe tests (unit + integration) |
| `test:live` | `bun run test:live` | Run E2E tests (requires API key) |
| `test:evals` | `bun run test:evals` | Run evaluations (requires API key) |
| `test:coverage` | `bun run test:coverage` | Run tests with coverage |
| `lint` | `bun run lint` | Check code style |
| `lint:fix` | `bun run lint:fix` | Fix lint issues |
| `format` | `bun run format` | Format code with Prettier |
| `format:check` | `bun run format:check` | Check formatting |
| `typecheck` | `bun run typecheck` | Type check without emit |
| `build` | `bun run build` | Build to dist/ |

> **Note**: Always use `bun run test`, never raw `bun test`. Live tests (e2e/evals) require `ANTHROPIC_API_KEY` and cost money.

### Code Style

- **TypeScript** with strict mode enabled
- **ESLint** with TypeScript strict rules
- **Prettier** for formatting
- Single quotes, semicolons, 2-space indentation

Run `bun run format` before committing to ensure consistent style.

## Project Structure

```
agentlint/
├── src/                 # Source code
│   ├── cli.ts          # CLI entry point
│   ├── version.ts      # Version utilities
│   ├── types/          # Type definitions
│   ├── errors/         # Error handling
│   └── commands/       # CLI commands
├── tests/              # Test files
├── scripts/            # Build scripts
├── docs/               # Documentation
│   └── architecture/   # Arc42 docs, ADRs
└── specs/              # Feature specifications
```

## Making Changes

### Branch Naming

Use the format: `ep##-feature-name`

Examples:
- `ep01-project-setup`
- `ep02-agent-sdk-integration`

### Commit Messages

Follow conventional commits:

```
type(scope): description

feat(cli): add update command
fix(version): handle missing runtime
test(cli): add smoke tests
docs(readme): update installation instructions
```

### Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests pass: `bun run test`
4. Ensure code is formatted: `bun run format`
5. Ensure types check: `bun run typecheck`
6. Push and create a PR

## Branch Protection

The `main` branch has protection rules enabled:

### Required Checks

All PRs must pass these CI checks before merging:

- **Lint** - ESLint and Prettier validation
- **Type Check** - TypeScript compilation without errors
- **Test** - All tests must pass
- **Build** - Successful build verification

### Protection Rules

- Direct pushes to `main` are not allowed
- PRs require at least 1 approval
- All status checks must pass
- Branch must be up-to-date before merging

### Setting Up Branch Protection (Maintainers)

To configure branch protection in GitHub:

1. Go to **Settings** > **Branches**
2. Add rule for `main` branch
3. Enable:
   - "Require a pull request before merging"
   - "Require status checks to pass before merging"
   - Select required checks: `lint`, `typecheck`, `test`, `build`
   - "Require branches to be up to date before merging"

## Testing

### Running Tests

```bash
# Safe tests (unit + integration, no API calls)
bun run test

# Specific directory
bun run test tests/unit/

# With coverage
bun run test:coverage

# Live E2E tests (requires ANTHROPIC_API_KEY, costs money)
bun run test:live

# Evaluations (requires ANTHROPIC_API_KEY, costs money)
bun run test:evals
```

> **Important**: Never use raw `bun test` - always use `bun run test`.

### Writing Tests

- Place tests in `tests/` directory
- Use `*.test.ts` naming convention
- Use Bun's built-in test runner

Example:

```typescript
import { describe, test, expect } from 'bun:test';

describe('feature', () => {
  test('does something', () => {
    expect(true).toBe(true);
  });
});
```

## Architecture

See [docs/architecture](docs/architecture) for detailed documentation including:

- Arc42 architecture documentation
- Architecture Decision Records (ADRs)
- Building block diagrams

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Reference the [README](README.md) for usage information

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
