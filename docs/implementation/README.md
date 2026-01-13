# Implementation Guides

This directory contains detailed implementation guidance extracted from Architecture Decision Records (ADRs). ADRs focus on **decisions**; these guides focus on **how to implement** those decisions.

## Guides

| Guide | Source ADRs | Description |
|-------|-------------|-------------|
| [Database Schema](./database-schema.md) | ADR-0003, ADR-0012 | SQLite schema extensions for recommendations, staleness |
| [Hooks Integration](./hooks-integration-guide.md) | ADR-0012, ADR-0023 | Git hooks, Claude Code hooks, shell integration |
| [Caching Implementation](./caching-implementation.md) | ADR-0021 | Cache classes, warming, metrics |

## Relationship to ADRs

ADRs document **why** decisions were made. These guides document **how** to implement them. When reading an ADR, look for "See [Implementation Guide]" links to find detailed code examples and step-by-step instructions.

## Directory Structure

```
docs/implementation/
├── README.md                  # This file
├── database-schema.md         # Schema extensions from ADRs
├── hooks-integration-guide.md # Hook installation scripts
└── caching-implementation.md  # Cache class implementations
```
