# Opencode Auth Migration: Remove ANTHROPIC_API_KEY Hardcoding

## TL;DR

> **Quick Summary**: Remove all ANTHROPIC_API_KEY gating and credential management from agentlint. Rename `ApiKeyError` → `ProviderAuthError` with provider-agnostic messages. Update all tests and docs. Auth is now 100% delegated to Opencode SDK.
>
> **Deliverables**:
>
> - Provider-agnostic error class replacing `ApiKeyError`
> - `analyse.ts` no longer gates on ANTHROPIC_API_KEY
> - Provider-agnostic test helpers replacing `require-api-key.ts`
> - ADR-0014 superseded with new ADR-0026
> - All docs updated
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 7

---

## Context

### Original Request

Remove all ANTHROPIC_API_KEY hardcoding from agentlint (72 references across 31 files). Delegate auth entirely to Opencode SDK which handles provider selection + subscription auth natively.

### Key Decisions

- **Auth gating removed**: `hasApiKey()` checks replaced — Opencode SDK fails with its own errors if no provider configured
- **Error class renamed**: `ApiKeyError` → `ProviderAuthError` with provider-agnostic messages
- **Security patterns kept**: `sk-ant-` redaction in `redaction.ts` and gitleaks patterns stay (security ≠ auth)
- **`.env` loading kept**: Opencode reads env vars, so loading `.env` still useful
- **Retry codes kept**: Status 529 etc. may still be relevant at our retry layer
- **Model default kept**: `DEFAULT_MODEL` is model selection, not auth

### What's Explicitly OUT of Scope

- Model name/selection changes
- Secret redaction patterns (`redaction.ts`, `gitleaks.toml`)
- `.env` file loading (`src/cli.ts`)
- Retry status codes (`retry.ts`) — add comment only
- HONEYHIVE_API_KEY references
- `trulens-runner.py` (Python eval runner, separate concern)

---

## Work Objectives

### Core Objective

Eliminate all ANTHROPIC_API_KEY credential management so agentlint delegates auth entirely to Opencode SDK.

### Definition of Done

- [x] Zero `hasApiKey()` gates blocking orchestrated analysis
- [x] `ApiKeyError` renamed to `ProviderAuthError` with provider-agnostic messages
- [x] All tests updated — no ANTHROPIC_API_KEY in test gates
- [x] ADR-0014 superseded with new ADR documenting Opencode delegation
- [x] All docs reference Opencode auth, not ANTHROPIC_API_KEY
- [x] `bun run typecheck` passes
- [x] `bun run test` passes

### Must NOT Have (Guardrails)

- No new credential management logic — Opencode owns this
- No provider-specific env var checks (not even "helpful" ones)
- No changes to secret redaction or security scanning
- No changes to model selection logic

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES (Bun test)
- **User wants tests**: Tests-after (update existing tests)
- **Framework**: Bun test

---

## Task Dependency Graph

| Task   | Depends On | Reason                                                        |
| ------ | ---------- | ------------------------------------------------------------- |
| Task 1 | None       | Core error class rename — foundation for all other changes    |
| Task 2 | None       | Test helper is independent module                             |
| Task 3 | Task 1     | analyse.ts imports ApiKeyError, needs ProviderAuthError first |
| Task 4 | Task 1, 2  | Tests reference both error class and test helpers             |
| Task 5 | Task 1, 3  | Integration tests assert on error messages from analyse.ts    |
| Task 6 | None       | Docs are independent of code changes                          |
| Task 7 | Task 1-5   | Final verification requires all code changes complete         |

## Parallel Execution Graph

```
Wave 1 (Start immediately — no dependencies):
├── Task 1: Rename ApiKeyError → ProviderAuthError
├── Task 2: Replace test helper (require-api-key.ts)
└── Task 6: Update documentation & ADRs

Wave 2 (After Wave 1):
├── Task 3: Remove ANTHROPIC_API_KEY gating from analyse.ts
└── Task 4: Update e2e/integration test files

Wave 3 (After Wave 2):
└── Task 5: Update remaining test assertions

Wave 4 (After all):
└── Task 7: Final verification (typecheck + test)

Critical Path: Task 1 → Task 3 → Task 5 → Task 7
```

---

## TODOs

- [x] 1. Rename `ApiKeyError` → `ProviderAuthError` with provider-agnostic messages

  **What to do**:
  - In `src/errors/orchestration.ts`:
    - Rename class `ApiKeyError` → `ProviderAuthError`
    - Change `reason` type: keep `'missing' | 'invalid_format' | 'rejected' | 'unknown'` but update to `'no_provider' | 'auth_failed' | 'rejected' | 'unknown'`
    - Update default messages:
      - `no_provider`: `'No LLM provider configured. Run "opencode auth" or set provider env vars (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)'`
      - `auth_failed`: `'LLM provider authentication failed. Check your credentials with "opencode auth status"'`
      - `rejected`: `'LLM provider rejected the request. Verify your subscription or API key is active.'`
      - `unknown`: `'LLM provider auth error'`
    - Update `this.name = 'ProviderAuthError'`
    - Rename `OrchestrationExitCode.ApiKeyError` → `OrchestrationExitCode.ProviderAuthError`
    - Rename `isApiKeyError` → `isProviderAuthError`
  - In `src/errors/index.ts`:
    - Update exports: `ApiKeyError` → `ProviderAuthError`, `isApiKeyError` → `isProviderAuthError`

  **Must NOT do**:
  - Don't add any new env var checks
  - Don't import or depend on Opencode SDK types

  **Recommended Agent Profile**:
  - **Category**: `quick` — Small, focused rename across 2 files
  - **Skills**: [`typescript-programmer`] — TypeScript type changes, export renames
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not committing yet

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 6)
  - **Blocks**: Tasks 3, 4, 5
  - **Blocked By**: None

  **References**:
  - `src/errors/orchestration.ts:149-168` — Current `ApiKeyError` class to rename
  - `src/errors/orchestration.ts:27` — `OrchestrationExitCode.ApiKeyError` enum value
  - `src/errors/orchestration.ts:196-199` — `isApiKeyError` type guard to rename
  - `src/errors/index.ts:80,86` — Export statements to update

  **Acceptance Criteria**:
  - [ ] `ProviderAuthError` class exists with provider-agnostic messages
  - [ ] `isProviderAuthError` type guard exists
  - [ ] No remaining references to `ApiKeyError` in `src/errors/`
  - [ ] `bun run typecheck` — will show downstream errors (expected, fixed in later tasks)

  **Commit**: YES
  - Message: `refactor(errors): rename ApiKeyError to ProviderAuthError`
  - Files: `src/errors/orchestration.ts`, `src/errors/index.ts`

---

- [x] 2. Replace test helper `require-api-key.ts` with provider-agnostic version

  **What to do**:
  - Rewrite `tests/lib/require-api-key.ts` → `tests/lib/require-provider.ts`:
    - `requireLiveProvider()`: Checks if ANY provider is configured — check for `ANTHROPIC_API_KEY` OR `OPENAI_API_KEY` OR existence of `~/.local/share/opencode/auth.json`. Error message says "No LLM provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or run 'opencode auth'."
    - `hasLiveProvider()`: Boolean version
    - `requireAPIKey()` / `hasAPIKey()` / `getAPIKey()`: KEEP as deprecated wrappers calling the new functions (avoids breaking all imports at once — Task 4/5 will migrate callers)
  - Update `tests/e2e/helpers.ts`:
    - `hasAPIKey()` → `hasLiveProvider()` (import from new module)
    - `SKIP_LIVE_TESTS` uses `hasLiveProvider()`
  - Update `tests/e2e/index.ts`: export new helpers

  **Must NOT do**:
  - Don't import Opencode SDK in test helpers
  - Don't remove the old file yet (deprecated wrappers bridge the gap)

  **Recommended Agent Profile**:
  - **Category**: `quick` — Straightforward file rewrite + 2 import updates
  - **Skills**: [`typescript-programmer`]
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not committing yet

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 6)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: None

  **References**:
  - `tests/lib/require-api-key.ts:1-72` — Current implementation to replace
  - `tests/e2e/helpers.ts:241-248` — `hasAPIKey()` and `SKIP_LIVE_TESTS` to update
  - `tests/e2e/index.ts:21` — Re-export to update

  **Acceptance Criteria**:
  - [ ] `tests/lib/require-provider.ts` exists with `requireLiveProvider()`, `hasLiveProvider()`
  - [ ] `tests/lib/require-api-key.ts` still exists with deprecated wrappers (no import breakage)
  - [ ] `tests/e2e/helpers.ts` uses `hasLiveProvider()`

  **Commit**: YES
  - Message: `refactor(tests): add provider-agnostic test helpers`
  - Files: `tests/lib/require-provider.ts`, `tests/lib/require-api-key.ts`, `tests/e2e/helpers.ts`, `tests/e2e/index.ts`

---

- [x] 3. Remove ANTHROPIC_API_KEY gating from `analyse.ts`

  **What to do**:
  - In `src/cli/commands/analyse.ts`:
    - Remove `hasApiKey()` function (line ~1178-1182) that checks `process.env['ANTHROPIC_API_KEY']`
    - Remove/rewrite the fallback logic at lines ~1513-1514 that falls back to static analysis when no key
    - Instead: always attempt orchestrated analysis. Catch Opencode auth errors and surface helpful message: `'No LLM provider configured. Run "opencode auth" or set provider env vars.\nFalling back to static analysis.'`
    - Update comment at line ~581
    - Update error message at line ~1416 for session analysis
    - Import `ProviderAuthError` instead of `ApiKeyError` (if imported)

  **Must NOT do**:
  - Don't add new env var checks
  - Don't change the static analysis fallback behavior itself — just change what triggers it

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low` — Moderate logic changes in a large file
  - **Skills**: [`typescript-programmer`]
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not committing yet

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 5
  - **Blocked By**: Task 1 (needs ProviderAuthError)

  **References**:
  - `src/cli/commands/analyse.ts:581` — Comment about default mode when key available
  - `src/cli/commands/analyse.ts:1178-1181` — `hasApiKey()` function definition
  - `src/cli/commands/analyse.ts:1416` — Session analysis error message
  - `src/cli/commands/analyse.ts:1513-1514` — Fallback to static analysis message
  - `src/errors/orchestration.ts` — ProviderAuthError (from Task 1)

  **Acceptance Criteria**:
  - [ ] No `hasApiKey` function exists in `analyse.ts`
  - [ ] No `ANTHROPIC_API_KEY` string literal in `analyse.ts`
  - [ ] Orchestrated analysis attempted without env var gate
  - [ ] Auth errors caught with helpful provider-agnostic message
  - [ ] `bun run typecheck` passes for this file

  **Commit**: YES
  - Message: `refactor(analyse): remove ANTHROPIC_API_KEY gating, delegate auth to Opencode`
  - Files: `src/cli/commands/analyse.ts`

---

- [x] 4. Update e2e and integration test files

  **What to do**:
  - `tests/e2e/cli/analyse-live.test.ts`: Import `requireLiveProvider` from `require-provider.ts` instead of `requireAPIKey`
  - `tests/e2e/cli/analyse-orchestrated.test.ts:220`: Change `ANTHROPIC_API_KEY: ''` env override — instead, set env that prevents Opencode from finding any provider (clear all provider keys)
  - `tests/e2e/workflows/analyse.test.ts:216-219`: Update test name and assertion to be provider-agnostic
  - `tests/e2e/dogfood.test.ts:136-139`: Same pattern — provider-agnostic assertion
  - `tests/integration/cli/analyse.test.ts:45,91,115,136`: Change `ANTHROPIC_API_KEY: ''` env overrides
  - `tests/integration/cli/session-analyse.test.ts:122,128`: Change env clear and assertion

  **Must NOT do**:
  - Don't change test logic/structure, only auth references
  - Don't remove tests that verify "no auth" behavior — update them to be provider-agnostic

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low` — Multiple files, repetitive pattern changes
  - **Skills**: [`typescript-programmer`]
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not committing yet

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `tests/e2e/cli/analyse-live.test.ts:16,19` — requireAPIKey import
  - `tests/e2e/cli/analyse-orchestrated.test.ts:6,220` — Comment + env override
  - `tests/e2e/workflows/analyse.test.ts:216-219` — Test name + assertion
  - `tests/e2e/dogfood.test.ts:136-139` — Test name + assertion
  - `tests/integration/cli/analyse.test.ts:45,91,115,136` — 4 env overrides
  - `tests/integration/cli/session-analyse.test.ts:122,128` — Env clear + assertion
  - `tests/lib/require-provider.ts` — New helpers (from Task 2)

  **Acceptance Criteria**:
  - [ ] No `ANTHROPIC_API_KEY` string literals in any test file (except deprecated wrapper)
  - [ ] Tests that clear auth env vars clear ALL provider keys, not just Anthropic
  - [ ] Live test gates use `requireLiveProvider()` / `hasLiveProvider()`
  - [ ] `bun run typecheck` passes for test files

  **Commit**: YES
  - Message: `refactor(tests): make auth assertions provider-agnostic`
  - Files: All test files listed above

---

- [x] 5. Update eval runner and remaining test references

  **What to do**:
  - `tests/evals/run-evals.ts:22,125`: Update comments/messages from "ANTHROPIC_API_KEY Required" to provider-agnostic message about Opencode auth
  - `tests/preload.ts:39`: Update comment
  - `tests/e2e/cli/analyse-live.test.ts:5`: Update comment
  - Delete deprecated `tests/lib/require-api-key.ts` if all callers migrated in Task 4
  - Final grep for any remaining `ANTHROPIC_API_KEY` in `tests/` — update comments only

  **Must NOT do**:
  - Don't change `trulens-runner.py` (Python, separate concern)

  **Recommended Agent Profile**:
  - **Category**: `quick` — Comments and cleanup
  - **Skills**: [`typescript-programmer`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 1-4

  **References**:
  - `tests/evals/run-evals.ts:22,125` — Comment blocks mentioning ANTHROPIC_API_KEY
  - `tests/preload.ts:39` — Comment about live tests
  - `tests/lib/require-api-key.ts` — Delete if all callers migrated

  **Acceptance Criteria**:
  - [ ] `grep -r ANTHROPIC_API_KEY tests/` returns only: `trulens-runner.py` and `require-api-key.ts` deprecated wrapper (if kept)
  - [ ] Eval runner references Opencode auth

  **Commit**: YES
  - Message: `refactor(tests): remove remaining ANTHROPIC_API_KEY references`
  - Files: `tests/evals/run-evals.ts`, `tests/preload.ts`, `tests/lib/require-api-key.ts`

---

- [x] 6. Update documentation and supersede ADR-0014

  **What to do**:
  - Create `docs/architecture/adr/0026-opencode-auth-delegation.md`:
    - Status: accepted
    - Supersedes: ADR-0014
    - Decision: agentlint delegates ALL auth to Opencode SDK
    - Context: Migration from Claude Agent SDK to Opencode SDK
    - Consequences: No credential management in agentlint, provider-agnostic errors
  - Update `docs/architecture/adr/0014-credential-management-strategy.md`:
    - Change status to `superseded by ADR-0026`
    - Add note at top: "This ADR is superseded. See ADR-0026."
  - Update `docs/architecture/design-decisions.md:535-546`: Replace Anthropic-specific credential section with Opencode delegation description
  - Update `docs/architecture/adr/0002-agentic-framework-strategy.md:162`: Update to reference Opencode SDK
  - Update `docs/architecture/adr/0011-testing-strategy-for-agentic-components.md:449,454`: Update env var references
  - Update `docs/architecture/arc42/08-crosscutting-concepts.md:176`: Update credential concept
  - Update `CONTRIBUTING.md:73,179,182`: Replace ANTHROPIC_API_KEY setup instructions with Opencode auth instructions
  - Update spec files if they contain ANTHROPIC_API_KEY references (ep02, ep04, ep08, ep09) — comments only, these are historical

  **Must NOT do**:
  - Don't rewrite historical spec files extensively — just add a note that auth has changed
  - Don't update CLAUDE.md (separate concern, maintained by project owner)

  **Recommended Agent Profile**:
  - **Category**: `writing` — Documentation-heavy task
  - **Skills**: [] — No code skills needed, standard markdown
  - **Skills Evaluated but Omitted**:
    - `typescript-programmer`: No code changes
    - `git-master`: Not committing yet

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `docs/architecture/adr/0014-credential-management-strategy.md` — Full file to supersede
  - `docs/architecture/design-decisions.md:535-546` — Credential section
  - `docs/architecture/adr/0002-agentic-framework-strategy.md:162` — SDK reference
  - `docs/architecture/adr/0011-testing-strategy-for-agentic-components.md:449,454` — Env var refs
  - `docs/architecture/arc42/08-crosscutting-concepts.md:176` — Credential concept
  - `CONTRIBUTING.md:73,179,182` — Setup instructions

  **Acceptance Criteria**:
  - [ ] ADR-0026 exists with Opencode auth delegation decision
  - [ ] ADR-0014 marked as superseded
  - [ ] `grep -r ANTHROPIC_API_KEY docs/` returns only historical spec files with notes
  - [ ] CONTRIBUTING.md references `opencode auth` for setup

  **Commit**: YES
  - Message: `docs: supersede ADR-0014 with Opencode auth delegation (ADR-0026)`
  - Files: All docs listed above

---

- [x] 7. Final verification

  **What to do**:
  - Run `bun run typecheck` — must pass with zero errors
  - Run `bun run test` — must pass
  - Run `grep -rn 'ANTHROPIC_API_KEY' src/` — should return only:
    - `src/debug/redaction.ts` (security pattern — expected)
    - `src/security/patterns/gitleaks.toml` (security scanning — expected)
    - `src/cli.ts` (`.env` loading — expected)
    - `src/orchestration/retry.ts` (comment only — expected)
  - Run `grep -rn 'hasApiKey\|ApiKeyError\|isApiKeyError' src/` — must return zero results
  - Run `grep -rn 'ApiKeyError\|isApiKeyError\|hasAPIKey\|requireAPIKey\|getAPIKey' tests/` — must return zero results (except deprecated wrapper if kept)

  **Recommended Agent Profile**:
  - **Category**: `quick` — Verification only
  - **Skills**: [`typescript-programmer`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None
  - **Blocked By**: All previous tasks

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` → 0 errors
  - [ ] `bun run test` → all pass
  - [ ] Grep results match expected allowlist above
  - [ ] No unexpected ANTHROPIC_API_KEY references in src/ or tests/

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message                                                                         | Files                                                      | Verification                                     |
| ---------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| 1          | `refactor(errors): rename ApiKeyError to ProviderAuthError`                     | `src/errors/orchestration.ts`, `src/errors/index.ts`       | `bun run typecheck` (may have downstream errors) |
| 2          | `refactor(tests): add provider-agnostic test helpers`                           | `tests/lib/`, `tests/e2e/helpers.ts`, `tests/e2e/index.ts` | `bun run typecheck`                              |
| 3          | `refactor(analyse): remove ANTHROPIC_API_KEY gating, delegate auth to Opencode` | `src/cli/commands/analyse.ts`                              | `bun run typecheck`                              |
| 4          | `refactor(tests): make auth assertions provider-agnostic`                       | 6 test files                                               | `bun run typecheck`                              |
| 5          | `refactor(tests): remove remaining ANTHROPIC_API_KEY references`                | 3 test files                                               | `bun run test`                                   |
| 6          | `docs: supersede ADR-0014 with Opencode auth delegation (ADR-0026)`             | 7+ doc files                                               | N/A                                              |
| 7          | N/A (verification)                                                              | N/A                                                        | `bun run typecheck && bun run test`              |

---

## Success Criteria

### Verification Commands

```bash
bun run typecheck          # Expected: 0 errors
bun run test               # Expected: all pass
grep -rn 'hasApiKey\|ApiKeyError\|isApiKeyError' src/  # Expected: 0 results
grep -rn 'ANTHROPIC_API_KEY' src/ | grep -v redaction | grep -v gitleaks | grep -v cli.ts | grep -v retry.ts  # Expected: 0 results
```

### Final Checklist

- [x] Zero `hasApiKey()` gates in runtime code
- [x] `ProviderAuthError` with provider-agnostic messages
- [x] All tests provider-agnostic
- [x] ADR-0026 documents Opencode auth delegation
- [x] ADR-0014 superseded
- [x] All doc references updated
