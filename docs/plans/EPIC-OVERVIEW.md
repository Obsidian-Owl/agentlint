# Epic Overview

> Quick reference for agentlint development epics

## Epic Catalogue

For the complete epic catalogue with full details, see: [epic-catalogue.md](../planning/epic-catalogue.md)

## Quick Reference

| Epic | Name | Phase | Priority | Dependencies |
|------|------|-------|----------|--------------|
| EP01 | Core Foundation | 1 | Critical | None |
| EP02 | Configuration Analysis | 1 | Critical | EP01 |
| EP03 | Session Analysis | 1 | High | EP01, EP02 |
| EP04 | Baseline & Comparison | 2 | High | EP01, EP02, EP03 |
| EP05 | Rule Engine | 2 | High | EP01, EP02 |
| EP06 | CLI Experience | 2 | Medium | EP01-EP05 |
| EP07 | Recommendation Engine | 3 | High | EP03, EP05 |
| EP08 | Agent Adapters | 3 | Medium | EP01-EP03 |
| EP09 | Learning System | 3 | Medium | EP04, EP07 |
| EP10 | MCP Integration | 4 | Low | EP01-EP07 |
| EP11 | Advanced Analytics | 4 | Low | EP03, EP04, EP05 |
| EP12 | Ecosystem Integration | 4 | Low | EP01-EP11 |

## Development Phases

### Phase 1: Foundation (EP01-EP03)
Critical infrastructure enabling all other work.

### Phase 2: Core Features (EP04-EP06)
Essential analysis and comparison capabilities.

### Phase 3: Intelligence (EP07-EP09)
Recommendation engine and learning system.

### Phase 4: Ecosystem (EP10-EP12)
MCP, advanced analytics, and third-party integration.

## Linear Projects

Each epic has a corresponding Linear project:
- Format: `EP## - Epic Name`
- Labels: `epic:EP##`
- Team: `agentlint`

## Dev Workflow

Use these skills for feature development:

```
/dev.specify   → Create feature spec from epic
/dev.clarify   → Resolve ambiguities
/dev.plan      → Design implementation
/dev.tasks     → Generate task breakdown
/dev.taskstolinear → Create Linear issues
/dev.implement → Execute tasks
/dev.analyze   → Validate quality
/arch-review   → Check architecture compliance
```

## Starting a Feature

1. Choose an epic from the catalogue
2. Run `/dev.specify` with feature description
3. Follow the workflow pipeline
4. All tasks sync to Linear for tracking

## See Also

- [Epic Catalogue](../planning/epic-catalogue.md) - Full epic details
- [Arc42 Documentation](../architecture/) - Architecture docs
- [Constitution](../../.specify/memory/constitution.md) - Project principles
