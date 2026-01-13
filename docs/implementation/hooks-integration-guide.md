# Hooks Integration Guide

Implementation details for Git hooks, Claude Code hooks, and shell prompt integration. See [ADR-0012](../architecture/adr/0012-incremental-analysis-strategy.md) and [ADR-0023](../architecture/adr/0023-git-hooks-integration.md) for decision rationale.

## Git Hook Installation

```typescript
// agentlint hooks install
async function installGitHooks(config: TriggerConfig): Promise<void> {
  const hooksDir = path.join(await getGitRoot(), '.git', 'hooks');

  for (const hookType of config.git_hooks) {
    const hookPath = path.join(hooksDir, hookType);
    const hookContent = generateHookScript(hookType, config.git_hook_mode);

    await writeHookFile(hookPath, hookContent);
    await chmod(hookPath, 0o755);
  }
}

function generateHookScript(hookType: string, mode: 'sync' | 'async'): string {
  if (mode === 'async') {
    return `#!/bin/sh
# agentlint ${hookType} hook (async mode)
agentlint analyse --trigger=${hookType} --background &
`;
  } else {
    return `#!/bin/sh
# agentlint ${hookType} hook (sync mode)
agentlint analyse --trigger=${hookType} --quick
`;
  }
}
```

## Claude Code Hook Setup

```typescript
// agentlint hooks install --claude-code
async function installClaudeCodeHook(): Promise<void> {
  const claudeHooksDir = path.join(os.homedir(), '.claude', 'hooks');
  await fs.mkdir(claudeHooksDir, { recursive: true });

  const hookScript = `#!/bin/bash
# agentlint SessionEnd hook
# Installed by: agentlint hooks install --claude-code

# Update staleness counter
agentlint _internal_increment_sessions

# Run background analysis
agentlint analyse --trigger=session-end --background --notify
`;

  const hookPath = path.join(claudeHooksDir, 'session-end.sh');
  await fs.writeFile(hookPath, hookScript);
  await fs.chmod(hookPath, 0o755);

  console.log(chalk.green('✓ Claude Code SessionEnd hook installed'));
  console.log(chalk.dim(`  Location: ${hookPath}`));
}
```

## Shell Prompt Integration

```typescript
// agentlint shell-init
function generateShellInit(shell: 'bash' | 'zsh' | 'fish'): string {
  const stalenessFile = path.join(
    process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'),
    'agentlint', 'staleness.json'
  );

  if (shell === 'zsh') {
    return `
# agentlint shell integration
_agentlint_prompt() {
  if [[ -f "${stalenessFile}" ]]; then
    local sessions=$(jq -r '.sessionsSinceAnalysis // 0' "${stalenessFile}" 2>/dev/null)
    if [[ "$sessions" -gt 0 ]]; then
      echo "⚠️ agentlint:$sessions "
    fi
  fi
}
# Add to right prompt or customize as needed
RPROMPT='$(_agentlint_prompt)'$RPROMPT
`;
  }

  if (shell === 'bash') {
    return `
# agentlint shell integration
_agentlint_ps1() {
  if [[ -f "${stalenessFile}" ]]; then
    local sessions=$(jq -r '.sessionsSinceAnalysis // 0' "${stalenessFile}" 2>/dev/null)
    if [[ "$sessions" -gt 0 ]]; then
      echo "⚠️ agentlint:$sessions "
    fi
  fi
}
PS1='$(_agentlint_ps1)'$PS1
`;
  }

  // fish shell
  return `
# agentlint shell integration
function _agentlint_prompt
  if test -f "${stalenessFile}"
    set sessions (jq -r '.sessionsSinceAnalysis // 0' "${stalenessFile}" 2>/dev/null)
    if test "$sessions" -gt 0
      echo "⚠️ agentlint:$sessions "
    end
  end
end
`;
}
```

## Staleness State Management

```typescript
// Internal command: agentlint _internal_increment_sessions
// Called by Claude Code hook when session ends
async function incrementSessionCount(): Promise<void> {
  const state = await loadStalenessState();
  state.sessionsSinceAnalysis += 1;
  state.lastSessionId = await getLatestSessionId();
  await saveStalenessState(state);

  // Send desktop notification if threshold exceeded
  const config = await loadConfig();
  if (state.sessionsSinceAnalysis >= config.triggers.staleness_sessions) {
    await sendDesktopNotification(
      'agentlint',
      `${state.sessionsSinceAnalysis} AI sessions since last analysis`,
      { action: 'agentlint analyse' }
    );
  }
}

// Called after any successful analysis
async function resetStalenessAfterAnalysis(): Promise<void> {
  const state = await loadStalenessState();
  state.sessionsSinceAnalysis = 0;
  state.lastAnalysisAt = new Date();
  await saveStalenessState(state);
}
```

## Adoption Auto-Detection

```typescript
async function detectRecommendationAdoption(
  rec: Recommendation,
  previousConfig: string,
  currentConfig: string
): Promise<AdoptionDetection> {
  // Strategy 1: Direct content match
  const contentMatch = currentConfig.includes(rec.suggestedContent);

  // Strategy 2: Semantic similarity (for paraphrased implementations)
  const semanticMatch = await checkSemanticSimilarity(rec, currentConfig);

  // Strategy 3: Git blame for relevant lines
  const gitEvidence = await findImplementationCommit(rec);

  if (contentMatch || semanticMatch.score > 0.8 || gitEvidence) {
    return {
      detected: true,
      confidence: calculateConfidence(contentMatch, semanticMatch, gitEvidence),
      evidence: {
        contentMatch,
        semanticScore: semanticMatch.score,
        commit: gitEvidence?.hash,
      },
      suggestConfirmation: true,
    };
  }

  return { detected: false };
}
```
