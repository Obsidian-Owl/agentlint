---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0018: AI Tool Adapter Architecture

## Context and Problem Statement

agentlint must support analysis of multiple AI coding assistants (Claude Code, Cursor, Aider, etc.) while maintaining the Tool-Agnostic constitutional principle. Each AI tool has:

- Different session log formats (JSONL, SQLite, Markdown)
- Different configuration files (CLAUDE.md, .cursorrules, .aider.conf.yml)
- Different capabilities and workflows that may require tool-specific analysis strategies

Beyond parsing differences, the CTO identified that **analysis agents may need tool-specific configurations**: different system prompts, workflows, skills, or tools depending on which AI assistant is being analyzed. A user analyzing Claude Code sessions needs different agent behavior than one analyzing Aider sessions.

Additionally, many developers use **multiple AI tools** (e.g., Claude Code for complex tasks, Cursor for quick edits). The architecture must support unified analysis across tools.

## Decision Drivers

- **Tool-Agnostic (VI)**: Core analysis logic must be tool-independent; tool-specific code lives in adapters only
- **Reliable parsing**: Adapters provide deterministic parsing; agent analysis is flexible
- **Compounding Value (VIII)**: Baseline tracking compounds value over time across tool changes
- **Agent-Aware (IX)**: Tool-specific agent configurations impact analysis effectiveness
- **Maintainability**: Core team maintains all adapters; no third-party plugins
- **Extensibility**: Adding new AI tools should require only adapter implementation

## Considered Options

### Adapter Architecture
1. Strategy + Factory Pattern
2. Plugin Registry with Dynamic Loading
3. Monolithic with Conditionals

### Agent Configuration
1. Agent Profiles (adapter provides configuration)
2. Separate Agent Classes per Tool
3. Prompt Templates Only

### Multi-Tool Handling
1. Auto-Detect + Merge
2. Explicit User Selection
3. Primary + Secondary Mode

## Decision Outcome

### Adapter Architecture: Strategy + Factory Pattern

Chosen because:
- Clean separation of concerns (adapter interface defines contract)
- Factory creates correct adapter based on detection or user config
- No runtime code loading (security, simplicity)
- Type-safe implementation in TypeScript

### Agent Configuration: Agent Profiles

Chosen because:
- Each adapter provides an `AgentProfile` with tool-specific configuration
- AgentFactory uses profile to configure analysis agent at runtime
- Avoids code duplication of separate agent classes
- More flexible than just swapping prompts

### Multi-Tool Handling: Auto-Detect + Merge

Chosen because:
- Best UX: users don't need to specify tools manually
- Handles common case of multi-tool workflows
- User configures "primary tool" for recommendation prioritization
- Findings from all detected tools are merged into unified report

### Consequences

**Good:**
- Adding new AI tool requires only implementing AIToolAdapter interface
- Core analysis remains tool-agnostic; all tool-specific code in adapters
- Agent behavior customized per tool without separate agent classes
- Multi-tool users get unified analysis automatically
- Type-safe interfaces prevent integration errors

**Bad:**
- Adapter interface is large (5+ methods); new adapters require significant implementation
- Auto-detection may have false positives (need robust detection logic)
- Merged findings from multiple tools may be overwhelming
- Agent profiles add complexity vs simple prompt templates

**Neutral:**
- MVP focuses on Claude Code; adapter pattern validated but not stressed yet
- Other tools (Cursor, Aider) added in future releases

## Detailed Design

### 1. Core Interfaces

```typescript
/**
 * Main adapter interface for AI coding assistants.
 * Each supported tool implements this interface.
 */
interface AIToolAdapter {
  /** Unique identifier for this tool */
  readonly id: AIToolId;

  /** Human-readable name */
  readonly name: string;

  /** Tool version compatibility range */
  readonly supportedVersions: string;

  /**
   * Detect if this tool is used in the given project.
   * Returns confidence score 0-1 and detection evidence.
   */
  detect(projectPath: string): Promise<DetectionResult>;

  /**
   * Parse the tool's configuration files.
   * Returns normalized config structure.
   */
  parseConfig(projectPath: string): Promise<AIToolConfig>;

  /**
   * Parse session logs into normalized format.
   * Supports streaming for large logs (100MB+).
   */
  parseSessions(
    projectPath: string,
    options?: SessionParseOptions
  ): AsyncIterable<NormalizedSession>;

  /**
   * Generate tool-specific configuration content.
   * Used for recommendations that modify config files.
   */
  generateConfig(
    recommendations: ConfigRecommendation[],
    existingConfig?: AIToolConfig
  ): Promise<GeneratedConfig>;

  /**
   * Get agent profile for tool-specific analysis.
   * Defines system prompts, tools, and workflow hints.
   */
  getAgentProfile(): AgentProfile;
}

/** Tool identifiers */
type AIToolId =
  | 'claude-code'
  | 'cursor'
  | 'aider'
  | 'copilot'
  | 'generic';

/** Detection result with evidence */
interface DetectionResult {
  detected: boolean;
  confidence: number;  // 0-1
  evidence: {
    configFiles: string[];      // Found config files
    sessionLogs: string[];      // Found session directories
    toolMarkers: string[];      // Other indicators
  };
  version?: string;  // Detected tool version if available
}

/** Normalized configuration across tools */
interface AIToolConfig {
  toolId: AIToolId;
  configPath: string;

  // Common config concepts mapped from tool-specific formats
  systemPrompt?: string;
  projectContext?: string;
  codeStyle?: CodeStyleConfig;
  allowedTools?: string[];
  disallowedPatterns?: string[];

  // Tool-specific raw config for advanced analysis
  raw: unknown;
}

/** Normalized session format (tool-agnostic) */
interface NormalizedSession {
  id: string;
  toolId: AIToolId;
  startTime: Date;
  endTime?: Date;

  turns: SessionTurn[];

  metrics: {
    inputTokens: number;
    outputTokens: number;
    turnCount: number;
    toolCalls: Record<string, number>;
    duration?: number;
  };

  metadata: {
    gitBranch?: string;
    gitCommit?: string;
    modelUsed?: string;
    projectPath?: string;
  };
}

interface SessionTurn {
  timestamp: Date;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}
```

### 2. Agent Profile System

```typescript
/**
 * Agent profile defines tool-specific agent configuration.
 * Used by AgentFactory to customize analysis behavior.
 */
interface AgentProfile {
  toolId: AIToolId;

  /** System prompt additions for this tool */
  systemPromptAdditions: string;

  /** Tool-specific analysis prompts */
  prompts: {
    configAnalysis: string;
    sessionAnalysis: string;
    recommendationGeneration: string;
  };

  /** Tool-specific skills/workflows */
  skills: AgentSkill[];

  /** Tool-specific tools for the agent */
  tools: AgentTool[];

  /** Workflow hints for analysis ordering */
  workflowHints: {
    priorityDomains: AnalysisDomain[];
    skipDomains?: AnalysisDomain[];
    configEmphasis: 'high' | 'medium' | 'low';
    sessionEmphasis: 'high' | 'medium' | 'low';
  };

  /** Model preferences for this tool (optional override) */
  modelPreferences?: {
    preferredModel?: string;
    temperatureOverrides?: {
      extraction?: number;
      reasoning?: number;
      synthesis?: number;
    };
  };
}

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: unknown) => Promise<unknown>;
}
```

### 3. Adapter Factory

```typescript
/**
 * Factory for creating and managing AI tool adapters.
 */
class AIToolAdapterFactory {
  private adapters: Map<AIToolId, AIToolAdapter> = new Map();

  constructor() {
    // Register all built-in adapters
    this.register(new ClaudeCodeAdapter());
    // Future: this.register(new CursorAdapter());
    // Future: this.register(new AiderAdapter());
    this.register(new GenericAdapter());
  }

  register(adapter: AIToolAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(toolId: AIToolId): AIToolAdapter {
    const adapter = this.adapters.get(toolId);
    if (!adapter) {
      throw new Error(`Unknown AI tool: ${toolId}`);
    }
    return adapter;
  }

  /**
   * Auto-detect all AI tools used in a project.
   * Returns adapters sorted by detection confidence.
   */
  async detectAll(projectPath: string): Promise<DetectedTool[]> {
    const results: DetectedTool[] = [];

    for (const adapter of this.adapters.values()) {
      if (adapter.id === 'generic') continue;  // Skip generic in detection

      const detection = await adapter.detect(projectPath);
      if (detection.detected) {
        results.push({
          adapter,
          detection,
        });
      }
    }

    // Sort by confidence descending
    return results.sort((a, b) => b.detection.confidence - a.detection.confidence);
  }

  /**
   * Get primary adapter based on user config or auto-detection.
   */
  async getPrimary(
    projectPath: string,
    userPreference?: AIToolId
  ): Promise<AIToolAdapter> {
    if (userPreference) {
      return this.get(userPreference);
    }

    const detected = await this.detectAll(projectPath);
    if (detected.length === 0) {
      return this.get('generic');
    }

    return detected[0].adapter;
  }
}

interface DetectedTool {
  adapter: AIToolAdapter;
  detection: DetectionResult;
}
```

### 4. Agent Factory

```typescript
/**
 * Factory for creating analysis agents with tool-specific configuration.
 */
class AnalysisAgentFactory {
  private adapterFactory: AIToolAdapterFactory;
  private baseSystemPrompt: string;

  constructor(adapterFactory: AIToolAdapterFactory) {
    this.adapterFactory = adapterFactory;
    this.baseSystemPrompt = AGENTLINT_BASE_SYSTEM_PROMPT;
  }

  /**
   * Create an analysis agent configured for specific AI tool(s).
   */
  async createAgent(
    projectPath: string,
    options: AgentCreationOptions
  ): Promise<AnalysisAgent> {
    const { primaryTool, additionalTools } = options;

    // Get primary adapter and profile
    const primaryAdapter = await this.adapterFactory.getPrimary(
      projectPath,
      primaryTool
    );
    const primaryProfile = primaryAdapter.getAgentProfile();

    // Merge profiles if multi-tool
    let mergedProfile = primaryProfile;
    if (additionalTools?.length) {
      const additionalProfiles = additionalTools.map(toolId =>
        this.adapterFactory.get(toolId).getAgentProfile()
      );
      mergedProfile = this.mergeProfiles(primaryProfile, additionalProfiles);
    }

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(mergedProfile);

    // Create agent with configured profile
    return new AnalysisAgent({
      systemPrompt,
      tools: mergedProfile.tools,
      skills: mergedProfile.skills,
      workflowHints: mergedProfile.workflowHints,
      model: mergedProfile.modelPreferences?.preferredModel,
      temperatures: mergedProfile.modelPreferences?.temperatureOverrides,
    });
  }

  private buildSystemPrompt(profile: AgentProfile): string {
    return `${this.baseSystemPrompt}

## Tool-Specific Context

${profile.systemPromptAdditions}

## Analysis Focus

- Config emphasis: ${profile.workflowHints.configEmphasis}
- Session emphasis: ${profile.workflowHints.sessionEmphasis}
- Priority domains: ${profile.workflowHints.priorityDomains.join(', ')}
`;
  }

  private mergeProfiles(
    primary: AgentProfile,
    additional: AgentProfile[]
  ): AgentProfile {
    // Primary profile takes precedence; additional tools add context
    return {
      ...primary,
      systemPromptAdditions: [
        primary.systemPromptAdditions,
        '## Additional Tool Context',
        ...additional.map(p =>
          `### ${p.toolId}\n${p.systemPromptAdditions}`
        ),
      ].join('\n\n'),
      tools: [
        ...primary.tools,
        ...additional.flatMap(p => p.tools),
      ],
      skills: [
        ...primary.skills,
        ...additional.flatMap(p => p.skills),
      ],
    };
  }
}

interface AgentCreationOptions {
  primaryTool?: AIToolId;
  additionalTools?: AIToolId[];
  modelOverride?: string;
}
```

### 5. Example: Claude Code Adapter

```typescript
class ClaudeCodeAdapter implements AIToolAdapter {
  readonly id = 'claude-code' as const;
  readonly name = 'Claude Code';
  readonly supportedVersions = '>=1.0.0';

  async detect(projectPath: string): Promise<DetectionResult> {
    const evidence = {
      configFiles: [] as string[],
      sessionLogs: [] as string[],
      toolMarkers: [] as string[],
    };

    // Check for CLAUDE.md
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    if (await fileExists(claudeMdPath)) {
      evidence.configFiles.push(claudeMdPath);
    }

    // Check for .claude directory
    const claudeDir = path.join(projectPath, '.claude');
    if (await dirExists(claudeDir)) {
      evidence.toolMarkers.push(claudeDir);
    }

    // Check for session logs in global Claude directory
    const globalSessionDir = path.join(
      os.homedir(),
      '.claude',
      'projects',
      this.hashProjectPath(projectPath),
      'sessions'
    );
    if (await dirExists(globalSessionDir)) {
      const sessions = await glob('*.jsonl', { cwd: globalSessionDir });
      evidence.sessionLogs.push(...sessions.map(s => path.join(globalSessionDir, s)));
    }

    const detected = evidence.configFiles.length > 0 ||
                     evidence.sessionLogs.length > 0 ||
                     evidence.toolMarkers.length > 0;

    // Calculate confidence based on evidence
    let confidence = 0;
    if (evidence.configFiles.length > 0) confidence += 0.4;
    if (evidence.sessionLogs.length > 0) confidence += 0.4;
    if (evidence.toolMarkers.length > 0) confidence += 0.2;

    return { detected, confidence, evidence };
  }

  async parseConfig(projectPath: string): Promise<AIToolConfig> {
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    const content = await Bun.file(claudeMdPath).text().catch(() => '');

    return {
      toolId: 'claude-code',
      configPath: claudeMdPath,
      systemPrompt: content,
      raw: { markdown: content },
    };
  }

  async *parseSessions(
    projectPath: string,
    options?: SessionParseOptions
  ): AsyncIterable<NormalizedSession> {
    const sessionDir = this.getSessionDir(projectPath);
    const files = await glob('*.jsonl', { cwd: sessionDir });

    for (const file of files) {
      const filePath = path.join(sessionDir, file);
      yield await this.parseSessionFile(filePath);
    }
  }

  private async parseSessionFile(filePath: string): Promise<NormalizedSession> {
    const content = await Bun.file(filePath).text();
    const lines = content.trim().split('\n');

    const turns: SessionTurn[] = [];
    let inputTokens = 0;
    let outputTokens = 0;

    for (const line of lines) {
      const entry = JSON.parse(line);

      turns.push({
        timestamp: new Date(entry.timestamp),
        role: entry.role,
        content: entry.content,
        toolCalls: entry.tool_calls,
        toolResults: entry.tool_results,
      });

      if (entry.token_count) {
        if (entry.role === 'user') inputTokens += entry.token_count;
        else outputTokens += entry.token_count;
      }
    }

    const toolUsage: Record<string, number> = {};
    for (const turn of turns) {
      for (const call of turn.toolCalls ?? []) {
        toolUsage[call.name] = (toolUsage[call.name] ?? 0) + 1;
      }
    }

    return {
      id: path.basename(filePath, '.jsonl'),
      toolId: 'claude-code',
      startTime: turns[0]?.timestamp ?? new Date(),
      endTime: turns[turns.length - 1]?.timestamp,
      turns,
      metrics: {
        inputTokens,
        outputTokens,
        turnCount: turns.length,
        toolCalls: toolUsage,
      },
      metadata: {},
    };
  }

  async generateConfig(
    recommendations: ConfigRecommendation[],
    existingConfig?: AIToolConfig
  ): Promise<GeneratedConfig> {
    const existingContent = (existingConfig?.raw as { markdown?: string })?.markdown ?? '';

    // Generate CLAUDE.md sections based on recommendations
    const newSections = recommendations.map(rec =>
      this.recommendationToMarkdown(rec)
    );

    return {
      path: existingConfig?.configPath ?? 'CLAUDE.md',
      content: existingContent + '\n\n' + newSections.join('\n\n'),
      format: 'markdown',
    };
  }

  getAgentProfile(): AgentProfile {
    return {
      toolId: 'claude-code',

      systemPromptAdditions: `
You are analyzing a project that uses Claude Code as its AI coding assistant.

Claude Code stores configuration in CLAUDE.md files with hierarchical inheritance:
- Enterprise level: ~/.claude/CLAUDE.md
- User level: ~/CLAUDE.md
- Project level: ./CLAUDE.md
- Folder level: ./src/CLAUDE.md (applies to subdirectory)

Claude Code sessions are stored as JSONL files with:
- Timestamps, roles (user/assistant/system/tool)
- Tool calls (Read, Write, Edit, Bash, Glob, Grep, etc.)
- Token counts and model information

When analyzing Claude Code usage, pay attention to:
- CLAUDE.md structure and completeness
- Tool usage patterns (over-reliance on certain tools)
- Session efficiency (turns per task, token usage)
- Memory/context usage (@-mentions, imports)
`,

      prompts: {
        configAnalysis: `Analyze this CLAUDE.md configuration for:
1. Completeness: Does it cover key project patterns?
2. Structure: Is it well-organized with clear sections?
3. Specificity: Are instructions concrete vs vague?
4. Conflicts: Any contradictory guidance?`,

        sessionAnalysis: `Analyze these Claude Code sessions for:
1. Efficiency: Turns per completed task
2. Tool usage: Which tools are used most/least?
3. Patterns: Repeated mistakes or clarifications
4. Context: Is project context being utilized?`,

        recommendationGeneration: `Generate CLAUDE.md recommendations that:
1. Address specific issues found in analysis
2. Use Claude Code's section syntax (## headers)
3. Are actionable and concrete
4. Leverage Claude Code features (imports, @-mentions)`,
      },

      skills: [
        {
          id: 'claude-md-generator',
          name: 'CLAUDE.md Generator',
          description: 'Generate CLAUDE.md sections from patterns',
          prompt: 'Generate a CLAUDE.md section for: {topic}',
        },
      ],

      tools: [
        // Claude Code-specific analysis tools would go here
      ],

      workflowHints: {
        priorityDomains: ['config', 'session', 'docs'],
        configEmphasis: 'high',
        sessionEmphasis: 'high',
      },
    };
  }

  private hashProjectPath(projectPath: string): string {
    // Claude Code uses a specific hashing scheme for project paths
    return Bun.hash(projectPath).toString(16);
  }

  private getSessionDir(projectPath: string): string {
    return path.join(
      os.homedir(),
      '.claude',
      'projects',
      this.hashProjectPath(projectPath),
      'sessions'
    );
  }

  private recommendationToMarkdown(rec: ConfigRecommendation): string {
    return `## ${rec.title}\n\n${rec.content}`;
  }
}
```

### 6. Generic Adapter for Unknown Tools

```typescript
class GenericAdapter implements AIToolAdapter {
  readonly id = 'generic' as const;
  readonly name = 'Generic AI Tool';
  readonly supportedVersions = '*';

  async detect(projectPath: string): Promise<DetectionResult> {
    // Generic adapter always "detects" with low confidence
    // Used when no specific tool is detected
    return {
      detected: true,
      confidence: 0.1,
      evidence: {
        configFiles: [],
        sessionLogs: [],
        toolMarkers: [],
      },
    };
  }

  async parseConfig(projectPath: string): Promise<AIToolConfig> {
    // Try to find common AI config patterns
    const candidates = [
      'CLAUDE.md',
      '.cursorrules',
      '.aider.conf.yml',
      'AI_INSTRUCTIONS.md',
      '.ai-config.json',
    ];

    for (const candidate of candidates) {
      const filePath = path.join(projectPath, candidate);
      if (await fileExists(filePath)) {
        const content = await Bun.file(filePath).text();
        return {
          toolId: 'generic',
          configPath: filePath,
          systemPrompt: content,
          raw: { content },
        };
      }
    }

    return {
      toolId: 'generic',
      configPath: '',
      raw: {},
    };
  }

  async *parseSessions(): AsyncIterable<NormalizedSession> {
    // Generic adapter doesn't parse sessions without tool-specific knowledge
    // This is a no-op; users should configure a specific tool
  }

  async generateConfig(
    recommendations: ConfigRecommendation[]
  ): Promise<GeneratedConfig> {
    // Generate a generic AI instructions file
    const content = recommendations.map(rec =>
      `# ${rec.title}\n\n${rec.content}`
    ).join('\n\n---\n\n');

    return {
      path: 'AI_INSTRUCTIONS.md',
      content,
      format: 'markdown',
    };
  }

  getAgentProfile(): AgentProfile {
    return {
      toolId: 'generic',

      systemPromptAdditions: `
You are analyzing a project that uses an unidentified AI coding assistant.

Focus on universal patterns:
- Documentation quality (README, docs/)
- Code structure and conventions
- Type safety and linting
- General AI-readiness

Recommendations should be tool-agnostic and applicable to any AI assistant.
`,

      prompts: {
        configAnalysis: 'Analyze project documentation for AI assistant guidance.',
        sessionAnalysis: 'No session data available for generic analysis.',
        recommendationGeneration: 'Generate tool-agnostic recommendations.',
      },

      skills: [],
      tools: [],

      workflowHints: {
        priorityDomains: ['docs', 'code', 'tooling'],
        configEmphasis: 'low',
        sessionEmphasis: 'low',
      },
    };
  }
}
```

### 7. Multi-Tool Analysis Orchestration

```typescript
/**
 * Orchestrates analysis across multiple detected AI tools.
 */
class MultiToolAnalyzer {
  private adapterFactory: AIToolAdapterFactory;
  private agentFactory: AnalysisAgentFactory;

  async analyze(
    projectPath: string,
    options: MultiToolAnalysisOptions
  ): Promise<MultiToolAnalysisResult> {
    // 1. Detect all tools
    const detected = await this.adapterFactory.detectAll(projectPath);

    if (detected.length === 0) {
      // Fall back to generic analysis
      return this.analyzeWithAdapter(
        projectPath,
        this.adapterFactory.get('generic'),
        options
      );
    }

    // 2. Determine primary tool (user preference or highest confidence)
    const primaryTool = options.primaryTool ?? detected[0].adapter.id;
    const additionalTools = detected
      .filter(d => d.adapter.id !== primaryTool)
      .map(d => d.adapter.id);

    // 3. Create multi-tool agent
    const agent = await this.agentFactory.createAgent(projectPath, {
      primaryTool,
      additionalTools,
    });

    // 4. Run analysis for each tool
    const findings: ToolFindings[] = [];

    for (const { adapter } of detected) {
      const toolFindings = await this.analyzeWithAdapter(
        projectPath,
        adapter,
        options
      );
      findings.push({
        toolId: adapter.id,
        findings: toolFindings,
      });
    }

    // 5. Merge and synthesize
    const merged = this.mergeFindings(findings, primaryTool);

    return {
      detectedTools: detected.map(d => ({
        id: d.adapter.id,
        confidence: d.detection.confidence,
      })),
      primaryTool,
      findings: merged,
      recommendations: await this.generateRecommendations(merged, agent),
    };
  }

  private mergeFindings(
    toolFindings: ToolFindings[],
    primaryTool: AIToolId
  ): MergedFindings {
    // Deduplicate cross-tool findings
    // Prioritize primary tool's findings for conflicts
    // Tag findings with source tool for attribution
    // ...
  }
}

interface MultiToolAnalysisOptions {
  primaryTool?: AIToolId;
  domains?: AnalysisDomain[];
  includeSessions?: boolean;
}
```

### 8. User Configuration

```toml
# ~/.config/agentlint/config.toml

version = 1

[tools]
# User's preferred AI tool (used when multiple detected)
primary = "claude-code"

# Tools to always include in analysis
# include = ["claude-code", "cursor"]

# Tools to exclude from analysis
# exclude = ["aider"]

[tools.claude-code]
# Tool-specific overrides
session_path = "~/.claude/projects"

[tools.cursor]
# session_path = "~/.cursor/history"

# Per-project override in .agentlint/config.toml
# [tools]
# primary = "cursor"
```

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All parsing and analysis runs locally |
| II. Improvement-Oriented | Yes | Supports baseline comparison across tool switches |
| III. Causal-First | Yes | Sessions link to issues regardless of source tool |
| IV. Mixed-Methods | Yes | Adapters support both quantitative (metrics) and qualitative (content) |
| V. Language-Agnostic | Yes | Adapter pattern is language-independent |
| VI. Tool-Agnostic | Yes | Core design; this ADR implements the constitutional requirement |
| VII. Intelligent Tooling | Yes | Adapters provide structured data; agent freely analyzes |
| VIII. Compounding Value | Yes | Baselines persist across tool changes for compound value |
| IX. Agent-Aware | Yes | AgentProfile customizes agent behavior per tool |

## More Information

### Related Documents
- [ADR-0006: Agentic Analysis Implementation](./0006-agent-orchestrated-analysis.md) - Vercel AI SDK for LLM integration
- [ADR-0007: Causal Analysis Architecture](./0007-causal-analysis-architecture.md) - Session parsing requirements
- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md) - Subagent pattern
- Design Questions: [Section 5.1 - Plugin Architecture for AI Tools](../../design-questions.md#51-plugin-architecture-for-ai-tools)
- Architecture Vision: [Section 2 - Design Principles](../../agentlint-architecture-vision.md#design-principles)

### Research Sources
- [Vercel AI SDK Multi-Provider](https://ai-sdk.dev/docs/introduction) - Provider abstraction patterns
- [TypeScript Adapter Pattern](https://refactoring.guru/design-patterns/adapter/typescript/example) - Implementation patterns
- [TypeScript Strategy + Factory](https://gist.github.com/shershen08/232f7518daa8142841c31e061ce91f40) - Combined pattern example
- [Agent System Design Patterns](https://docs.databricks.com/aws/en/generative-ai/guide/agent-system-design-patterns) - Multi-agent routing
- [Claude Code vs Cursor Comparison](https://www.qodo.ai/blog/claude-code-vs-cursor/) - Tool differences
- [Vibe-Log CLI](https://github.com/vibe-log/vibe-log-cli) - Similar session analysis tool
- [Aider Documentation](https://aider.chat/docs/faq.html) - Aider log format

### Implementation Notes

#### MVP Scope
- Implement `ClaudeCodeAdapter` fully
- Implement `GenericAdapter` as fallback
- Stub interfaces for `CursorAdapter` and `AiderAdapter`
- Validate adapter pattern with real Claude Code sessions

#### Future Adapters (Post-MVP)
| Tool | Priority | Complexity | Notes |
|------|----------|------------|-------|
| Cursor | High | Medium | SQLite logs, proprietary format |
| Aider | Medium | Low | Markdown logs, well-documented |
| Copilot CLI | Low | Medium | Varies by installation |
| Windsurf | Low | Unknown | Research needed |

#### Follow-Up Decisions
1. **Adapter Testing**: How to test adapters without access to all tools?
2. **Version Compatibility**: How to handle tool version changes that break parsing?
3. **Session Privacy**: Should adapters redact sensitive content during parsing?
