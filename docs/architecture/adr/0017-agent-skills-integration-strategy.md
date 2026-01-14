---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0017: Agent Skills Integration Strategy

## Context and Problem Statement

Agent Skills is an open standard (agentskills.io) for portable procedural knowledge, originally developed by Anthropic and now adopted by Claude Code, Cursor, VS Code, OpenAI Codex, and others. As agentlint analyzes AI coding tool configurations, we need to decide how to handle SKILL.md files—whether to analyze them, what quality criteria to apply, and how agentlint itself should be distributed.

## Decision Drivers

- **Agent-Agnostic Architecture**: SKILL.md is becoming a cross-platform standard; supporting it aligns with Principle VI
- **Existing Parser Pattern**: ADR-0007 established mdast + adapter pattern for configuration parsing
- **Quality Signal Extraction**: Skills have documented quality criteria (size limits, naming conventions, description clarity)
- **Distribution Strategy**: Claude Code plugin marketplace provides the primary distribution channel
- **MVP Scope**: Focus on analysis capabilities before considering packaging agentlint as a skill

## Considered Options

1. Extend Config Parser with SKILL.md adapter
2. Dedicated Skills Analyzer module
3. Wrap official skills-ref library (Python)
4. Defer Agent Skills support

## Decision Outcome

**Chosen option: "Extend Config Parser with SKILL.md adapter"** because it leverages the existing mdast parsing architecture from ADR-0007, maintains consistency with how other ACT configurations are analyzed, and enables quality analysis using the documented Agent Skills specification criteria.

**Distribution**: agentlint will target the Claude Code plugin marketplace as the primary distribution channel. Packaging as an Agent Skill is deferred until post-MVP when marketplace presence and concrete use cases are established.

### Consequences

**Good:**
- Consistent architecture with ADR-0007's adapter pattern
- Minimal new dependencies (reuses mdast, remark-frontmatter)
- Quality checks leverage official spec criteria (naming, size, description)
- Cross-platform benefit as Agent Skills adoption grows
- Skills analyzed alongside other ACT configs in baselines

**Bad:**
- Must parse YAML frontmatter + markdown body (additional complexity vs pure markdown)
- Skills quality criteria may evolve as standard matures
- Cannot validate scripts/ or references/ without additional tooling

**Neutral:**
- Distribution via Claude Code plugin marketplace requires plugin packaging
- Agent Skill packaging deferred; can revisit when demand emerges

## Pros and Cons of Options

### Option 1: Extend Config Parser with SKILL.md Adapter

Add SKILL.md support to ADR-0007's mdast + adapter pattern with quality checks based on official spec.

- Good: Consistent with existing config parsing architecture
- Good: Reuses mdast, remark-frontmatter already in dependency tree
- Good: Quality checks derive from official spec (documented thresholds)
- Good: Skills appear in baselines alongside other ACT configs
- Good: Zero new dependencies beyond existing parser
- Neutral: YAML frontmatter parsing uses remark-frontmatter extension
- Bad: Cannot execute or validate scripts/ directory contents
- Bad: Limited to structural analysis (cannot test skill behavior)

### Option 2: Dedicated Skills Analyzer Module

Separate analysis module specifically for Agent Skills with skill-specific capabilities.

- Good: Tailored analysis for skill-specific patterns
- Good: Could expand to validate scripts/ and references/
- Good: Cleaner separation of concerns
- Neutral: Could import skills-ref validation logic
- Bad: Duplicates mdast parsing already implemented
- Bad: Adds architectural complexity for minimal benefit
- Bad: Skills would need separate baseline tracking

### Option 3: Wrap skills-ref Library (Python)

Use the official skills-ref validation library via Python subprocess.

- Good: Official validation logic, maintained by spec authors
- Good: Guaranteed spec compliance
- Good: Includes prompt XML generation
- Neutral: skills-ref explicitly states "not meant for production use"
- Bad: Adds Python runtime dependency (violates ADR-0001 zero-native-deps)
- Bad: Subprocess overhead for validation calls
- Bad: External dependency complicates distribution
- Bad: Library explicitly marked as demonstration-only

### Option 4: Defer Agent Skills Support

Document decision to defer until concrete use cases emerge (similar to MCP in ADR-0016).

- Good: Zero implementation work for MVP
- Good: Avoids premature complexity
- Good: Can add support when demand is clear
- Neutral: Skills ecosystem still maturing
- Bad: Misses opportunity to analyze skills in ACT configurations
- Bad: Users with skills get incomplete analysis
- Bad: Less alignment with agent-agnostic principle

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All skill analysis runs locally |
| II. Improvement-Oriented | Yes | Skill quality tracked in baselines |
| III. Causal-First | Yes | AST positions enable precise issue location in SKILL.md |
| IV. Mixed-Methods | Yes | Quantitative (metrics) and qualitative (description analysis) |
| V. Language-Agnostic | Yes | SKILL.md is format-agnostic; scripts can be any language |
| VI. Agent-Agnostic | Yes | Agent Skills is cross-platform standard |
| VII. Intelligent Tooling | Yes | Rich quality signals for agent reasoning |
| VIII. Compounding Value | Yes | Skill quality tracked over time in baselines |
| IX. Agent-Aware | Yes | Normalized output optimized for agent consumption |

## More Information

### Related Documents

- Design Decisions: [DD-018](../design-decisions.md#dd-018-agent-skills-integration)
- Prior Decisions: [ADR-0007 - Configuration Parser Design](./0007-configuration-parser-design.md)
- Related: [ADR-0016 - MCP Integration Strategy](./0016-mcp-integration-strategy.md) (similar defer pattern for packaging)

### Research Sources

- [Agent Skills Standard - agentskills.io](https://agentskills.io/)
- [Agent Skills Specification](https://agentskills.io/specification)
- [skills-ref Reference Library - GitHub](https://github.com/agentskills/agentskills/tree/main/skills-ref)
- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/discover-plugins)
- [Anthropic Skills Repository - GitHub](https://github.com/anthropics/skills)
- [Claude Code Plugin Marketplace - Official](https://github.com/anthropics/claude-plugins-official)
- [Agent Skills: Anthropic's Next Bid to Define AI Standards - The New Stack](https://thenewstack.io/agent-skills-anthropics-next-bid-to-define-ai-standards/)
- [VS Code Agent Skills Documentation](https://code.visualstudio.com/docs/copilot/customization/agent-skills)

### Implementation Notes

#### 1. SKILL.md Adapter Structure

```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import { parse as parseYaml } from 'yaml';

interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, unknown>;
  allowedTools?: string[];
}

interface SkillAnalysis {
  metadata: SkillMetadata;
  bodyTokens: number;
  bodyLines: number;
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;
  qualitySignals: SkillQualitySignals;
}

interface SkillQualitySignals {
  nameValid: boolean;
  nameIssues: string[];
  descriptionQuality: 'good' | 'weak' | 'missing';
  descriptionLength: number;
  instructionSize: 'optimal' | 'acceptable' | 'oversized';
  hasKeywordTriggers: boolean;
}
```

#### 2. Quality Criteria (from Specification)

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| Name format | lowercase, hyphens, max 64 chars | agentskills.io/specification |
| Description | max 1024 chars, include trigger keywords | agentskills.io/specification |
| SKILL.md lines | < 500 lines recommended | agentskills.io/specification |
| Instruction tokens | < 5000 tokens recommended | agentskills.io/specification |
| Name-directory match | name must equal parent directory | agentskills.io/specification |

#### 3. Name Validation

```typescript
function validateSkillName(name: string, parentDir: string): string[] {
  const issues: string[] = [];

  // Max 64 characters
  if (name.length > 64) {
    issues.push(`Name exceeds 64 character limit (${name.length})`);
  }

  // Lowercase letters, numbers, hyphens only
  if (!/^[a-z0-9-]+$/.test(name)) {
    issues.push('Name must contain only lowercase letters, numbers, and hyphens');
  }

  // Cannot start/end with hyphen
  if (name.startsWith('-') || name.endsWith('-')) {
    issues.push('Name cannot start or end with hyphen');
  }

  // No consecutive hyphens
  if (name.includes('--')) {
    issues.push('Name cannot contain consecutive hyphens');
  }

  // Must match parent directory
  if (name !== parentDir) {
    issues.push(`Name "${name}" does not match directory "${parentDir}"`);
  }

  return issues;
}
```

#### 4. Description Quality Analysis

```typescript
function analyzeDescription(description: string): SkillQualitySignals['descriptionQuality'] {
  if (!description || description.trim().length === 0) {
    return 'missing';
  }

  // Weak indicators: very short, generic phrases
  const weakPatterns = [
    /^helps? with/i,
    /^does? stuff/i,
    /^useful for/i,
  ];

  if (description.length < 50 || weakPatterns.some(p => p.test(description))) {
    return 'weak';
  }

  // Good descriptions include:
  // - Specific actions (verbs)
  // - "Use when" or "Use for" trigger phrases
  // - Keywords matching expected queries
  const hasActionVerbs = /\b(extract|create|analyze|generate|convert|build|deploy|test)\b/i.test(description);
  const hasTriggerPhrases = /\buse (when|for|if)\b/i.test(description);

  if (hasActionVerbs && hasTriggerPhrases) {
    return 'good';
  }

  return description.length >= 100 ? 'good' : 'weak';
}
```

#### 5. Integration with Config Parser

The SKILL.md adapter integrates with ADR-0007's adapter registry:

```typescript
// Register SKILL.md adapter alongside existing adapters
const adapters: ConfigAdapterRegistry = {
  'claude-code': new ClaudeCodeAdapter(),   // CLAUDE.md
  'cursor': new CursorAdapter(),             // .cursorrules, .mdc
  'agent-skill': new AgentSkillAdapter(),    // SKILL.md
  // Future: windsurf, copilot, etc.
};

// Adapter detection by file/directory pattern
function detectAdapter(path: string): ConfigAdapter | null {
  if (path.endsWith('SKILL.md')) {
    return adapters['agent-skill'];
  }
  if (path.endsWith('CLAUDE.md') || path.includes('.claude/')) {
    return adapters['claude-code'];
  }
  // ... etc
}
```

#### 6. Skill Discovery

```typescript
interface SkillLocation {
  type: 'project' | 'personal';
  path: string;
}

async function discoverSkills(projectPath: string): Promise<SkillLocation[]> {
  const locations: SkillLocation[] = [];

  // Project skills (.github/skills/ or .claude/skills/)
  const projectPaths = [
    path.join(projectPath, '.github/skills'),
    path.join(projectPath, '.claude/skills'),
  ];

  for (const skillsDir of projectPaths) {
    if (await exists(skillsDir)) {
      const skills = await findSkillsInDir(skillsDir);
      locations.push(...skills.map(s => ({ type: 'project' as const, path: s })));
    }
  }

  // Personal skills (~/.copilot/skills/ or ~/.claude/skills/)
  const personalPaths = [
    path.join(os.homedir(), '.copilot/skills'),
    path.join(os.homedir(), '.claude/skills'),
  ];

  for (const skillsDir of personalPaths) {
    if (await exists(skillsDir)) {
      const skills = await findSkillsInDir(skillsDir);
      locations.push(...skills.map(s => ({ type: 'personal' as const, path: s })));
    }
  }

  return locations;
}
```

#### 7. Distribution Strategy

**Phase 1: Claude Code Plugin (MVP)**
- Package agentlint as Claude Code plugin
- Distribute via official marketplace
- Includes slash commands, analysis agent

**Phase 2: Agent Skill Packaging (Post-MVP)**
- Evaluate demand after marketplace launch
- Package as Agent Skill for cross-platform invocation
- Enables other agents (Cursor, VS Code) to invoke agentlint

Plugin structure:
```
agentlint/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── analyse.md
│   ├── baseline.md
│   └── recommend.md
├── agents/
│   └── agentlint-analyser/
└── skills/              # Future: agentlint as skill
```

#### 8. Quality Signals Extracted

| Signal | Type | Description |
|--------|------|-------------|
| name_valid | Boolean | Passes all naming conventions |
| name_issues | String[] | List of naming violations |
| description_quality | Enum | good/weak/missing |
| description_keywords | Boolean | Has "use when/for" triggers |
| instruction_tokens | Number | Estimated token count |
| instruction_lines | Number | Line count in body |
| size_class | Enum | optimal/acceptable/oversized |
| has_scripts | Boolean | scripts/ directory exists |
| has_references | Boolean | references/ directory exists |
| has_assets | Boolean | assets/ directory exists |
| frontmatter_valid | Boolean | YAML parses correctly |

