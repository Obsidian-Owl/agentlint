# Temporal Analysis Module

Longitudinal tracking of AI-assisted development workflow effectiveness through mixed-methods measurement.

## Overview

This module provides tools for:

- **Baseline capture**: Snapshot workflow metrics at any point
- **Delta analysis**: Compare baselines to detect changes
- **Trend analysis**: Track patterns across 3+ baselines
- **Qualitative reviews**: Structured 6-dimension sentiment capture
- **Recommendation tracking**: Monitor implementation effectiveness

## Quick Start

See [quickstart.md](../../specs/ep09-temporal-analysis/quickstart.md) for usage examples.

## Architecture

Per ADR-0019, tools return **data and evidence**; the agent provides **judgment**.

| Component      | Purpose                                               |
| -------------- | ----------------------------------------------------- |
| `delta/`       | Baseline comparison, jsondiffpatch wrapper            |
| `trends/`      | Linear regression, trend detection, inflection points |
| `qualitative/` | Review dimensions, sentiment calculation, alignment   |
| `tracking/`    | Recommendation implementation detection               |
| `correlation/` | Git history correlation for changes                   |
| `reminders/`   | Review triggers and scheduling                        |
| `tools/`       | MCP tool definitions                                  |
| `subagent/`    | Temporal analyzer subagent                            |

## Tools

8 MCP tools exported:

- `store_baseline`, `query_baseline`, `list_baselines` - Baseline management
- `calculate_delta` - Compare two baselines
- `query_trends` - Analyze patterns across multiple baselines
- `conduct_review`, `get_review_history` - Qualitative reviews
- `spawn_temporal_analyst` - Spawn specialized subagent for analysis
