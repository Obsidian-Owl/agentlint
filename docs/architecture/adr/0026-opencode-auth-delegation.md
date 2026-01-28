---
status: accepted
date: 2026-01-28
decision-makers: [Project Lead]
consulted: []
informed: []
supersedes: [ADR-0014]
---

# ADR-0026: Opencode Auth Delegation

## Context and Problem Statement

agentlint has migrated from the Claude Agent SDK to the Opencode SDK (ADR-0024). Previously, agentlint managed its own LLM API credentials (primarily `ANTHROPIC_API_KEY`) as documented in ADR-0014.

The Opencode SDK provides its own authentication and credential management system, supporting multiple providers (Anthropic, OpenAI, OAuth subscriptions, etc.). To simplify agentlint's architecture and align with the new SDK's patterns, we need to delegate all authentication responsibility to Opencode.

## Decision Drivers

- **Simplicity**: Remove custom credential resolution logic from agentlint.
- **Provider Agnosticism**: Support multiple LLM providers without updating agentlint's auth code.
- **Security**: Leverage Opencode's proven security patterns for credential storage.
- **Consistency**: Use the same auth patterns as other Opencode-based tools.

## Considered Options

1. **Maintain dual auth** (status quo ADR-0014 + Opencode): Too complex, confusing for users.
2. **Delegate all auth to Opencode**: Simplifies the codebase and leverages SDK features.
3. **Build custom Opencode auth wrapper**: Unnecessary overhead.

## Decision Outcome

Chosen option: **"Delegate all auth to Opencode"** because it eliminates the need for agentlint to handle sensitive credentials directly, supports the full range of providers offered by Opencode, and reduces maintenance burden.

### Implementation Consequences

- agentlint no longer resolves `ANTHROPIC_API_KEY` manually.
- The `agentlint auth` command is replaced by or delegates to `opencode auth`.
- Users configure their environment using `opencode auth` or standard Opencode environment variables.
- Errors related to authentication are now returned by the Opencode SDK rather than agentlint's internal logic.

## Consequences

**Good:**

- No credential management code to maintain in agentlint.
- Multi-provider support is automatic.
- Align with modern agentic development patterns where orchestration layers handle identity.

**Bad:**

- Users must understand the Opencode auth model.
- Breaking change for users relying on `~/.agentlint/credentials`.

**Neutral:**

- `ANTHROPIC_API_KEY` still works if provided to the environment, but it's handled by the SDK.

## Constitution Compliance

| Principle          | Compliance | Notes                                                            |
| ------------------ | ---------- | ---------------------------------------------------------------- |
| I. Local-First     | Yes        | Opencode handles credentials locally; agentlint never sees them. |
| VI. Agent-Agnostic | Yes        | Multi-provider support via Opencode delegation.                  |
| IX. Agent-Aware    | Yes        | SDK-provided auth errors are standardized for agent reasoning.   |

## More Information

### Related Documents

- [ADR-0024: Opencode SDK Migration](./0024-opencode-sdk-migration.md)
- [ADR-0014: Credential Management Strategy](./0014-credential-management-strategy.md) (Superseded)
