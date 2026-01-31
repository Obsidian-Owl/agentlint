# TUI Error Handling

User-friendly error message transformation for the agentlint TUI.

## Overview

This module transforms technical error messages into user-friendly messages with actionable recovery suggestions. Every error message follows a consistent format:

**WHAT happened + WHY it matters + WHAT to do**

## Usage

```typescript
import { formatUserFriendlyError, formatErrorForDisplay, getErrorSummary } from './errors';

// Get structured error with what/why/action fields
const friendly = formatUserFriendlyError(error, 'optional context');
console.log(friendly.what); // "Can't find your config file"
console.log(friendly.why); // undefined (optional)
console.log(friendly.action); // "Run `agentlint init` to create one"
console.log(friendly.technical); // Original error message for debugging

// Get formatted multi-line string for display
const display = formatErrorForDisplay(error);
// Can't find your config file
//   → Run `agentlint init` to create one

// Get short one-line summary for status bars
const summary = getErrorSummary(error);
// "Can't find your config file"
```

## Error Message Examples

### Before (Technical)

```
Error: ENOENT: no such file or directory, open '~/.agentlint/config.json'
```

### After (User-Friendly)

```
Can't find your config file
  → Run `agentlint init` to create one
```

---

### Before (Technical)

```
Error: getaddrinfo ENOTFOUND api.anthropic.com
```

### After (User-Friendly)

```
Could not reach AI service
  DNS lookup failed - check your internet connection
  → Verify your network connection and DNS settings
```

---

### Before (Technical)

```
Error: Unauthorized: invalid_api_key
```

### After (User-Friendly)

```
API key is invalid
  The key may be expired or incorrect
  → Check your ANTHROPIC_API_KEY and get a new one from console.anthropic.com
```

## Error Categories

The formatter recognizes and handles:

### File Errors

- Missing config files
- Session directories not found
- Generic ENOENT errors

### Network Errors

- Connection refused (ECONNREFUSED)
- Timeouts (ETIMEDOUT)
- DNS resolution failures (ENOTFOUND)

### Authentication Errors

- Missing API keys
- Invalid API keys
- Rate limiting (429)

### Permission Errors

- Access denied (EACCES)
- Read-only filesystems (EROFS)

### Database Errors

- Locked databases (SQLITE_BUSY)
- Corrupted databases
- Disk full (ENOSPC)

### Configuration Errors

- Invalid JSON
- Invalid config values

## Pattern Matching

The formatter uses two approaches:

1. **Typed Error Matchers**: Use type guards like `isConfigNotFoundError()` to catch our custom error classes
2. **Pattern Matchers**: Use regex/substring matching to catch errors from dependencies and Node.js

## Adding New Error Patterns

To add support for a new error type:

1. Add a pattern matcher function in `user-friendly-errors.ts`:

```typescript
function matchMyError(error: Error): UserFriendlyError | null {
  const message = error.message.toLowerCase();

  if (message.includes('my error pattern')) {
    return {
      what: 'Short description of what happened',
      why: 'Why it matters (optional)',
      action: 'What the user should do',
      technical: error.message,
    };
  }

  return null;
}
```

2. Add the matcher to the `matchers` array in `formatUserFriendlyError()`:

```typescript
const matchers = [
  matchFileNotFound,
  matchNetworkError,
  matchAuthError,
  matchPermissionError,
  matchDatabaseError,
  matchConfigError,
  matchMyError, // Add here
];
```

3. Add tests in `__tests__/user-friendly-errors.test.ts`:

```typescript
describe('My Error Category', () => {
  test('handles my error pattern', () => {
    const error = new Error('my error pattern');
    const result = formatUserFriendlyError(error);

    expect(result.what).toBe('Short description of what happened');
    expect(result.action).toContain('What the user should do');
  });
});
```

## Design Principles

1. **User Agency**: Never talk down to users. Assume they are capable but need guidance.
2. **Actionable**: Every error must include a clear next step.
3. **Contextual**: Explain WHY something matters when it's not obvious.
4. **Preserve Technical Info**: Keep original error messages for debugging.
5. **Consistent Format**: WHAT + WHY + ACTION structure for all errors.

## Integration

The error formatter is integrated into:

- **InkRenderer**: Transforms error chunks before displaying them
- **HeadlessRenderer**: Formats errors for non-interactive output
- **Context Loader**: Provides friendly error messages for loading step failures
- **Config Module**: Formats config file loading errors

All error output in the TUI should go through this formatter to ensure consistent, user-friendly messaging.
