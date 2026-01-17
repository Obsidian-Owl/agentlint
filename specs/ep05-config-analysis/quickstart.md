# Quickstart: Config Analysis Tools

> **Epic**: EP05
> **Target Audience**: agentlint developers implementing/testing tools
> **Created**: 2026-01-17

---

## Overview

The Config Analysis Tools (EP05) provide capabilities for discovering, parsing, and assessing AI Coding Tool (ACT) configuration files. These tools enable the agentlint agent to understand project configurations and identify quality issues.

---

## Installation

EP05 requires additional dependencies. Add to `package.json`:

```bash
bun add unified remark-parse remark-frontmatter remark-gfm vfile-matter yaml fast-glob
bun add -d @types/mdast
```

---

## Basic Usage

### 1. Discover Configuration Files

```typescript
import { discoverConfigs } from './tools/config';

// Discover all AI config files in a project
const result = await discoverConfigs({
  cwd: '/path/to/project',
  includeGlobal: true, // Include ~/.claude/ configs
});

console.log(result.files);
// [
//   { path: '~/.claude/CLAUDE.md', type: 'claude-md', level: 'global', ... },
//   { path: '/project/CLAUDE.md', type: 'claude-md', level: 'project', ... },
//   { path: '/project/AGENTS.md', type: 'agents-md', level: 'project', ... },
// ]
```

### 2. Parse a Configuration File

```typescript
import { parseConfig } from './tools/config';

// Parse a single config file
const result = await parseConfig({
  filePath: '/path/to/project/CLAUDE.md',
  includeQuality: true,
});

if (result.success) {
  console.log('Metrics:', result.config.metrics);
  // {
  //   lineCount: 45,
  //   tokenEstimate: 850,
  //   sectionCount: 5,
  //   maxHeadingDepth: 3,
  //   ...
  // }

  console.log('Quality:', result.quality);
  // {
  //   score: 82,
  //   grade: 'B',
  //   issues: [...],
  //   recommendations: [...]
  // }
} else {
  console.error('Parse failed:', result.error);
}
```

### 3. Analyze Configuration Hierarchy

```typescript
import { analyzeHierarchy } from './tools/config';

// Analyze how configs combine across levels
const result = await analyzeHierarchy({
  cwd: '/path/to/project',
  includeGlobal: true,
});

console.log('Summary:', result.summary);
// {
//   globalConfigExists: true,
//   projectConfigExists: true,
//   localConfigCount: 2,
//   skillCount: 3,
//   conflictCount: 1,
//   overallGrade: 'B'
// }

// Check for conflicts
for (const conflict of result.hierarchy.conflicts) {
  console.log(`Conflict: ${conflict.description}`);
  console.log(`  Files: ${conflict.files.map((f) => f.path).join(', ')}`);
  console.log(`  Resolution: ${conflict.resolution}`);
}
```

---

## Common Patterns

### Extract Sections from Config

```typescript
import { parseConfig } from './tools/config';

const result = await parseConfig({ filePath: 'CLAUDE.md' });

if (result.success) {
  // Find specific sections
  const buildSection = result.config.sections.find(
    (s) => s.title.toLowerCase().includes('build') || s.title.toLowerCase().includes('test')
  );

  if (buildSection) {
    console.log('Build commands found at line', buildSection.position.start.line);
    console.log(buildSection.content);
  }

  // Extract code blocks by language
  const bashBlocks = result.config.codeBlocks.filter((b) => b.language === 'bash');
  console.log('Found', bashBlocks.length, 'bash code blocks');
}
```

### Check for Anti-Patterns

```typescript
import { parseConfig } from './tools/config';

const result = await parseConfig({
  filePath: 'CLAUDE.md',
  includeQuality: true,
});

if (result.success && result.quality) {
  // Filter to anti-pattern issues
  const antiPatterns = result.quality.issues.filter((i) => i.type === 'anti-pattern');

  for (const issue of antiPatterns) {
    console.log(`[${issue.severity}] ${issue.message}`);
    console.log(`  Location: line ${issue.position?.start.line}`);
    console.log(`  Fix: ${issue.suggestion}`);
  }
}
```

### Analyze Skills

```typescript
import { discoverConfigs, parseConfig } from './tools/config';

// Find all skills
const discovery = await discoverConfigs({ cwd: '/project' });
const skillPaths = discovery.skills.map((s) => s.path);

// Parse each skill
for (const skillPath of skillPaths) {
  const result = await parseConfig({ filePath: skillPath });

  if (result.success) {
    const skill = result.config as Skill;
    console.log(`Skill: ${skill.name}`);
    console.log(`  Description: ${skill.description}`);
    console.log(`  Allowed tools: ${skill.allowedTools?.join(', ') || 'all'}`);

    if (skill.warnings.length > 0) {
      console.log('  Warnings:', skill.warnings.map((w) => w.message).join(', '));
    }
  }
}
```

---

## Tool Registration

Register EP05 tools with the orchestrator:

```typescript
import { createToolRegistry } from './orchestration/tool-registry';
import { parseConfigTool, discoverConfigsTool, analyzeHierarchyTool } from './tools/config';

const registry = createToolRegistry();

// Register config analysis tools
registry.registerMany([parseConfigTool, discoverConfigsTool, analyzeHierarchyTool]);

// Get MCP server for SDK
const mcpServer = registry.toMcpServer();
```

---

## Tool Definitions (for Agent)

### parse_config

```
Parse and analyze an AI coding tool configuration file.

Use this tool when you need to understand:
- Configuration content and structure
- Token counts and size metrics
- Quality issues and anti-patterns
- Section hierarchy and code blocks

Returns structured data including parsed content, metrics, and quality assessment.
```

**Parameters:**

| Parameter      | Type    | Required | Description                           |
| -------------- | ------- | -------- | ------------------------------------- |
| file_path      | string  | Yes      | Absolute path to the config file      |
| include_quality| boolean | No       | Include quality assessment (default: true) |
| include_raw    | boolean | No       | Include raw content (default: false)  |

### discover_configs

```
Discover AI configuration files in a project directory.

Use this tool when you need to:
- Find all AI config files in a project
- Understand what configurations exist
- Locate SKILL.md files
- Map the configuration landscape before analysis

Returns list of discovered files with metadata.
```

**Parameters:**

| Parameter      | Type    | Required | Description                           |
| -------------- | ------- | -------- | ------------------------------------- |
| cwd            | string  | Yes      | Project root directory                |
| include_global | boolean | No       | Include ~/.claude/ configs (default: false) |
| exclude        | string[]| No       | Additional patterns to exclude        |
| max_depth      | number  | No       | Maximum directory depth (default: 10) |

### analyze_hierarchy

```
Analyze configuration hierarchy and detect conflicts.

Use this tool when you need to:
- Understand how global and project configs combine
- Find conflicts between configuration levels
- Get an overall quality assessment across all configs
- Inventory all skills in the project

Returns hierarchy structure with conflicts and overall assessment.
```

**Parameters:**

| Parameter      | Type    | Required | Description                           |
| -------------- | ------- | -------- | ------------------------------------- |
| cwd            | string  | Yes      | Project root directory                |
| include_global | boolean | No       | Include global configs (default: true)|

---

## Error Handling

Tools return structured errors that guide recovery:

```typescript
const result = await parseConfig({ filePath: '/nonexistent/file.md' });

if (!result.success) {
  console.log('Error code:', result.error.code);
  // 'FILE_NOT_FOUND'

  console.log('Message:', result.error.message);
  // 'Configuration file not found: /nonexistent/file.md'

  console.log('Suggestion:', result.error.suggestion);
  // 'Check if the file path is correct. Use absolute paths.'

  // Partial results may be available
  if (result.partial) {
    console.log('Partial parse available:', result.partial);
  }
}
```

---

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { parseConfig } from './tools/config';

describe('parseConfig', () => {
  it('parses valid CLAUDE.md', async () => {
    const result = await parseConfig({
      filePath: 'fixtures/valid-claude.md',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.config.metrics.lineCount).toBeGreaterThan(0);
      expect(result.config.sections.length).toBeGreaterThan(0);
    }
  });

  it('handles malformed markdown gracefully', async () => {
    const result = await parseConfig({
      filePath: 'fixtures/malformed.md',
    });

    // Should succeed with warnings
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.config.warnings.length).toBeGreaterThan(0);
    }
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect } from 'vitest';
import { discoverConfigs, parseConfig, analyzeHierarchy } from './tools/config';

describe('Config Analysis Integration', () => {
  it('discovers and parses project configs', async () => {
    const discovery = await discoverConfigs({ cwd: 'fixtures/sample-project' });

    expect(discovery.files.length).toBeGreaterThan(0);

    // Parse each discovered file
    for (const file of discovery.files) {
      const result = await parseConfig({ filePath: file.path });
      expect(result.success).toBe(true);
    }
  });

  it('detects hierarchy conflicts', async () => {
    const result = await analyzeHierarchy({
      cwd: 'fixtures/conflicting-configs',
    });

    expect(result.hierarchy.conflicts.length).toBeGreaterThan(0);
  });
});
```

---

## Performance Considerations

- **File discovery** scans directories recursively—use `maxDepth` to limit depth
- **Token estimation** uses character ratio approximation (fast, ~95% accurate)
- **Quality assessment** adds ~10-20ms per file
- **Memory**: Keep within NFR-004 (<50MB) by not loading all files simultaneously

---

## Next Steps

After implementing EP05:

1. **EP06 Session Analysis**: Use config insights to contextualize session analysis
2. **EP08 ACT Adapters**: Extend adapter pattern for Cursor, Windsurf
3. **EP10 Recommendations**: Generate recommendations based on quality issues

---

## References

- [Spec](./spec.md) - Full requirements
- [Plan](./plan.md) - Implementation plan
- [Data Model](./data-model.md) - Entity definitions
- [Contracts](./contracts/interfaces.ts) - TypeScript interfaces
- [ADR-0005](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md) - Tool patterns
- [ADR-0007](../../docs/architecture/adr/0007-configuration-parser-design.md) - Parser design
