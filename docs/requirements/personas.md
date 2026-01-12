# agentlint User Personas

> Derived from Architecture Vision section 2: "Who It's For"
> Validated against external research (January 2026)
> Enhanced with Agent Experience (AX) framework from CCA research

## The agentlint AI Agent

### Persona 0: The agentlint Agent

- **Role**: agentlint's own AI agent that performs analysis, generates recommendations, and traces issues
- **Goal**: Receive distilled, structured context about target repositories that enables stable reasoning and accurate analysis
- **Pain Points**:
  - Large session logs that exceed context limits
  - Unstructured project information requiring repeated exploration
  - Ambiguous analysis goals leading to unfocused recommendations
  - No memory of previous analyses of the same project
  - Difficulty correlating signals across multiple analysis domains
- **Context**: Every agentlint analysis session
- **Key Insight**: agentlint's effectiveness depends on how well we serve our own agent's cognitive needs. A well-structured working memory enables accurate, consistent analysis.

**What The agentlint Agent Needs**:
1. **Clear task framing**: What are we analyzing and why?
2. **Compressed project context**: Distilled configs, session stats, code samples—not raw data
3. **Hierarchical memory**: Task goals, progress, findings organized for easy reference
4. **Static pre-processing**: Metrics extracted deterministically before LLM reasoning
5. **Baseline awareness**: Previous analysis results for trend comparison
6. **Scoped focus**: One domain at a time, not everything at once

**Why This Persona Matters**: We "eat our own dog food"—agentlint's agent should embody the AX principles we recommend to users. When we design our analysis pipeline, we're asking: "Does this serve our own Agent well?"

**Self-Application**: The agentlint agent experiences the same challenges as the coding agents it analyzes. By optimizing for our own agent's cognitive experience, we validate the AX principles we measure in target repositories.

---

## Primary Personas (MVP)

### Persona 1: The Optimizer

- **Role**: Solo developer using Claude Code
- **Goal**: Get better results from AI assistance and track improvement over time
- **Pain Points**:
  - Doesn't know if CLAUDE.md is effective or follows best practices
  - Can't measure AI session quality objectively
  - Unsure what configuration options exist
  - No way to know if changes actually improve outcomes
- **Context**: Works on personal or small team projects
- **Key Insight**: Research shows developers believe they're 20% faster with AI but are actually 19% slower—The Optimizer needs objective measurement to break through this perception gap.

### Persona 2: The Multi-Tool User

- **Role**: Developer using multiple AI assistants (Claude Code, Cursor, Copilot)
- **Goal**: Unified configuration management and effectiveness comparison
- **Pain Points**:
  - Different config formats for each tool (CLAUDE.md, .cursorrules, copilot-instructions.md)
  - Conflicting or redundant guidance across tools
  - No way to compare effectiveness between tools
  - Manual effort to keep configs in sync
- **Context**: Evaluating tools, switching between them, or using different tools for different tasks
- **Key Insight**: Some developers blend tools (Claude Code for complex reasoning, Cursor for flow) but lack unified tracking.

### Persona 3: The Vibe Coder

- **Role**: Developer heavily reliant on AI for majority of coding tasks
- **Goal**: Maximise AI output quality and reduce iteration costs
- **Pain Points**:
  - Sessions take too many iterations (high rework rate)
  - AI often misunderstands intent or context
  - High token costs for simple tasks
  - 67% of time spent debugging AI-generated code (per JetBrains research)
- **Context**: Uses AI for majority of coding tasks, cost-sensitive
- **Key Insight**: Research shows Claude Code produces 30% less rework than alternatives—The Vibe Coder needs to understand what configurations and practices drive this.

### Persona 4: The Context Engineer

- **Role**: Developer who has studied AI coding best practices
- **Goal**: Apply context engineering principles systematically and validate compliance
- **Pain Points**:
  - Knows CLAUDE.md best practices but can't validate compliance automatically
  - Wants to modularize context but unsure of impact
  - Needs to tune instructions ("IMPORTANT", "YOU MUST") but lacks feedback loop
  - No tool to check if config follows Anthropic's recommendations
- **Context**: Has read Anthropic's context engineering guide, wants to optimise systematically
- **Key Insight**: Even Anthropic's team "runs CLAUDE.md files through the prompt improver"—this persona wants similar capabilities locally.

## Future Personas (Post-MVP)

### Team Lead

- Establishing AI coding standards across team
- Needs visibility into team-wide AI effectiveness
- Wants shared configuration templates

### Enterprise Architect

- Requiring governance and audit trails for AI-assisted development
- Compliance and security review of AI configurations
- Cost tracking and optimization at scale

### Platform Engineer

- Integrating AI tooling into CI/CD pipelines
- Automating configuration validation
- Building internal developer platforms with AI assistance
