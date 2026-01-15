# Data Model: Project Setup

> **Epic**: EP01
> **Created**: 2026-01-15

---

## Overview

EP01 is an infrastructure epic with minimal domain entities. The primary "data" is configuration files and build artifacts rather than runtime entities.

---

## Entities

### PackageManifest

Represents the `package.json` configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Package name (`@agentlint/cli`) |
| version | string | Yes | SemVer version |
| description | string | Yes | Package description |
| bin | Record<string, string> | Yes | CLI entry points |
| scripts | Record<string, string> | Yes | npm scripts |
| dependencies | Record<string, string> | No | Runtime dependencies |
| devDependencies | Record<string, string> | Yes | Build/test dependencies |
| engines | { node: string } | Yes | Node.js version requirement |

**Validation Rules**:
- `version` must be valid SemVer
- `engines.node` must specify `>=22.0.0`
- `bin.agentlint` must point to valid entry file

---

### Binary

Represents a compiled native executable.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| platform | "darwin" \| "linux" | Yes | Operating system |
| architecture | "arm64" \| "x64" | Yes | CPU architecture |
| version | string | Yes | SemVer version |
| checksum | string | Yes | SHA-256 hash |
| filename | string | Yes | Binary filename |
| size | number | Yes | File size in bytes |

**Validation Rules**:
- `checksum` must be 64 hex characters (SHA-256)
- `size` must be < 50MB (NFR-002)
- `filename` format: `agentlint-{platform}-{architecture}`

**Platform Matrix**:
| platform | architecture | filename |
|----------|--------------|----------|
| darwin | arm64 | agentlint-darwin-arm64 |
| darwin | x64 | agentlint-darwin-x64 |
| linux | arm64 | agentlint-linux-arm64 |
| linux | x64 | agentlint-linux-x64 |

---

### Release

Represents a versioned distribution on GitHub Releases.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tag | string | Yes | Git tag (e.g., `v0.1.0`) |
| binaries | Binary[] | Yes | Platform binaries |
| changelog | string | No | Release notes (auto-generated) |
| publishedAt | string | Yes | ISO-8601 timestamp |
| npmVersion | string | Yes | Published npm version |

**Validation Rules**:
- `tag` must match pattern `v{major}.{minor}.{patch}`
- `binaries` must contain exactly 4 entries (all platforms)
- `npmVersion` must match tag version (without `v` prefix)

---

## Entity Relationships

```
Release --1:4--> Binary (one release produces 4 platform binaries)
PackageManifest --1:1--> Release (manifest version matches release tag)
```

---

## Configuration Files

### TypeScript Config (tsconfig.json)

| Field | Value | Rationale |
|-------|-------|-----------|
| target | ESNext | Bun supports latest features |
| module | ESNext | Native ESM |
| strict | true | Catch more errors at compile time |
| skipLibCheck | true | Faster builds |
| outDir | ./dist | Build output |
| rootDir | ./src | Source root |

### ESLint Config (.eslintrc.cjs)

| Rule Category | Approach |
|---------------|----------|
| TypeScript | @typescript-eslint/recommended |
| Import order | eslint-plugin-import |
| Unused vars | Error (no-unused-vars) |

### Prettier Config (.prettierrc)

| Option | Value |
|--------|-------|
| semi | false |
| singleQuote | true |
| trailingComma | es5 |
| printWidth | 100 |
| tabWidth | 2 |

---

## State Transitions

### Release Pipeline States

```
         ┌─────────┐
         │ Pending │ (tag pushed)
         └────┬────┘
              │
              ▼
         ┌─────────┐
         │Building │ (CI compiling binaries)
         └────┬────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌───────┐          ┌────────┐
│Failed │          │Built   │
└───────┘          └────┬───┘
                        │
                        ▼
                  ┌───────────┐
                  │Publishing │ (uploading to GitHub + npm)
                  └─────┬─────┘
                        │
              ┌─────────┴─────────┐
              │                   │
              ▼                   ▼
         ┌────────┐          ┌───────────┐
         │Failed  │          │ Published │
         └────────┘          └───────────┘
```

---

## Notes

This is primarily an infrastructure epic. Runtime domain entities (Baseline, Session, Analysis, etc.) will be defined in subsequent epics (EP03, EP06, EP07).
