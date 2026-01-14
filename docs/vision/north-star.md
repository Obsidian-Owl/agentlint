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

### The Tagline

> From AI session chaos to systematic excellence. Trace issues, prevent recurrence, master your workflow.

### Who We Serve (MVP)

- **Solo developers** who want to systematically improve their AI-assisted workflows
- **Multi-tool experimenters** who need unified tracking across AI coding agents
- **AI-first developers** who invest heavily in AI assistance and want to understand effectiveness

### Value Delivered

1. **Baseline** - Capture current state with quantitative and qualitative signals
2. **Discovery** - What AI configurations and practices exist?
3. **Assessment** - How effective is the current setup?
4. **Tracing** - Why did issues occur? What session/config gap caused them?
5. **Recommendation** - Specific config changes to enable prevention
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
DETECT ──▶ TRACE ──▶ UNDERSTAND ──▶ RECOMMEND
```

| Step | Question | Example |
|------|----------|---------|
| **DETECT** | What is wrong? | Secret in CLAUDE.md |
| **TRACE** | When/where did it originate? | Session where user asked "add API config" |
| **UNDERSTAND** | Why did it happen? | No credential handling guidance exists |
| **RECOMMEND** | How do we enable prevention? | Add: "Use environment variables for credentials" |

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
4. **Mixed-Methods (Agent-Orchestrated)** - Quantitative + qualitative. The agent reasons about which methods to apply.
5. **Language-Agnostic** - Works across programming languages.
6. **Agent-Agnostic** - Supports any AI coding agent via adapters.
7. **Intelligent Tooling** - Tools exist to serve the agent's cognitive needs. The agent chooses freely between tool use and direct reasoning—no approach is privileged.
8. **Compounding Value** - Value compounds over time through:
   - Project-level baselines and trend analysis
   - Global learnings that transfer across projects
   - Recommendation effectiveness tracking
9. **Agent-Aware** - The agent IS the orchestrator. Design serves the agent's cognitive needs.

---

## Stakeholder Experience Framework

agentlint recognizes three distinct but interconnected experiences that must be optimized together:

### Agent Experience (AX)

How effectively does the configuration serve the AI agent's cognitive needs?

- Is context distilled and structured for stable reasoning?
- Is working memory organized hierarchically?
- Are instructions compressed without losing intent?
- Does the feedback loop support self-correction?

**Key Insight**: Research shows "even a weaker model equipped with a strong agent scaffold can outperform a stronger model" with poor scaffolding. How context is organized matters as much as what's in it.

### User Experience (UX)

How well does the human understand what's happening?

- Can the developer trace issues to their origin?
- Is agent behavior interpretable and controllable?
- Are recommendations actionable and well-explained?
- Is improvement visible over time?

### Developer Experience (DX)

How observable and improvable is the system?

- Can configurations be evaluated systematically?
- Are analysis results reproducible?
- Is the tool modular and extensible?
- Can findings be shared and compared?

**Design Implication**: What the agent needs differs from what humans need. agentlint analyzes both perspectives and may surface tensions between them.

### Collaborative Model

agentlint is a **recommendation system**, not an automation system. The interaction model:

1. **Analyse**: Agent gathers context and identifies issues
2. **Discuss**: Agent presents findings and asks clarifying questions
3. **Recommend**: Agent proposes options with traced rationale
4. **Decide**: Developer chooses which recommendations to implement
5. **Implement**: Changes made collaboratively with developer approval

The agent may ask questions to clarify intent, validate assumptions, or present options. The developer remains in control of all decisions and changes.

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
- >30% of recommendations promoted to global learnings
- Returning users show faster time-to-first-insight

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
2. **Does it trace to root cause?** Understanding enables prevention.
3. **Does it embrace mixed methods?** Quantitative + qualitative.
4. **Does it improve understanding?** Insight over raw numbers.
5. **Does it serve the agent's needs?** Tools support; agent provides understanding.
6. **Does it maintain local-first?** No data leaves without consent.
7. **Is it language/agent-agnostic?** Broad applicability.
8. **Does it preserve user agency?** Recommend, don't automate; developer decides.

---

## What Success Looks Like

**Week 1**: Developer runs `agentlint baseline`. Captures starting signals.

**Week 2**: Runs `agentlint analyse`. Discovers a high-iteration session where AI added a secret to config. Traces origin: "add my API config" prompt with no credential guidance. Applies preventive recommendation: adds "Use environment variables for all credentials" to CLAUDE.md.

**Week 4+**: Regular analysis becomes practice. New issues are traced to origin. Developer builds a CLAUDE.md that prevents common failure modes. Token costs drop. Iteration counts fall. Each improvement compounds.

**The difference**: Developer doesn't just know "what's wrong"—they know "why it happened" and "how to prevent it."

---

*This document defines what agentlint is and is not. Refer to it when scope questions arise.*
