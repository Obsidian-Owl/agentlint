---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0015: Git Integration Strategy

## Context and Problem Statement

agentlint's Causal-First principle (Constitution III) requires tracing issues to their origin. Git history provides critical temporal context: when was a config option added? Who changed it? What else changed in that commit? We need git integration that supports:

1. **Full history analysis** - blame, log, diff, pickaxe search
2. **Graceful degradation** - warn but continue when git unavailable
3. **Large repository performance** - handle enterprise-scale repos
4. **Cross-platform reliability** - work on macOS, Linux, Windows

## Decision Drivers

- **Causal Tracing**: Blame, log, and pickaxe are essential for "when did this happen?"
- **Feature Completeness**: isomorphic-git lacks blame and diff commands
- **No Native Dependencies**: Avoid nodegit's complex installation requirements
- **Developer Expectation**: Git is standard tooling for developers using agentlint
- **Performance**: Large repos need efficient operations

## Considered Options

1. simple-git (Git CLI wrapper)
2. isomorphic-git (Pure JavaScript)
3. nodegit (libgit2 bindings)
4. Hybrid: simple-git + isomorphic-git fallback

## Decision Outcome

**Chosen option: "simple-git (Git CLI wrapper)"** because it provides full access to all git operations (blame, log, diff, pickaxe) via the native git binary, with TypeScript support and zero native compilation requirements. The assumption that developers have git installed is reasonable for a tool that analyzes AI coding agent configurations.

### Consequences

**Good:**
- Full git CLI functionality including blame, log, diff, pickaxe (-S/-G)
- TypeScript types included (@types not needed)
- Zero native dependencies (unlike nodegit)
- Leverages git's optimizations for large repositories
- Promise-based API with chaining support
- Raw command access for advanced operations

**Bad:**
- Requires git binary installed on system
- Spawns child processes (minor overhead)
- Git version differences may affect behavior

**Neutral:**
- Developers using agentlint almost certainly have git installed
- CI/CD environments include git by default

## Pros and Cons of Options

### Option 1: simple-git (Git CLI wrapper)

Lightweight TypeScript wrapper that executes git commands via child process.

- Good: Full git functionality (blame, log, diff, pickaxe, etc.)
- Good: TypeScript types included in package
- Good: No native dependencies to compile
- Good: Leverages git's native performance optimizations
- Good: Raw command access via `git.raw()`
- Good: Promise-based with async/await support
- Neutral: Well-maintained (GitHub steveukx/git-js)
- Bad: Requires git binary on system
- Bad: Child process overhead per command

### Option 2: isomorphic-git (Pure JavaScript)

Pure JavaScript reimplementation of git for Node.js and browsers.

- Good: No git binary required
- Good: Works in browser environments
- Good: No native dependencies
- Good: Tree-shakeable (only bundle what you use)
- Neutral: Has log command
- Bad: **No diff command** - explicitly missing from API
- Bad: **No blame command** - not implemented
- Bad: **No pickaxe search** - not available
- Bad: Slower than native git for large repositories
- Bad: Cannot support causal tracing requirements

### Option 3: nodegit (libgit2 bindings)

Native bindings to libgit2 C library.

- Good: Highest performance (native C code)
- Good: Full git functionality
- Good: No git binary required
- Neutral: Comprehensive API
- Bad: Complex installation with native dependencies
- Bad: "Only works without modification on Windows and Ubuntu"
- Bad: Requires platform-specific compilation
- Bad: Incompatible with easy npm install experience

### Option 4: Hybrid - simple-git + isomorphic-git

Use simple-git when git available, fall back to isomorphic-git for basic operations.

- Good: Works with or without git binary
- Good: Full functionality when git present
- Good: Basic operations without git
- Neutral: Two dependencies to maintain
- Bad: Increased complexity
- Bad: Inconsistent behavior between modes
- Bad: isomorphic-git fallback still lacks blame/diff
- Bad: Testing complexity for both paths

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All git operations run locally |
| II. Improvement-Oriented | Yes | Git history enables trend analysis over time |
| III. Causal-First | Yes | Blame, log, pickaxe trace issues to origin |
| IV. Mixed-Methods | Yes | Quantitative (commit counts) and qualitative (commit messages) |
| V. Language-Agnostic | Yes | Git works with any programming language |
| VI. Agent-Agnostic | Yes | Git integration independent of ACT being analyzed |
| VII. Intelligent Tooling | Yes | Agent can request specific git operations as needed |
| VIII. Compounding Value | Yes | Historical analysis builds understanding over time |
| IX. Agent-Aware | Yes | Git results structured for agent consumption |

## More Information

### Related Documents

- Design Decisions: [DD-016](../design-decisions.md#dd-016-git-integration-depth)
- Prior Decisions: [ADR-0001 - Runtime Platform](./0001-runtime-platform-and-language.md)
- Constitution: [Principle III - Causal-First](../../.specify/memory/constitution.md)

### Research Sources

- [simple-git npm package](https://www.npmjs.com/package/simple-git)
- [simple-git GitHub repository](https://github.com/steveukx/git-js)
- [isomorphic-git FAQ](https://isomorphic-git.org/docs/en/faq)
- [isomorphic-git missing diff command](https://github.com/isomorphic-git/isomorphic-git/issues/1144)
- [npm-compare: simple-git vs isomorphic-git vs nodegit](https://npm-compare.com/isomorphic-git,nodegit,simple-git)
- [Git Pickaxe - git-scm.com](https://git-scm.com/book/en/v2/Git-Tools-Searching)
- [Git pickaxe underrated flag](https://arestless.rest/blog/underrated-git-flag-pickaxe/)

### Implementation Notes

#### 1. Git Service Wrapper

```typescript
import simpleGit, { SimpleGit, LogResult, DiffResult } from 'simple-git';

interface GitService {
  isAvailable(): Promise<boolean>;
  blame(file: string): Promise<BlameResult>;
  log(options?: LogOptions): Promise<LogResult>;
  diff(options?: DiffOptions): Promise<string>;
  pickaxe(search: string, options?: PickaxeOptions): Promise<LogResult>;
  show(ref: string, file?: string): Promise<string>;
}

class SimpleGitService implements GitService {
  private git: SimpleGit;
  private available: boolean | null = null;

  constructor(workingDir: string) {
    this.git = simpleGit(workingDir);
  }

  async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available;

    try {
      await this.git.version();
      await this.git.checkIsRepo();
      this.available = true;
    } catch {
      this.available = false;
    }

    return this.available;
  }

  async blame(file: string): Promise<BlameResult> {
    const raw = await this.git.raw(['blame', '--porcelain', file]);
    return parseBlameOutput(raw);
  }

  async log(options: LogOptions = {}): Promise<LogResult> {
    return this.git.log({
      file: options.file,
      maxCount: options.limit ?? 100,
      from: options.since,
      to: options.until,
    });
  }

  async diff(options: DiffOptions = {}): Promise<string> {
    const args = ['diff'];
    if (options.cached) args.push('--cached');
    if (options.from) args.push(options.from);
    if (options.to) args.push(options.to);
    if (options.file) args.push('--', options.file);

    return this.git.raw(args);
  }

  async pickaxe(search: string, options: PickaxeOptions = {}): Promise<LogResult> {
    const args = ['log', '--oneline'];

    if (options.regex) {
      args.push('-G', search);
    } else {
      args.push('-S', search);
    }

    if (options.file) args.push('--', options.file);

    const raw = await this.git.raw(args);
    return parseLogOutput(raw);
  }

  async show(ref: string, file?: string): Promise<string> {
    const args = ['show', ref];
    if (file) args.push('--', file);
    return this.git.raw(args);
  }
}
```

#### 2. Graceful Degradation

```typescript
async function createGitService(workingDir: string): Promise<GitService | null> {
  const service = new SimpleGitService(workingDir);

  if (await service.isAvailable()) {
    return service;
  }

  console.warn(
    'Warning: Git not available. Causal tracing features will be limited.\n' +
    'Install git to enable: blame, history analysis, and pickaxe search.'
  );

  return null;
}

// Usage in analysis
async function analyzeWithGit(projectPath: string): Promise<AnalysisResult> {
  const git = await createGitService(projectPath);

  if (git) {
    // Full analysis with git history
    const configHistory = await git.log({ file: 'CLAUDE.md' });
    const recentChanges = await git.diff({ from: 'HEAD~10' });
    // ... use git data for causal tracing
  } else {
    // Continue without git, skip causal features
    // ... basic analysis only
  }
}
```

#### 3. Blame Result Parser

```typescript
interface BlameLine {
  commit: string;
  author: string;
  authorTime: Date;
  line: number;
  content: string;
}

interface BlameResult {
  lines: BlameLine[];
  commits: Map<string, CommitInfo>;
}

function parseBlameOutput(raw: string): BlameResult {
  const lines: BlameLine[] = [];
  const commits = new Map<string, CommitInfo>();

  // Parse git blame --porcelain output
  const blocks = raw.split(/^([0-9a-f]{40})/gm);

  for (let i = 1; i < blocks.length; i += 2) {
    const commit = blocks[i];
    const data = blocks[i + 1];

    // Extract author, time, line content from porcelain format
    const authorMatch = data.match(/^author (.+)$/m);
    const timeMatch = data.match(/^author-time (\d+)$/m);
    const lineMatch = data.match(/^\t(.*)$/m);

    if (authorMatch && timeMatch && lineMatch) {
      lines.push({
        commit,
        author: authorMatch[1],
        authorTime: new Date(parseInt(timeMatch[1]) * 1000),
        line: lines.length + 1,
        content: lineMatch[1],
      });
    }
  }

  return { lines, commits };
}
```

#### 4. Pickaxe for Causal Tracing

```typescript
// Find when a config option was introduced
async function findConfigOrigin(
  git: GitService,
  configOption: string
): Promise<CommitInfo | null> {
  const results = await git.pickaxe(configOption, {
    regex: false,  // Exact string match with -S
  });

  if (results.all.length === 0) return null;

  // Last commit is when it was first added
  return results.all[results.all.length - 1];
}

// Find all commits that touched a pattern
async function findPatternHistory(
  git: GitService,
  pattern: string
): Promise<LogResult> {
  return git.pickaxe(pattern, {
    regex: true,  // Regex match with -G
  });
}
```

#### 5. Tool Integration

```typescript
export const gitBlameTool = tool(
  "git_blame",
  "Get line-by-line authorship for a file to trace who changed what",
  {
    file: z.string().describe("Path to file relative to repo root"),
  },
  async (args, context) => {
    const git = context.gitService;
    if (!git) {
      return { error: "Git not available", suggestion: "Install git for causal tracing" };
    }

    const blame = await git.blame(args.file);
    return {
      lines: blame.lines.map(l => ({
        line: l.line,
        commit: l.commit.substring(0, 7),
        author: l.author,
        date: l.authorTime.toISOString().split('T')[0],
      })),
    };
  }
);

export const gitPickaxeTool = tool(
  "git_pickaxe",
  "Search git history for when a string was added or removed",
  {
    search: z.string().describe("String to search for in commit diffs"),
    regex: z.boolean().optional().describe("Treat search as regex (-G instead of -S)"),
    file: z.string().optional().describe("Limit search to specific file"),
  },
  async (args, context) => {
    const git = context.gitService;
    if (!git) {
      return { error: "Git not available" };
    }

    const results = await git.pickaxe(args.search, {
      regex: args.regex ?? false,
      file: args.file,
    });

    return {
      commits: results.all.map(c => ({
        hash: c.hash.substring(0, 7),
        message: c.message,
        author: c.author_name,
        date: c.date,
      })),
    };
  }
);
```

#### 6. Performance Considerations

```typescript
// Limit log depth for large repos
const DEFAULT_LOG_LIMIT = 100;
const MAX_LOG_LIMIT = 1000;

// Cache blame results (file content rarely changes during analysis)
class BlameCache {
  private cache = new Map<string, BlameResult>();

  async get(git: GitService, file: string): Promise<BlameResult> {
    if (!this.cache.has(file)) {
      this.cache.set(file, await git.blame(file));
    }
    return this.cache.get(file)!;
  }

  invalidate(file?: string): void {
    if (file) {
      this.cache.delete(file);
    } else {
      this.cache.clear();
    }
  }
}
```

#### 7. Error Handling

```typescript
class GitError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode?: number
  ) {
    super(message);
    this.name = 'GitError';
  }
}

async function safeGitOperation<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`Git operation failed: ${error.message}`);
    }
    return fallback;
  }
}
```
