# CLAUDE.md

This file provides guidance to Claude Code when working with this project.

## Project Overview

A well-structured sample TypeScript project demonstrating best practices.

**Stack**: TypeScript 5.x, Bun runtime, Vitest for testing

**Status**: Active development

## Development Workflow

### Getting Started
1. Install dependencies: `bun install`
2. Run tests: `bun test`
3. Build: `bun run build`
4. Lint: `bun run lint`

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: Feature branches

### Commit Guidelines
- Follow conventional commits: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore

## Key Architecture

| Directory | Purpose |
|-----------|---------|
| `/src` | Source code |
| `/tests` | Test files |
| `/docs` | Documentation |
| `/scripts` | Build and utility scripts |

### Core Modules
- `src/core/` - Core business logic
- `src/utils/` - Utility functions
- `src/types/` - TypeScript type definitions

## Testing Guidelines

- Write unit tests for all new functions
- Use descriptive test names following "should X when Y" pattern
- Aim for >80% code coverage
- Use mocking sparingly, prefer integration tests

## Code Style

- Use ESLint and Prettier configuration
- Prefer named exports over default exports
- Use TypeScript strict mode
- Document public APIs with JSDoc

## Important Notes

- Never commit secrets or API keys
- Run tests before pushing
- Update documentation when changing APIs
