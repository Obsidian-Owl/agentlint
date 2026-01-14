---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0014: Credential Management Strategy

## Context and Problem Statement

agentlint requires LLM API credentials to function. Per ADR-0002, we use the Claude Agent SDK with Anthropic-only for MVP. We need a credential management strategy that:

1. Works seamlessly for **developer workstations** (interactive use)
2. Works seamlessly for **CI/CD pipelines** (automated use)
3. Follows Anthropic ecosystem conventions
4. Maintains Local-First principle (credentials never leave user's machine)

## Decision Drivers

- **Ecosystem Compatibility**: Match how Anthropic tools (Claude Code, aider, promptfoo) handle credentials
- **CI/CD Support**: Must work with GitHub Actions, GitLab CI, and other CI platforms
- **Developer Experience**: Simple setup, clear error messages, no friction
- **Security**: Credentials stored securely, never committed to repos
- **Zero Native Dependencies**: Avoid platform-specific compilation requirements (aligns with ADR-0001 Bun choice)
- **Local-First**: All credential storage remains on user's machine

## Considered Options

1. Environment variables only
2. Environment variables + system keychain (node-keytar)
3. Environment variables with fallback chain
4. Git-style credential helper pattern

## Decision Outcome

**Chosen option: "Environment variables with fallback chain"** because it provides the best balance of ecosystem compatibility (standard `ANTHROPIC_API_KEY`), CI/CD support (env vars work everywhere), developer convenience (optional local file fallback), and zero native dependencies.

### Credential Resolution Order

```
1. ANTHROPIC_API_KEY environment variable (highest priority)
2. ~/.agentlint/credentials file (TOML format)
3. Interactive prompt (if TTY available)
4. Error with setup instructions
```

### Consequences

**Good:**
- Matches Anthropic ecosystem conventions exactly
- Works in all CI/CD platforms without special configuration
- No native dependencies or platform-specific code
- Fallback file provides convenience for multi-project developers
- Clear separation: env var for CI, file for personal workstation

**Bad:**
- File-based credentials less secure than system keychain
- User must ensure `~/.agentlint/` is not synced to cloud storage
- No automatic credential rotation

**Neutral:**
- Requires user to add `~/.agentlint/` to global gitignore
- Interactive prompt only works in TTY environments

## Pros and Cons of Options

### Option 1: Environment Variables Only

Use only `ANTHROPIC_API_KEY` environment variable, no file storage.

- Good: Simplest implementation
- Good: Matches Anthropic SDK default behavior exactly
- Good: Works in all CI/CD environments
- Good: No file management complexity
- Neutral: Standard practice for API keys
- Bad: User must configure shell profile manually
- Bad: No convenient storage for multi-project use
- Bad: Poor error messages if not set

### Option 2: Environment Variables + System Keychain

Check env var first, fall back to system keychain via node-keytar.

- Good: Most secure local storage option
- Good: Credentials encrypted by OS
- Good: Familiar UX (like browser password managers)
- Neutral: Industry best practice for desktop apps
- Bad: Requires native compilation (node-gyp)
- Bad: Linux requires libsecret-dev installation
- Bad: Breaks in headless/Docker environments
- Bad: Adds ~2MB native dependency

### Option 3: Environment Variables with Fallback Chain

Check env var, then credentials file, then interactive prompt.

- Good: Works everywhere (CI, local, Docker)
- Good: No native dependencies
- Good: Matches Anthropic ecosystem conventions
- Good: Fallback file convenient for developers
- Good: Interactive prompt helps first-time setup
- Neutral: File stored in `~/.agentlint/credentials`
- Bad: File-based storage less secure than keychain
- Bad: User must protect credentials file

### Option 4: Git-style Credential Helper

External program protocol with get/store/erase operations.

- Good: Maximum extensibility
- Good: Can support any backend (keychain, vault, etc.)
- Good: Proven pattern from Git ecosystem
- Good: Future-proof architecture
- Neutral: Well-documented protocol
- Bad: High implementation complexity
- Bad: Overkill for single-provider MVP
- Bad: Requires users to understand helper concept

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All credentials stored locally; never transmitted except to user's LLM |
| II. Improvement-Oriented | N/A | Credential management is infrastructure, not analysis |
| III. Causal-First | N/A | Not applicable to credential storage |
| IV. Mixed-Methods | N/A | Not applicable to credential storage |
| V. Language-Agnostic | Yes | Credential system independent of analyzed project language |
| VI. Agent-Agnostic | Partial | Anthropic-only for MVP; structure supports future providers |
| VII. Intelligent Tooling | Yes | Clear fallback chain; agent can detect credential issues |
| VIII. Compounding Value | N/A | Not applicable to credential storage |
| IX. Agent-Aware | Yes | Credential errors reported clearly for agent reasoning |

## More Information

### Related Documents

- Design Decisions: [DD-015](../design-decisions.md#dd-015-credential-management)
- Prior Decisions: [ADR-0001 - Runtime Platform](./0001-runtime-platform-and-language.md), [ADR-0002 - Agentic Framework](./0002-agentic-framework-strategy.md)

### Research Sources

- [WorkOS - Best Practices for CLI Authentication](https://workos.com/blog/best-practices-for-cli-authentication-a-technical-guide)
- [Anthropic - API Key Best Practices](https://support.claude.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure)
- [Anthropic - Managing API Key Environment Variables in Claude Code](https://support.claude.com/en/articles/12304248-managing-api-key-environment-variables-in-claude-code)
- [GitHub Actions - Using Secrets in Workflows](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions)
- [Git - Credential Storage](https://git-scm.com/book/en/v2/Git-Tools-Credential-Storage)
- [node-keytar - Native Password Node Module](https://github.com/atom/node-keytar)
- [StepSecurity - GitHub Actions Secrets Best Practices](https://www.stepsecurity.io/blog/github-actions-secrets-management-best-practices)

### Implementation Notes

#### 1. Credential Resolution Chain

```typescript
interface Credentials {
  anthropicApiKey: string;
  // Future: additional provider keys
}

async function resolveCredentials(): Promise<Credentials> {
  // 1. Environment variable (highest priority, CI/CD standard)
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) {
    return { anthropicApiKey: envKey };
  }

  // 2. Credentials file (~/.agentlint/credentials)
  const fileCredentials = await loadCredentialsFile();
  if (fileCredentials?.anthropicApiKey) {
    return fileCredentials;
  }

  // 3. Interactive prompt (if TTY available)
  if (process.stdin.isTTY) {
    return await promptForCredentials();
  }

  // 4. Error with setup instructions
  throw new CredentialError(
    'No API key found. Set ANTHROPIC_API_KEY environment variable or run: agentlint auth'
  );
}
```

#### 2. Credentials File Format

```toml
# ~/.agentlint/credentials
# WARNING: Keep this file secure. Do not commit to version control.

[anthropic]
api_key = "sk-ant-..."

# Future providers (post-MVP)
# [openai]
# api_key = "sk-..."
```

#### 3. File Permissions

```typescript
async function saveCredentialsFile(credentials: Credentials): Promise<void> {
  const credPath = path.join(os.homedir(), '.agentlint', 'credentials');

  // Ensure directory exists
  await fs.mkdir(path.dirname(credPath), { recursive: true });

  // Write with restrictive permissions (owner read/write only)
  await Bun.write(credPath, formatToml(credentials));

  // Set file permissions to 600 (owner read/write only)
  if (process.platform !== 'win32') {
    await fs.chmod(credPath, 0o600);
  }
}
```

#### 4. Validation

```typescript
async function validateCredentials(credentials: Credentials): Promise<boolean> {
  // Basic format check
  if (!credentials.anthropicApiKey.startsWith('sk-ant-')) {
    console.warn('Warning: API key does not match expected Anthropic format');
    return false;
  }

  // Optional: Test API call (can be disabled for offline setup)
  try {
    const client = new Anthropic({ apiKey: credentials.anthropicApiKey });
    // Minimal API call to verify key works
    await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'test' }],
    });
    return true;
  } catch (error) {
    if (error.status === 401) {
      throw new CredentialError('Invalid API key');
    }
    // Network errors don't invalidate the key
    return true;
  }
}
```

#### 5. CLI Auth Command

```typescript
// agentlint auth
async function authCommand(): Promise<void> {
  console.log('Configuring agentlint credentials...\n');

  // Check if already configured
  const existing = await resolveCredentials().catch(() => null);
  if (existing) {
    const overwrite = await confirm('Credentials already configured. Overwrite?');
    if (!overwrite) return;
  }

  // Prompt for API key
  const apiKey = await password({
    message: 'Enter your Anthropic API key:',
    mask: '*',
  });

  // Validate
  const credentials = { anthropicApiKey: apiKey };
  const valid = await validateCredentials(credentials);

  if (!valid) {
    console.error('Error: Invalid API key');
    process.exit(1);
  }

  // Save
  await saveCredentialsFile(credentials);

  console.log('\n✓ Credentials saved to ~/.agentlint/credentials');
  console.log('  File permissions set to owner-only (600)');
  console.log('\nTip: For CI/CD, set ANTHROPIC_API_KEY environment variable instead.');
}
```

#### 6. Error Messages

```typescript
class CredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialError';
  }

  getHelpText(): string {
    return `
To configure credentials:

Option 1: Environment variable (recommended for CI/CD)
  export ANTHROPIC_API_KEY="sk-ant-..."

Option 2: Credentials file (recommended for local development)
  agentlint auth

Get your API key at: https://console.anthropic.com/settings/keys
    `.trim();
  }
}
```

#### 7. CI/CD Examples

**GitHub Actions:**
```yaml
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx agentlint analyse
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**GitLab CI:**
```yaml
analyze:
  script:
    - npx agentlint analyse
  variables:
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY  # From CI/CD settings
```

#### 8. Security Considerations

1. **File permissions**: Credentials file created with 600 permissions (owner read/write only)
2. **Never log credentials**: API key masked in all output
3. **Gitignore**: `~/.agentlint/` should be in global gitignore
4. **Validation**: Keys validated before storage
5. **No transmission**: Credentials only sent to Anthropic API endpoint
