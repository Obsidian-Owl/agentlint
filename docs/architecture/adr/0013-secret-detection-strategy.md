---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0013: Secret Detection Strategy

## Context and Problem Statement

agentlint analyses configuration files, session logs, and code where secrets (API keys, tokens, passwords, private keys) may be present. We need a detection strategy that:

1. Identifies secrets with **low false positive rates** (user priority)
2. **Never transmits actual secret values** to the LLM
3. Allows the agent to **reason about context** to assess true/false positives
4. Runs entirely local (Constitution Principle I)

## Decision Drivers

- **Low False Positives**: User priority—minimize noise and alert fatigue
- **Privacy Preservation**: Secret values must never reach the LLM; only context is shared
- **Local-First**: No external services; user provides their own LLM credentials
- **Zero Binary Dependencies**: Avoid requiring Go/Python runtimes (aligns with ADR-0001 Bun choice)
- **Community Patterns**: Leverage battle-tested detection rules rather than inventing from scratch
- **Agent Intelligence**: The agentlint agent should be able to reason about whether candidates are truly secrets

## Considered Options

1. Custom pattern engine + LLM validation
2. Shell out to Gitleaks binary
3. Port detect-secrets plugin architecture
4. Hybrid: Gitleaks patterns + LLM validation

## Decision Outcome

**Chosen option: "Hybrid: Gitleaks patterns + LLM validation"** because it provides the best balance of proven detection patterns (140+ community-maintained detectors), low false positive rates via LLM contextual reasoning, and zero external binary dependencies.

### Consequences

**Good:**
- Leverages Gitleaks' battle-tested pattern library (2B+ downloads)
- LLM validation reduces false positives by reasoning about context
- No Go/Python runtime dependency—pure TypeScript execution
- Patterns updated via Gitleaks releases without code changes
- Privacy-preserving: LLM sees context but not actual secret values

**Bad:**
- Must parse Gitleaks TOML pattern format
- Pattern sync with upstream requires periodic updates
- LLM validation adds latency per candidate secret

**Neutral:**
- Gitleaks patterns optimized for recall; LLM filter compensates for precision
- Detection quality depends on LLM reasoning capability

## Pros and Cons of Options

### Option 1: Custom Pattern Engine + LLM Validation

Build TypeScript-native detector with hand-curated high-precision patterns and LLM validation layer.

- Good: Full control over patterns and thresholds
- Good: Can optimize for precision from the start
- Good: Zero external dependencies
- Neutral: Requires initial curation effort
- Bad: Pattern database maintenance burden
- Bad: May miss emerging secret formats without community input

### Option 2: Shell Out to Gitleaks Binary

Invoke Gitleaks as subprocess, parse JSON output.

- Good: Battle-tested detection (2B+ downloads, 140+ detectors)
- Good: Active community maintenance
- Good: Supports SARIF/JSON/CSV output formats
- Neutral: Well-documented configuration
- Bad: Requires Go binary installation (complicates distribution)
- Bad: External dependency violates self-contained principle
- Bad: Higher false positive rate than detect-secrets
- Bad: Cannot integrate LLM validation into detection pipeline

### Option 3: Port detect-secrets Plugin Architecture

Full TypeScript reimplementation of Yelp's detect-secrets design.

- Good: Proven low-false-positive architecture
- Good: Baseline approach enables iterative improvement
- Good: Plugin system enables extensibility
- Neutral: Aligns with Compounding Value principle
- Bad: Significant development effort (~10K lines Python to port)
- Bad: Python-specific patterns need adaptation
- Bad: No LLM integration in original design

### Option 4: Hybrid - Gitleaks Patterns + LLM Validation

Use Gitleaks TOML pattern definitions with TypeScript regex execution and LLM post-filter.

- Good: 140+ community-maintained patterns
- Good: LLM filter compensates for Gitleaks' recall-focused design
- Good: Pattern updates via upstream releases
- Good: No binary dependency—TOML parsing is trivial
- Good: Privacy-preserving redaction before LLM
- Neutral: TOML parsing adds minor complexity
- Bad: Gitleaks patterns optimized for recall over precision
- Bad: Must track upstream pattern changes

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All detection runs locally; LLM is user's configured endpoint |
| II. Improvement-Oriented | Yes | Baseline of known-safe patterns improves over time |
| III. Causal-First | Yes | Detected secrets trace to file:line origin |
| IV. Mixed-Methods | Yes | Regex (quantitative) + LLM reasoning (qualitative) |
| V. Language-Agnostic | Yes | Regex patterns work across any programming language |
| VI. Agent-Agnostic | Yes | Detection works on any ACT config/session format |
| VII. Intelligent Tooling | Yes | Agent reasons about candidates; tool provides detection |
| VIII. Compounding Value | Yes | False positive feedback improves future detection |
| IX. Agent-Aware | Yes | Redacted context optimized for agent comprehension |

## More Information

### Related Documents

- Design Decisions: [DD-014](../design-decisions.md#dd-014-secret-detection-strategy)
- Prior Decisions: [ADR-0001 - Runtime Platform](./0001-runtime-platform-and-language.md), [ADR-0007 - Config Parser](./0007-configuration-parser-design.md)

### Research Sources

- [TruffleHog vs Gitleaks Comparison - Jit](https://www.jit.io/resources/appsec-tools/trufflehog-vs-gitleaks-a-detailed-comparison-of-secret-scanning-tools)
- [Best Secret Scanning Tools 2025 - Aikido](https://www.aikido.dev/blog/top-secret-scanning-tools)
- [Comparative Study of Secret Detection Tools - arXiv](https://arxiv.org/pdf/2307.00714)
- [Using AI to Reduce False Positives - LegitSecurity](https://www.legitsecurity.com/blog/using-ai-to-reduce-false-positives-in-secrets-scanners)
- [Secrets in Source Code: ML for False Positives - IEEE](https://ieeexplore.ieee.org/document/9027350/)
- [detect-secrets Design - Yelp GitHub](https://github.com/Yelp/detect-secrets/blob/master/docs/design.md)
- [Breaking Down False Positives - Checkmarx](https://checkmarx.com/learn/breaking-down-false-positives-in-secrets-scanning/)
- [GitGuardian Secrets Detection Guide](https://blog.gitguardian.com/secrets-in-source-code-episode-3-3-building-reliable-secrets-detection/)
- [Gitleaks GitHub Repository](https://github.com/gitleaks/gitleaks)

### Implementation Notes

#### 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Secret Detection Pipeline                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Gitleaks   │    │    Regex     │    │  Candidate   │  │
│  │ TOML Patterns│───▶│   Matcher    │───▶│   Secrets    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                   │         │
│                                                   ▼         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │    Final     │    │     LLM      │    │  Redaction   │  │
│  │   Results    │◀───│  Validator   │◀───│    Layer     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Pattern Loading

```typescript
interface GitleaksRule {
  id: string;
  description: string;
  regex: string;
  keywords?: string[];
  entropy?: number;
  secretGroup?: number;
  allowlist?: {
    regexes?: string[];
    paths?: string[];
    commits?: string[];
  };
}

async function loadGitleaksPatterns(): Promise<GitleaksRule[]> {
  // Fetch from bundled gitleaks.toml or remote
  const toml = await Bun.file('patterns/gitleaks.toml').text();
  return parseGitleaksToml(toml);
}
```

#### 3. Candidate Detection

```typescript
interface SecretCandidate {
  ruleId: string;
  match: string;           // The actual secret value
  context: string;         // Surrounding lines
  location: {
    file: string;
    line: number;
    column: number;
  };
  entropy?: number;
}

function detectSecrets(
  content: string,
  filePath: string,
  rules: GitleaksRule[]
): SecretCandidate[] {
  const candidates: SecretCandidate[] = [];

  for (const rule of rules) {
    const regex = new RegExp(rule.regex, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      // Extract secret and context
      const secretValue = rule.secretGroup
        ? match[rule.secretGroup]
        : match[0];

      // Skip if in allowlist
      if (isAllowlisted(match, filePath, rule.allowlist)) continue;

      candidates.push({
        ruleId: rule.id,
        match: secretValue,
        context: extractContext(content, match.index, 3), // ±3 lines
        location: calculateLocation(content, match.index, filePath),
        entropy: calculateEntropy(secretValue),
      });
    }
  }

  return candidates;
}
```

#### 4. Redaction Layer

```typescript
interface RedactedCandidate {
  ruleId: string;
  redactedContext: string;  // Context with secret replaced
  secretLength: number;      // For length-based heuristics
  secretEntropy: number;
  location: SecretCandidate['location'];
}

function redactForLLM(candidate: SecretCandidate): RedactedCandidate {
  // Replace actual secret with placeholder preserving structure
  const placeholder = `[REDACTED:${candidate.ruleId}:len=${candidate.match.length}]`;

  return {
    ruleId: candidate.ruleId,
    redactedContext: candidate.context.replace(candidate.match, placeholder),
    secretLength: candidate.match.length,
    secretEntropy: candidate.entropy ?? 0,
    location: candidate.location,
  };
}
```

#### 5. LLM Validation Tool

```typescript
export const validateSecretTool = tool(
  "validate_secret",
  "Assess whether a detected secret candidate is a true or false positive based on context",
  {
    candidate: z.object({
      ruleId: z.string().describe("Detection rule that matched"),
      redactedContext: z.string().describe("Code context with secret redacted"),
      secretLength: z.number().describe("Length of the secret value"),
      secretEntropy: z.number().describe("Shannon entropy of the secret"),
      filePath: z.string().describe("File where candidate was found"),
      line: z.number().describe("Line number"),
    }),
  },
  async (args) => {
    // Tool returns candidate info for agent reasoning
    // Agent decides if it's a true positive based on:
    // - File path (test files, examples, mocks?)
    // - Variable naming (PASSWORD, API_KEY, TOKEN?)
    // - Context (assignment, comparison, logging?)
    // - Entropy (high entropy = likely real secret)

    return {
      candidate: args.candidate,
      suggestedQuestions: [
        "Is this in a test or example file?",
        "Does the variable name suggest a real credential?",
        "Is this a placeholder or template value?",
        "What is the surrounding code doing?",
      ],
    };
  }
);
```

#### 6. Classification Schema

```typescript
type SecretClassification =
  | 'confirmed'      // High confidence real secret
  | 'likely'         // Probable secret, recommend review
  | 'unlikely'       // Probably false positive
  | 'false_positive' // Definitely not a secret
  | 'needs_review';  // Agent uncertain, human review needed

interface ClassifiedSecret {
  candidate: RedactedCandidate;
  classification: SecretClassification;
  confidence: number;  // 0-1
  reasoning: string;   // Agent's explanation
  recommendation: string;
}
```

#### 7. Result Aggregation

```typescript
interface SecretScanResult {
  scannedFiles: number;
  candidatesDetected: number;
  classifiedSecrets: ClassifiedSecret[];
  summary: {
    confirmed: number;
    likely: number;
    falsePositives: number;
    needsReview: number;
  };
}
```

#### 8. Pattern Update Strategy

```bash
# Periodic sync with upstream Gitleaks patterns
# Store in .agentlint/patterns/gitleaks.toml
curl -o patterns/gitleaks.toml \
  https://raw.githubusercontent.com/gitleaks/gitleaks/master/config/gitleaks.toml
```

#### 9. Entropy Calculation

```typescript
function calculateEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

// Thresholds (configurable):
// < 3.0: Low entropy, likely false positive
// 3.0-4.0: Medium, needs context review
// > 4.0: High entropy, likely real secret
```
