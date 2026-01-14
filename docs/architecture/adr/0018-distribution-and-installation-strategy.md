---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0018: Distribution and Installation Strategy

## Context and Problem Statement

agentlint needs a distribution strategy that enables easy installation for developers on macOS and Linux. Per ADR-0001, we use TypeScript with Bun runtime, which supports single-binary compilation via `bun compile`. We must decide between npm-based distribution (requiring Node.js), native binary distribution (no runtime dependency), or a hybrid approach.

## Decision Drivers

- **Easy Installation**: Minimize friction for first-time users
- **No Runtime Dependency**: Native binary preferred to avoid requiring Node.js/Bun pre-installed
- **Cross-Platform**: macOS and Linux for MVP; Windows deferred
- **Update Mechanism**: Users need a way to stay current
- **Claude Code Pattern**: Follow Anthropic's proven distribution approach
- **Bun Alignment**: Leverage ADR-0001's Bun choice for compilation

## Considered Options

1. Native binary primary (Claude Code pattern)
2. npm primary with binary fallback
3. npm + GitHub releases hybrid
4. npm only (simplest)

## Decision Outcome

**Chosen option: "Native binary primary (Claude Code pattern)"** because it provides the best installation experience (no runtime dependencies), follows Anthropic's proven pattern with Claude Code, and aligns with ADR-0001's Bun compile capability. The self-update command provides a seamless update experience.

**Distribution channels:**
- **Primary**: Native binary via curl install script
- **Secondary**: npm package for users who prefer npm workflow
- **Releases**: GitHub Releases for binary hosting

### Consequences

**Good:**
- Zero runtime dependency for users (no Node.js/Bun required)
- Single command installation (`curl | bash`)
- Self-update capability for seamless upgrades
- Follows Claude Code's proven distribution pattern
- Bun compile produces optimized single-file executables
- Cross-compilation support for macOS/Linux from single CI

**Bad:**
- Larger binary size (~50-88MB includes Bun runtime)
- Must maintain install scripts for multiple platforms
- Self-update requires signed binaries for security
- More complex release pipeline than npm-only

**Neutral:**
- npm package maintained as secondary option
- Windows support deferred to post-MVP
- GitHub Releases used for binary hosting

## Pros and Cons of Options

### Option 1: Native Binary Primary (Claude Code Pattern)

Distribute via curl install script, compile with `bun compile`, host binaries on GitHub Releases. Include `agentlint update` command.

- Good: No runtime dependency—works without Node.js/Bun installed
- Good: Single command install: `curl -fsSL ... | bash`
- Good: Follows Claude Code's recommended installation pattern
- Good: Self-update command provides seamless upgrades
- Good: Bun compile supports cross-compilation (macOS, Linux)
- Good: Faster startup than npm-based execution
- Neutral: Larger binary (~50-88MB)
- Bad: Must maintain platform-specific install scripts
- Bad: More complex release pipeline
- Bad: Self-update requires binary signing for security

### Option 2: npm Primary with Binary Fallback

Publish to npm as primary, offer binary download for users without Node.js.

- Good: Familiar workflow for Node.js developers
- Good: Automatic update via `npm update -g`
- Good: Simple publishing via npm CI integration
- Good: Binary fallback for non-Node users
- Neutral: Most developers have Node.js installed
- Bad: Requires Node.js 18+ for npm installation
- Bad: Two distribution paths to maintain
- Bad: npm is Claude Code's deprecated pattern

### Option 3: npm + GitHub Releases Hybrid

Full parity between npm and binary distributions.

- Good: Maximum flexibility for users
- Good: Choose your preferred installation method
- Good: npm for quick start, binary for production
- Neutral: More comprehensive but complex
- Bad: Two parallel release pipelines
- Bad: Must keep versions in sync
- Bad: Testing burden for both paths

### Option 4: npm Only (Simplest)

Publish only to npm, rely on Node.js ecosystem.

- Good: Simplest release pipeline
- Good: Familiar npm workflow
- Good: Automatic updates via npm
- Good: Smallest maintenance burden
- Neutral: Covers most developer use cases
- Bad: Requires Node.js runtime installed
- Bad: Slower startup than compiled binary
- Bad: Doesn't follow Claude Code pattern
- Bad: Enterprise users may not have Node.js

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All installation and updates happen locally |
| II. Improvement-Oriented | Yes | Self-update enables continuous improvement adoption |
| III. Causal-First | N/A | Distribution doesn't affect causal analysis |
| IV. Mixed-Methods | N/A | Distribution doesn't affect analysis methods |
| V. Language-Agnostic | Yes | Binary distribution works regardless of project language |
| VI. Agent-Agnostic | Yes | Distribution independent of analyzed ACT |
| VII. Intelligent Tooling | N/A | Distribution doesn't affect tooling |
| VIII. Compounding Value | Yes | Easy updates enable users to benefit from improvements |
| IX. Agent-Aware | N/A | Distribution doesn't affect agent cognition |

## More Information

### Related Documents

- Design Decisions: [DD-019](../design-decisions.md#dd-019-distribution-and-installation-strategy)
- Prior Decisions: [ADR-0001 - Runtime Platform and Language](./0001-runtime-platform-and-language.md)
- Related: [ADR-0017 - Agent Skills Integration](./0017-agent-skills-integration-strategy.md) (plugin marketplace distribution)

### Research Sources

- [Bun Single-file Executable Documentation](https://bun.com/docs/bundler/executables)
- [Claude Code Setup Documentation](https://code.claude.com/docs/en/setup)
- [Bun Joins Anthropic - Bun Blog](https://bun.com/blog/bun-joins-anthropic)
- [Creating NPX compatible CLI tools with Bun](https://runspired.com/2025/01/25/npx-executables-with-bun.html)
- [Node.js CLI Apps Best Practices - GitHub](https://github.com/lirantal/nodejs-cli-apps-best-practices)
- [npm Package Best Practices - Snyk](https://snyk.io/blog/best-practices-create-modern-npm-package/)
- [semantic-release - GitHub](https://github.com/semantic-release/semantic-release)
- [@anthropic-ai/claude-code - npm](https://www.npmjs.com/package/@anthropic-ai/claude-code)

### Implementation Notes

#### 1. Binary Compilation

```bash
# Build for current platform
bun build ./src/cli.ts --compile --outfile agentlint

# Cross-compile for releases
bun build ./src/cli.ts --compile --target=bun-darwin-arm64 --outfile dist/agentlint-darwin-arm64
bun build ./src/cli.ts --compile --target=bun-darwin-x64 --outfile dist/agentlint-darwin-x64
bun build ./src/cli.ts --compile --target=bun-linux-x64 --outfile dist/agentlint-linux-x64
bun build ./src/cli.ts --compile --target=bun-linux-arm64 --outfile dist/agentlint-linux-arm64
```

#### 2. Install Script (macOS/Linux)

```bash
#!/bin/bash
# install.sh - hosted at https://agentlint.dev/install.sh

set -e

INSTALL_DIR="${AGENTLINT_INSTALL_DIR:-$HOME/.agentlint/bin}"
REPO="agentlint/agentlint"

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

PLATFORM="${OS}-${ARCH}"
BINARY_NAME="agentlint-${PLATFORM}"

# Get latest release
LATEST=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | cut -d'"' -f4)

# Download and install
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST}/${BINARY_NAME}"

echo "Installing agentlint ${LATEST} for ${PLATFORM}..."

mkdir -p "$INSTALL_DIR"
curl -fsSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/agentlint"
chmod +x "${INSTALL_DIR}/agentlint"

# Add to PATH hint
echo ""
echo "agentlint installed to ${INSTALL_DIR}/agentlint"
echo ""
echo "Add to your PATH (if not already):"
echo "  export PATH=\"\$PATH:${INSTALL_DIR}\""
echo ""
echo "Run 'agentlint --version' to verify installation."
```

#### 3. Self-Update Command

```typescript
// src/commands/update.ts
import { $ } from 'bun';

interface UpdateOptions {
  force?: boolean;
  version?: string;
}

export async function updateCommand(options: UpdateOptions = {}): Promise<void> {
  const currentVersion = await getCurrentVersion();
  const latestVersion = options.version ?? await getLatestVersion();

  if (currentVersion === latestVersion && !options.force) {
    console.log(`Already at latest version (${currentVersion})`);
    return;
  }

  console.log(`Updating agentlint: ${currentVersion} → ${latestVersion}`);

  const platform = getPlatform();
  const downloadUrl = `https://github.com/agentlint/agentlint/releases/download/${latestVersion}/agentlint-${platform}`;

  // Download to temp location
  const tempPath = `/tmp/agentlint-${latestVersion}`;
  await $`curl -fsSL ${downloadUrl} -o ${tempPath}`;
  await $`chmod +x ${tempPath}`;

  // Verify download (checksum)
  const checksumUrl = `${downloadUrl}.sha256`;
  const expectedChecksum = await fetch(checksumUrl).then(r => r.text());
  const actualChecksum = await $`shasum -a 256 ${tempPath}`.text();

  if (!actualChecksum.startsWith(expectedChecksum.trim())) {
    throw new Error('Checksum verification failed');
  }

  // Replace current binary
  const installPath = process.argv[0]; // Current executable path
  await $`mv ${tempPath} ${installPath}`;

  console.log(`Successfully updated to ${latestVersion}`);
}

async function getLatestVersion(): Promise<string> {
  const response = await fetch(
    'https://api.github.com/repos/agentlint/agentlint/releases/latest'
  );
  const data = await response.json();
  return data.tag_name;
}

function getPlatform(): string {
  const os = process.platform === 'darwin' ? 'darwin' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return `${os}-${arch}`;
}

async function getCurrentVersion(): Promise<string> {
  // Read from embedded version or package.json
  return process.env.AGENTLINT_VERSION ?? '0.0.0';
}
```

#### 4. npm Package (Secondary)

```json
{
  "name": "@agentlint/cli",
  "version": "0.1.0",
  "description": "AI coding tool configuration analyzer",
  "bin": {
    "agentlint": "./dist/cli.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "bun build ./src/cli.ts --outdir ./dist --target node",
    "prepublishOnly": "bun run build"
  },
  "keywords": ["cli", "ai", "claude", "cursor", "linting", "configuration"],
  "repository": {
    "type": "git",
    "url": "https://github.com/agentlint/agentlint"
  }
}
```

#### 5. Release Pipeline (GitHub Actions)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-latest
            target: bun-darwin-arm64
            artifact: agentlint-darwin-arm64
          - os: macos-latest
            target: bun-darwin-x64
            artifact: agentlint-darwin-x64
          - os: ubuntu-latest
            target: bun-linux-x64
            artifact: agentlint-linux-x64
          - os: ubuntu-latest
            target: bun-linux-arm64
            artifact: agentlint-linux-arm64

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Build binary
        run: |
          bun build ./src/cli.ts \
            --compile \
            --target=${{ matrix.target }} \
            --outfile=dist/${{ matrix.artifact }}

      - name: Generate checksum
        run: |
          cd dist
          shasum -a 256 ${{ matrix.artifact }} > ${{ matrix.artifact }}.sha256

      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: |
            dist/${{ matrix.artifact }}
            dist/${{ matrix.artifact }}.sha256

  release:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts
          merge-multiple: true

      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          files: artifacts/*
          generate_release_notes: true

  npm-publish:
    needs: release
    runs-on: ubuntu-latest
    permissions:
      id-token: write

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: bun install
      - run: bun run build

      - name: Publish to npm
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

#### 6. Platform Support Matrix

| Platform | Architecture | MVP | Status |
|----------|-------------|-----|--------|
| macOS | arm64 (Apple Silicon) | Yes | Primary |
| macOS | x64 (Intel) | Yes | Primary |
| Linux | x64 | Yes | Primary |
| Linux | arm64 | Yes | Primary |
| Windows | x64 | No | Post-MVP |
| Windows | arm64 | No | Post-MVP |

#### 7. Installation Locations

```
~/.agentlint/
├── bin/
│   └── agentlint          # Main binary
├── cache/                  # Update cache
└── config.toml            # User config (if needed)
```

#### 8. Versioning Strategy

- Follow SemVer 2.0.0
- Use semantic-release for automated versioning
- Tag format: `v{major}.{minor}.{patch}`
- Pre-releases: `v{version}-beta.{n}`

