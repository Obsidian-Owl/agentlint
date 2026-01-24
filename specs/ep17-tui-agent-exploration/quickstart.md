# Quickstart: EP17 TUI Architecture

> How to use the new agent-led TUI after EP17 implementation

---

## Basic Usage

### Running agentlint (Default TUI Mode)

```bash
# Just run agentlint - agent leads the exploration
agentlint

# The agent will:
# 1. Scan your ACT environment automatically
# 2. Present the most impactful finding first
# 3. Offer to explore other areas
# 4. Guide you through drill-down naturally
```

### Headless/CI Mode

```bash
# JSON output for CI/CD pipelines
agentlint --non-interactive

# Or auto-detected when no TTY
echo "" | agentlint  # Automatically uses headless mode
```

---

## Interaction Patterns

### Natural Language Input

Type anything - the agent interprets it:

```
Agent: I found your "testing" Skill was defined 3 weeks ago
       but only invoked 2 times. Would you like to explore why?

You: yes
     → Agent explains possible causes

You: show me the sessions
     → Agent lists relevant sessions

You: 1
     → Agent selects option 1 (from its previous list)

You: back
     → Agent returns to previous exploration level

You: tell me about compression instead
     → Agent pivots to new topic
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-9` | Quick-select numbered option |
| `j/k` | Navigate lists (vim-style) |
| `Enter` | Confirm selection |
| `ESC` | Go back / dismiss dialog |
| `Ctrl+C` | Exit agentlint |

---

## Permission Dialogs

When the agent needs permission to access something:

```
┌─────────────────────────────────────────────┐
│ Permission Request                          │
│                                             │
│ agentlint wants to read session logs from   │
│ ~/.claude/projects/                         │
│                                             │
│ [1] Allow (this session)                    │
│ [2] Always allow (remember)                 │
│ [3] Deny                                    │
│                                             │
│ Press 1, 2, or 3                            │
└─────────────────────────────────────────────┘
```

- **Option 1**: Permission valid only for current session
- **Option 2**: Permission saved to `~/.agentlint/permissions.json`
- **Option 3**: Agent explains limitation and offers alternatives

---

## Recommendation Flow

When the agent finds an improvement opportunity:

```
┌─────────────────────────────────────────────┐
│ Recommendation                              │
│                                             │
│ Update your "testing" Skill description    │
│ to match how you phrase test requests.      │
│                                             │
│ Current: "Run the test suite"               │
│ Suggested: "Run tests, check coverage..."   │
│                                             │
│ [1] Accept - show me how                    │
│ [2] Dismiss - not relevant                  │
│ [3] Defer - remind me later                 │
│                                             │
│ Press 1, 2, or 3                            │
└─────────────────────────────────────────────┘
```

---

## Common Patterns

### Exploring a Finding

```
Agent: The biggest opportunity I see: your "testing" Skill...

You: why isn't it being invoked?

Agent: Looking at your sessions, I see three possible causes:
       1. Description mismatch - you say "run tests" but Skill says "test suite"
       2. MCP configuration - the Skill requires an MCP server that's not connected
       3. Timing - most testing happens early morning, before you open Claude Code

       Would you like me to show evidence for any of these?

You: 1

Agent: Here are 3 sessions where you asked about testing:
       - Session abc123 (Jan 20): "can you run the tests?"
       - Session def456 (Jan 18): "check if tests pass"
       - Session ghi789 (Jan 15): "run test coverage"

       Notice: none use the phrase "test suite" from your Skill description.
```

### Going Back

```
You: back

Agent: Returning to the overview.

       I analyzed 47 sessions from the last 30 days.
       The biggest opportunity I see: [previous finding]

       I also noticed:
       - High context compression (3.2 events/session)
       - 1 MCP server configured but never used

       What would you like to explore? (1/2/other)
```

### Exiting

```
You: quit

Agent: Goodbye! Your analysis checkpoints are saved.
       Run `agentlint` again to continue where you left off.
```

Or just press `Ctrl+C`.

---

## Troubleshooting

### TUI Not Rendering Properly

```bash
# Check terminal type
echo $TERM

# Force color mode
FORCE_COLOR=1 agentlint

# Disable colors (accessibility)
NO_COLOR=1 agentlint
```

### Resetting Permissions

```bash
# View saved permissions
cat ~/.agentlint/permissions.json

# Reset all permissions
rm ~/.agentlint/permissions.json
```

### Debug Mode

```bash
# Verbose output
agentlint --verbose

# Debug output (full tool calls, timing)
agentlint --debug
```

---

## Architecture Notes (For Developers)

### File Structure

```
src/tui/
├── components/     # Ink React components
├── state/          # useReducer, context
├── hooks/          # useKeyHandler, useFocusManager
├── renderers/      # ink-renderer, headless-renderer
└── permissions/    # Permission persistence
```

### State Management

All UI state flows through `appReducer`:

```typescript
const [state, dispatch] = useReducer(appReducer, createInitialState());

// Update phase
dispatch({ type: 'SET_PHASE', payload: { phase: 'scanning' } });

// Add finding
dispatch({ type: 'ADD_FINDING', payload: { finding } });

// Show dialog
dispatch({ type: 'PUSH_DIALOG', payload: { dialog: 'permission' } });
```

### Testing Components

```typescript
import { render } from 'ink-testing-library';
import { App } from '../App';

test('displays finding', () => {
  const { lastFrame } = render(
    <App initialState={{ findings: [mockFinding] }} />
  );
  expect(lastFrame()).toContain('testing Skill');
});
```
