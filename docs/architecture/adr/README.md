# Architecture Decision Records

This directory contains agentlint's Architecture Decision Records (ADRs).

## Purpose

ADRs document significant architectural decisions with their context, rationale, and consequences. Each ADR follows the [MADR 4.0 template](https://adr.github.io/madr/) structure.

## ADR Index

For the complete ADR index with decision summaries, dependency graphs, and constitution compliance mapping, see:

**[Arc42 Section 9: Architecture Decisions](../arc42/09-architecture-decisions.md)**

## Naming Convention

ADRs are numbered sequentially: `NNNN-short-descriptive-title.md`

## Status Values

- `proposed` - Under consideration
- `accepted` - Approved and active
- `deprecated` - No longer applies
- `superseded` - Replaced by another ADR

## Quick Reference

| Range | Category |
|-------|----------|
| 0001-0005 | Foundation (Runtime, Distribution, Storage, Config, Credentials) |
| 0006-0011 | Agent Architecture (Analysis, Causal, Session, Observability, Recommendations, Parallel) |
| 0012-0015 | Analysis Features (Incremental, Testing, Error Handling, Reproducibility) |
| 0016-0021 | Infrastructure (Concurrency, Versioning, Adapters, Languages, Output, Caching) |
| 0022-0025 | Integration (CI/CD, Git Hooks, CLI, Logging) |
| 0026-0028 | Advanced Features (Hindsight, Working Memory, Modularity) |

## Related Documents

- [Constitution](../../../.specify/memory/constitution.md) - 9 foundational principles all ADRs must comply with
- [North Star](../../north-star.md) - Product vision and success criteria
