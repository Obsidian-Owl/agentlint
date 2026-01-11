# agentlint: North Star

> The constitution preamble for agentlint development.

---

## Mission Statement

agentlint enables continuous improvement of AI-assisted development workflows by establishing baselines, tracking signals over time, and providing actionable insights as codebases and practices evolve.

---

## Product Vision

### The Problem

AI coding assistants are only as effective as the context they receive. Most developers use default configurations and miss opportunities for optimization. Worse, they have no way to understand whether changes actually improve outcomes—and research shows developers consistently misjudge their own AI-assisted productivity.

### The Solution

A command-line tool that answers: **"How effective is my AI coding workflow, and how is it improving over time?"**

This is not a one-time diagnostic. It's an ongoing practice that compounds value through regular use.

### Who We Serve (MVP)

- **Solo developers** who want to systematically improve their AI-assisted workflows
- **Multi-tool experimenters** who need unified tracking across AI tools
- **AI-first developers** who invest heavily in AI assistance and want to understand effectiveness

### Value Delivered

1. **Baseline** - Capture current state with quantitative and qualitative signals
2. **Discovery** - What AI configurations and practices exist?
3. **Assessment** - How effective is the current setup?
4. **Recommendations** - Specific improvements with clear rationale
5. **Tracking** - Observe changes over time, correlate with improvements
6. **Automation** - Generate configurations and workflow improvements

---

## The Continuous Improvement Model

```
  BASELINE ──▶ CHANGE ──▶ OBSERVE ──▶ UNDERSTAND ──▶ REFINE ──┐
      │                                                        │
      └────────────────────────────────────────────────────────┘
```

Value compounds through recurring use. Each cycle builds understanding of what works for *your* workflow.

---

## Signals Framework

We use mixed methods—quantitative signals provide objective anchors; qualitative assessment tells us *why* things work.

| Type | Examples |
|------|----------|
| **Leading** (predict outcomes) | Config coverage, type strictness, doc completeness |
| **Lagging** (reflect outcomes) | Token efficiency, iteration count, error frequency |
| **Qualitative** (semantic/perceptual) | Config clarity, doc coherence, perceived friction |

**Meta-inferences**—the most valuable insights—emerge from correlating signals across types.

---

## Design Principles

1. **Local-First** - All analysis on user's machine. No data leaves without consent.
2. **Improvement-Oriented** - Features compound value over time. Tracking is core, not afterthought.
3. **Mixed-Methods** - Quantitative + qualitative. Embrace exploratory analysis.
4. **Language-Agnostic** - Works across programming languages.
5. **Tool-Agnostic** - Supports any AI assistant via adapters.
6. **Static-First** - Prefer deterministic analysis. Use LLMs where genuinely required.
7. **Progressive Value** - Useful without LLM config. LLM enhances but isn't required.

---

## Success Indicators

### User Outcomes
- Positive directional trends after improvement cycles
- Reduced tokens/iterations for comparable tasks over time
- Analysis becomes regular practice, not one-time diagnostic

### Product Signals
- >60% recurring usage (multiple runs per month)
- >50% recommendation adoption
- Users maintain baselines across 10+ runs

### Technical Indicators
- Full scan < 30 seconds
- Trend queries < 2 seconds
- >95% config detection accuracy

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
2. **Does it embrace mixed methods?** Both quantitative and qualitative matter.
3. **Does it improve understanding?** Insight over raw numbers.
4. **Can it be done statically?** Prefer deterministic analysis.
5. **Does it maintain local-first?** No data leaves without consent.
6. **Is it language/tool-agnostic?** Broad applicability.

---

## What Success Looks Like

**Week 1**: Developer runs `agentlint baseline`. Captures starting signals.

**Week 2**: Applies recommendations. Runs `agentlint analyze`. Observes shifts in both metrics and qualitative assessments.

**Week 4+**: Regular analysis becomes practice. Developer builds intuition for what helps *their* workflow. Some recommendations don't pan out—that's learning too.

---

*This document defines what agentlint is and is not. Refer to it when scope questions arise.*
