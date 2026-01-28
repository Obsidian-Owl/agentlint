# Learnings from Opencode Auth Migration

## Successful Patterns

1. **Provider-agnostic error handling**: Renamed `ApiKeyError` to `ProviderAuthError` with generic messages referencing "opencode auth" instead of specific env vars.

2. **Test helper deprecation bridge**: Created new `require-provider.ts` while keeping `require-api-key.ts` as deprecated wrappers. This prevented breaking all imports at once.

3. **Multi-provider env clearing**: Tests that clear auth now clear ALL provider keys (ANTHROPIC_API_KEY + OPENAI_API_KEY) to properly simulate "no auth" state.

4. **Always-attempt pattern**: Removed hasApiKey() gates. Now always attempt orchestrated analysis, catch ProviderAuthError, fall back to static with helpful message.

5. **ADR supersession**: Properly superseded ADR-0014 with ADR-0026, maintaining historical context while documenting new approach.

## Key Decisions

- Kept security patterns (redaction, gitleaks) unchanged — security ≠ auth
- Kept .env loading in cli.ts — Opencode reads env vars
- Kept retry status codes — may still be relevant at our layer
- Kept model defaults — model selection ≠ auth

## Verification Strategy

- LSP diagnostics on all changed files
- Full typecheck (bun run typecheck)
- Full test suite (bun run test) 
- Grep verification for remaining references
- Acceptance criteria checklist

## Commit Strategy

Atomic commits per task:
1. Error rename + ESLint fixes
2. Test helpers
3. analyse.ts gating removal
4. Test file updates
5. Comment cleanup
6. Docs + ADR

Total: 6 commits, all passing pre-commit hooks.
