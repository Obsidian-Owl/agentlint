---
status: accepted
date: 2026-01-12
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0005: Credential Storage Strategy

## Context and Problem Statement

agentlint requires LLM API credentials (e.g., Anthropic API key) for agentic analysis features. These credentials are sensitive and must be handled securely. The tool needs a strategy for reading credentials that balances security, user convenience, and cross-platform compatibility. With Bun selected as the runtime (ADR-0001), its native `Bun.secrets` API provides OS-level keychain integration.

## Decision Drivers

- **Security**: API keys must never be stored in plain text files or committed to source control
- **Local-First principle**: Credentials stay on user's machine
- **User convenience**: Common patterns should be easy (env vars), advanced patterns supported (keychain)
- **Cross-platform**: macOS (MVP primary), with Linux/Windows support via Bun.secrets
- **Anthropic alignment**: Follow Anthropic's official best practices for API key handling
- **LLM Required**: agentlint requires LLM credentials for core analysis functionality

## Considered Options

1. Environment Variables + Bun.secrets Keychain Fallback
2. Environment Variables Only
3. Environment Variables + Config File Reference (command execution)
4. Full Cascade (Env → Config → Keychain → prompts)

## Decision Outcome

Chosen option: **"Environment Variables + Bun.secrets Keychain Fallback"** because it provides the best security (OS-level keychain encryption) while following Anthropic's official recommendation (env vars) as the primary method. The fallback to Bun.secrets allows power users to leverage OS keychain without compromising simplicity for basic usage.

### Credential Lookup Order

1. **Environment variable** (highest priority): `ANTHROPIC_API_KEY`
2. **OS Keychain via Bun.secrets**: `Bun.secrets.get({ service: "agentlint", name: "anthropic_api_key" })`
3. **Not configured**: Interactive prompt to configure credentials (LLM is required for analysis)

### Helper Command

agentlint will provide a convenience command to add credentials to the OS keychain:

```bash
# Add API key to OS keychain
agentlint config set-key anthropic <api-key>

# Verify credential is accessible
agentlint config check-key anthropic

# Remove API key from OS keychain
agentlint config delete-key anthropic
```

This writes via `Bun.secrets.set()` to the OS keychain (macOS Keychain, Windows Credential Manager, or Linux libsecret).

### Consequences

**Good:**
- Follows Anthropic's official best practices (env var primary)
- OS-level encryption for keychain storage (highest security)
- No plain text credential storage in config files
- Cross-platform via Bun.secrets (macOS, Linux, Windows)
- Convenience command reduces friction for keychain setup
- Interactive setup prompt guides users when credentials missing

**Bad:**
- Bun.secrets API is experimental (acceptable risk per scope decision)
- Users unfamiliar with keychain may need documentation
- Helper command means agentlint does write credentials (to secure storage only)

**Neutral:**
- Different user experiences (env var users vs keychain users)
- Need to document both approaches clearly

## Pros and Cons of Options

### Option 1: Environment Variables + Bun.secrets Keychain Fallback

Primary lookup from `ANTHROPIC_API_KEY` env var, fallback to OS keychain via Bun's native secrets API.

- Good: Follows Anthropic official recommendation as primary
- Good: OS-level encryption for keychain (highest security)
- Good: Cross-platform via Bun.secrets
- Good: No external dependencies (Bun-native)
- Neutral: Bun.secrets is experimental but released in production
- Bad: Two code paths to maintain and test

### Option 2: Environment Variables Only

Only read from `ANTHROPIC_API_KEY` environment variable.

- Good: Simplest implementation
- Good: Exactly matches Anthropic documentation
- Good: No experimental APIs
- Bad: No convenience for keychain users
- Bad: Users must manage shell config files
- Bad: Less secure than keychain (env vars visible in process list)

### Option 3: Environment Variables + Config File Reference

Allow config file to reference env vars or execute commands for credential lookup.

```toml
[credentials]
anthropic_api_key = "$ANTHROPIC_API_KEY"
# OR
anthropic_api_key_cmd = "security find-generic-password -s 'anthropic' -w"
```

- Good: Maximum flexibility
- Good: Supports any credential source via command
- Bad: Command execution has security implications
- Bad: More complex config parsing
- Bad: Platform-specific commands in config

### Option 4: Full Cascade

Check all sources in order: env vars → config reference → keychain → interactive prompt.

- Good: Maximum flexibility
- Bad: Most complex implementation
- Bad: Harder to document and debug
- Bad: Inconsistent user experience

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All credentials stored locally, never transmitted |
| II. Improvement-Oriented | N/A | Credential storage doesn't affect improvement tracking |
| III. Causal-First | N/A | Credential storage doesn't affect tracing |
| IV. Mixed-Methods | N/A | Credential storage doesn't affect analysis methods |
| V. Language-Agnostic | Yes | Credential handling is independent of target language |
| VI. Tool-Agnostic | Yes | Supports credentials for any future LLM provider |
| VII. Intelligent Tooling | N/A | Credential storage doesn't affect analysis approach |
| VIII. Compounding Value | Yes | Credential persistence enables baseline tracking across sessions |
| IX. Agent-Aware | N/A | Credential storage doesn't affect agent architecture |

## More Information

### Related Documents
- [ADR-0001: Language and Runtime Selection](./0001-language-and-runtime-selection.md) - Establishes Bun with Bun.secrets API
- [ADR-0004: Configuration File Locations](./0004-configuration-file-locations.md) - Config file locations (credentials NOT stored here)
- Design Questions: [Section 1.5 - Credential Storage](../../design-questions.md#15-credential-storage)

### Research Sources
- [Bun Secrets API Documentation](https://bun.com/docs/runtime/secrets) - Native credential storage API
- [Bun v1.2.21 Release Notes](https://bun.com/blog/release-notes/bun-v1.2.21) - Secrets API release
- [Claude API Key Best Practices](https://support.claude.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure) - Anthropic official guidance
- [Managing API Key Environment Variables in Claude Code](https://support.claude.com/en/articles/12304248-managing-api-key-environment-variables-in-claude-code) - Claude Code patterns
- [AWS CLI Configuration Variables](https://docs.aws.amazon.com/cli/latest/topic/config-vars.html) - Precedence pattern reference
- [API Key Management Best Practices 2025](https://dev.to/hamd_writer_8c77d9c88c188/api-keys-the-complete-2025-guide-to-security-management-and-best-practices-3980) - Security best practices
- [Secure Storage of Shell Secrets](https://dustinrue.com/2025/02/secure-storage-of-shell-secrets-such-as-api-keys/) - Keychain integration patterns

### Supported Providers (MVP)

| Provider | Env Variable | Keychain Name |
|----------|--------------|---------------|
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic_api_key` |

Future providers can be added following the same pattern.

### Implementation Notes

1. **Lookup Implementation**:
```typescript
async function getApiKey(provider: string): Promise<string | null> {
  // 1. Check environment variable first
  const envKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (envKey) return envKey;

  // 2. Fallback to OS keychain via Bun.secrets
  try {
    const keychainKey = await Bun.secrets.get({
      service: "agentlint",
      name: `${provider.toLowerCase()}_api_key`,
    });
    if (keychainKey) return keychainKey;
  } catch (error) {
    // Keychain access may fail (permissions, not available)
    console.warn(`Keychain access failed: ${error.message}`);
  }

  // 3. Not configured
  return null;
}
```

2. **Helper Command Implementation**:
```typescript
// agentlint config set-key anthropic <key>
await Bun.secrets.set({
  service: "agentlint",
  name: "anthropic_api_key",
  value: apiKey,
});
```

3. **Security Considerations**:
   - Never log or display API keys (mask in output)
   - Clear key from memory after use where possible
   - Warn if env var appears to be in a dotenv file tracked by git

4. **Error Messages**:
   - Clear guidance when no credentials found
   - Distinguish between "not configured" and "access denied"
   - Suggest both env var and keychain setup options

5. **Testing**:
   - Mock Bun.secrets in tests
   - Test fallback behavior when keychain unavailable
   - Test interactive credential prompt when not configured
