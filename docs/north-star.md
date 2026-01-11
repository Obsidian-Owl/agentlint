# agentlint: North Star

> The constitution preamble for agentlint development.

---

## Mission Statement

agentlint enables continuous improvement of AI-assisted development workflows by establishing baselines, tracing issues to their origins, and providing preventive recommendations that compound value over time.

---

## Product Vision

### The Problem

AI coding assistants are only as effective as the context they receive. Most developers use default configurations and miss opportunities for optimization. Worse, they have no way to understand whether changes actually improve outcomes—and research shows developers consistently misjudge their own AI-assisted productivity.

When issues occur (slow sessions, wrong outputs, security problems), developers can't answer: **Why did this happen? How do I prevent it?**

### The Solution

A command-line tool that answers: **"How effective is my AI coding workflow, why do issues occur, and how do I prevent them?"**

This is not a linter that detects issues. It's a **learning system** that traces issues to their origins and recommends preventive changes. Value compounds because each recommendation makes future AI sessions better.

### Who We Serve (MVP)

- **Solo developers** who want to systematically improve their AI-assisted workflows
- **Multi-tool experimenters** who need unified tracking across AI tools
- **AI-first developers** who invest heavily in AI assistance and want to understand effectiveness

### Value Delivered

1. **Baseline** - Capture current state with quantitative and qualitative signals
2. **Discovery** - What AI configurations and practices exist?
3. **Assessment** - How effective is the current setup?
4. **Tracing** - Why did issues occur? What session/config gap caused them?
5. **Prevention** - Specific config changes to stop recurrence
6. **Tracking** - Observe changes over time, correlate with improvements

---

## The Continuous Improvement Model

```
  BASELINE ──▶ CHANGE ──▶ OBSERVE ──▶ UNDERSTAND ──▶ REFINE ──┐
      │                       │            │                   │
      │                       │            └── TRACE issues    │
      │                       │                to origin       │
      │                       │                                │
      └───────────────────────┴────────────────────────────────┘
```

Value compounds through recurring use. Each cycle builds understanding of what works for *your* workflow.

---

## Causal Analysis Model

Traditional linters detect issues. agentlint goes further:

```
DETECT ──▶ TRACE ──▶ UNDERSTAND ──▶ PREVENT
```

| Step | Question | Example |
|------|----------|---------|
| **DETECT** | What is wrong? | Secret in CLAUDE.md |
| **TRACE** | When/where did it originate? | Session where user asked "add API config" |
| **UNDERSTAND** | Why did it happen? | No credential handling guidance exists |
| **PREVENT** | How do we stop recurrence? | Add: "Use environment variables for credentials" |

**Key insight**: Preventive recommendations compound value. Each one makes future AI sessions better.

---

## Signals Framework

We use mixed methods—quantitative signals provide objective anchors; qualitative assessment tells us *why* things work.

| Type | Examples |
|------|----------|
| **Leading** (predict outcomes) | Config coverage, type strictness, doc completeness |
| **Lagging** (reflect outcomes) | Token efficiency, iteration count, error frequency |
| **Qualitative** (semantic/perceptual) | Config clarity, doc coherence, perceived friction |
| **Causal** (traced origins) | Session→issue links, config gap→problem correlations |

**Meta-inferences**—the most valuable insights—emerge from correlating signals across types and tracing issues to their origins.

---

## Design Principles

1. **Local-First** - All analysis on user's machine. No data leaves without consent.
2. **Improvement-Oriented** - Features compound value over time. Tracking is core, not afterthought.
3. **Causal-First** - Don't just detect issues; trace them to origin and recommend prevention.
4. **Mixed-Methods** - Quantitative + qualitative. Embrace exploratory analysis.
5. **Language-Agnostic** - Works across programming languages.
6. **Tool-Agnostic** - Supports any AI assistant via adapters.
7. **Static-First** - Prefer deterministic analysis. Use LLMs where genuinely required.
8. **Progressive Value** - Useful without LLM config. LLM enhances but isn't required.

---

## Success Indicators

### User Outcomes
- Positive directional trends after improvement cycles
- Reduced tokens/iterations for comparable tasks over time
- Issues traced to origin, preventive measures applied
- Analysis becomes regular practice, not one-time diagnostic

### Product Signals
- >60% recurring usage (multiple runs per month)
- >50% preventive recommendation adoption
- Users maintain baselines across 10+ runs
- Traced issues lead to config changes

### Technical Indicators
- Full scan < 30 seconds
- Trend queries < 2 seconds
- >95% config detection accuracy
- Session→issue correlation accuracy

---

## Non-Goals (MVP)

- **No Web Dashboard** - CLI only
- **No SaaS Backend** - Local-first means local-only
- **No Real-Time Analysis** - Post-hoc only
- **No Enterprise Governance** - No team management or compliance
- **No IDE Plugins** - CLI-first
- **No Cross-Machine Sync** - History stays local

---

## Decision Framework

1. **Does it support continuous improvement?** Value compounds over time.
2. **Does it trace to root cause?** Prevention over symptom treatment.
3. **Does it embrace mixed methods?** Both quantitative and qualitative matter.
4. **Does it improve understanding?** Insight over raw numbers.
5. **Can it be done statically?** Prefer deterministic analysis.
6. **Does it maintain local-first?** No data leaves without consent.
7. **Is it language/tool-agnostic?** Broad applicability.

---

## What Success Looks Like

**Week 1**: Developer runs `agentlint baseline`. Captures starting signals.

**Week 2**: Runs `agentlint analyse`. Discovers a high-iteration session where AI added a secret to config. Traces origin: "add my API config" prompt with no credential guidance. Applies preventive recommendation: adds "Use environment variables for all credentials" to CLAUDE.md.

**Week 4+**: Regular analysis becomes practice. New issues are traced to origin. Developer builds a CLAUDE.md that prevents common failure modes. Token costs drop. Iteration counts fall. Each improvement compounds.

**The difference**: Developer doesn't just know "what's wrong"—they know "why it happened" and "how to prevent it."

---

*This document defines what agentlint is and is not. Refer to it when scope questions arise.*
