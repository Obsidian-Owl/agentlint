# Research Findings: Config Analysis Tools

> **Epic**: EP05
> **Date**: 2026-01-17
> **Author**: Claude

---

## Decision Log

### 1. Markdown Parsing: unified/remark Ecosystem

**Decision**: Use unified + remark-parse + mdast for markdown parsing

**Rationale**:
- Battle-tested ecosystem with 24M+ weekly downloads
- Full TypeScript support via `@types/mdast`
- Position tracking (line/column) preserved in AST nodes
- Plugin ecosystem for extensions (frontmatter, GFM)
- Used by major projects (Gatsby, Next.js MDX, Contentful)

**Alternatives Considered**:
- **marked**: Fast but no AST access, just HTML output
- **markdown-it**: Good for rendering, less suited for analysis
- **tree-sitter**: Powerful but heavier dependency, overkill for markdown
- **regex/heuristics**: Fragile, can't handle edge cases

**Required Packages**:
```json
{
  "unified": "^11.0.4",
  "remark-parse": "^11.0.0",
  "remark-frontmatter": "^5.0.0",
  "remark-gfm": "^4.0.0",
  "@types/mdast": "^4.0.0",
  "vfile-matter": "^5.0.0",
  "yaml": "^2.0.0"
}
```

**References**:
- [remark - unified](https://unifiedjs.com/explore/package/remark/)
- [mdast specification](https://github.com/syntax-tree/mdast)
- [remark-frontmatter](https://github.com/remarkjs/remark-frontmatter)

---

### 2. Frontmatter Handling

**Decision**: Use remark-frontmatter + vfile-matter for YAML extraction

**Rationale**:
- remark-frontmatter adds frontmatter node to AST
- vfile-matter extracts YAML into `file.data.matter`
- Preserves position information for causal tracing
- Handles edge cases (malformed YAML, empty frontmatter)

**Implementation Pattern**:
```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import { matter } from 'vfile-matter';

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(function extractMatter() {
    return function (tree, file) {
      matter(file);
    };
  });

const result = await processor.process(markdown);
const frontmatter = result.data.matter; // Parsed YAML object
```

**References**:
- [vfile-matter](https://github.com/vfile/vfile-matter)
- Clarification Q4 resolution in spec.md

---

### 3. Token Count Estimation

**Decision**: Use character-to-token ratio approximation (1 token ≈ 4 chars for English)

**Rationale**:
- Exact tokenization requires the tiktoken library (heavy dependency)
- For config quality assessment, approximation is sufficient
- Claude tokenization roughly 1:4 chars:tokens for English text
- Can refine later if precise counts are needed

**Implementation**:
```typescript
function estimateTokenCount(text: string): number {
  // Simple approximation: ~4 characters per token for English
  // Code blocks may have higher density (~3 chars/token)
  const codeBlockChars = extractCodeBlocks(text).reduce((sum, block) => sum + block.length, 0);
  const proseChars = text.length - codeBlockChars;

  return Math.ceil(proseChars / 4 + codeBlockChars / 3);
}
```

**Thresholds (from ADR-0007 research)**:
- Lightweight: < 3,000 tokens
- Medium: 3,000 - 15,000 tokens
- Heavy: > 25,000 tokens (likely ignored by model)

---

### 4. Anti-Pattern Detection Strategy

**Decision**: Pattern-based detection using AST traversal

**Rationale**:
- AST provides structured access to content
- Patterns can be expressed as node visitors
- Position tracking enables precise error locations
- Extensible via new pattern detectors

**Anti-Patterns to Detect**:

| Anti-Pattern | Detection Strategy | Threshold |
|--------------|-------------------|-----------|
| Generic rules | Regex match on common phrases | "clean code", "best practices", etc. |
| Instruction overload | Count instruction markers | > 200 instructions |
| Linter jobs | Detect linting-related keywords | ESLint, Prettier rules |
| Embedded secrets | Regex patterns for API keys, tokens | Common secret formats |
| Code snippet overuse | Count code blocks, check staleness | > 10 blocks or outdated refs |
| Excessive emphasis | Count MUST/IMPORTANT/CRITICAL | > 20 emphasis markers |

**Implementation Pattern**:
```typescript
interface AntiPattern {
  id: string;
  name: string;
  description: string;
  detect: (ast: Root, content: string) => PatternMatch[];
}

interface PatternMatch {
  pattern: string;
  location: Position;
  severity: 'warning' | 'error';
  suggestion: string;
}
```

---

### 5. Quality Scoring Algorithm

**Decision**: Weighted scoring across multiple dimensions

**Rationale**:
- Single score provides quick quality overview
- Weighted components enable nuanced assessment
- Score maps to actionable thresholds

**Scoring Dimensions**:

| Dimension | Weight | Criteria |
|-----------|--------|----------|
| Structure | 25% | Has clear sections, appropriate depth (2-4 levels), balanced content |
| Size | 20% | Within recommended lines (<100 for Claude), not too short (<10) |
| Completeness | 20% | Has WHAT/WHY/HOW sections, build commands, constraints |
| Anti-patterns | 20% | Penalty for each detected anti-pattern |
| Specificity | 15% | Project-specific content vs generic guidance |

**Score Calculation**:
```typescript
function calculateQualityScore(config: ParsedConfig): QualityScore {
  const structure = scoreStructure(config); // 0-100
  const size = scoreSize(config);           // 0-100
  const completeness = scoreCompleteness(config); // 0-100
  const antiPatterns = penalizeAntiPatterns(config); // -points
  const specificity = scoreSpecificity(config); // 0-100

  const weighted =
    structure * 0.25 +
    size * 0.20 +
    completeness * 0.20 +
    specificity * 0.15 +
    Math.max(0, 100 - antiPatterns) * 0.20;

  return {
    overall: Math.round(weighted),
    dimensions: { structure, size, completeness, specificity, antiPatterns },
    grade: scoreToGrade(weighted)
  };
}

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
```

---

### 6. Config Discovery Patterns

**Decision**: Use glob patterns with configurable exclusions

**Rationale**:
- glob is fast and well-understood
- Bun has native glob support via `Bun.glob`
- Exclusions prevent scanning irrelevant directories
- Hierarchy discovery needs ordered paths

**Discovery Order** (for hierarchy):
1. `~/.claude/CLAUDE.md` (global)
2. `~/.config/claude/skills/` (user skills)
3. `{projectRoot}/CLAUDE.md` (project root)
4. `{projectRoot}/.claude/settings.json` (project settings)
5. `{projectRoot}/.claude/skills/` (project skills)
6. `{projectRoot}/**/CLAUDE.md` (nested configs)
7. `{projectRoot}/AGENTS.md` (agents.md standard)

**Default Exclusions**:
- `node_modules/`
- `.git/`
- `dist/`
- `build/`
- `coverage/`
- `*.min.js` (minified files)

**Implementation**:
```typescript
interface DiscoveryOptions {
  cwd: string;
  includeGlobal: boolean;
  exclude: string[];
  maxDepth: number;
}

const DEFAULT_EXCLUDE = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  'coverage/**',
];
```

---

### 7. SKILL.md Parsing

**Decision**: Parse YAML frontmatter with validation, extract markdown content

**Rationale**:
- Skills have required fields (name, description)
- Frontmatter defines behavior; content defines instructions
- Need to validate format for quality assessment

**Required Frontmatter Fields**:
- `name`: string (max 64 chars)
- `description`: string (max 200 chars)

**Optional Frontmatter Fields**:
- `allowed-tools`: string (comma-separated)
- `model`: string (model ID)
- `user-invocable`: boolean
- `disable-model-invocation`: boolean

**Skill Directory Structure**:
```
.claude/skills/my-skill/
├── SKILL.md          # Required
├── scripts/          # Optional helper scripts
├── references/       # Optional detailed docs
└── assets/           # Optional templates
```

**Zod Schema**:
```typescript
const SkillFrontmatterSchema = z.object({
  name: z.string().max(64),
  description: z.string().max(200),
  'allowed-tools': z.string().optional(),
  model: z.string().optional(),
  'user-invocable': z.boolean().optional().default(true),
  'disable-model-invocation': z.boolean().optional().default(false),
});
```

---

### 8. Tool Output Structure (Poka-yoke)

**Decision**: Rich structured output optimized for agent consumption

**Rationale**:
- Agent needs clear, actionable information
- Structured data enables reasoning
- Error cases should guide recovery
- Position info enables causal tracing

**Output Schema**:
```typescript
interface ParseConfigResult {
  success: true;
  file: ConfigFile;
  ast: ParsedAST;
  metrics: ConfigMetrics;
  quality: QualityAssessment | null;
  warnings: ParseWarning[];
} | {
  success: false;
  error: ParseError;
  partial: Partial<ParseConfigResult> | null;
}
```

**References**:
- ADR-0005 Section 7: Error Handling Pattern
- ADR-0005 Section 2: Tool Documentation Guidelines

---

## Dependencies Matrix

| Package | Version | Purpose | Bundle Size |
|---------|---------|---------|-------------|
| unified | ^11.0.4 | Pipeline processor | ~10KB |
| remark-parse | ^11.0.0 | Markdown to mdast | ~25KB |
| remark-frontmatter | ^5.0.0 | YAML frontmatter | ~3KB |
| remark-gfm | ^4.0.0 | GitHub Flavored Markdown | ~15KB |
| @types/mdast | ^4.0.0 | TypeScript types | Types only |
| vfile-matter | ^5.0.0 | Extract frontmatter data | ~2KB |
| yaml | ^2.0.0 | YAML parsing | ~35KB |
| fast-glob | ^3.3.0 | File discovery | ~20KB |

**Total New Dependencies**: ~110KB (acceptable for CLI tool)

---

## Open Items Resolved

All technical unknowns have been resolved:

| Item | Resolution | Source |
|------|------------|--------|
| Markdown parser choice | unified/remark | ADR-0007 + research |
| Frontmatter handling | remark-frontmatter + vfile-matter | Research |
| Token counting | Character ratio approximation | Research |
| Quality scoring | Weighted multi-dimension | Research |
| Anti-pattern detection | AST traversal + patterns | ADR-0007 |
| Config discovery | Bun.glob with exclusions | Research |
| SKILL.md format | YAML frontmatter + content | Spec clarification |

---

## Next Steps

1. Create data model with detailed entity definitions
2. Define TypeScript interfaces in contracts/
3. Implement parsing infrastructure
4. Build tool definitions
