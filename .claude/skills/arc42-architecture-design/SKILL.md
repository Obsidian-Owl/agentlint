---
name: arc42-architecture-design
description: Decompose high-level design documentation into detailed Arc42 architecture documentation. Use when the user asks to create architecture documentation, generate Arc42 documents, analyze a codebase for architecture patterns, or convert existing design docs to Arc42 format. This skill analyzes repositories, identifies architectural components, validates context and assumptions through user questions, and produces comprehensive Arc42-compliant documentation.
---

# Arc42 Architecture Design Generator

Transform high-level design documentation into comprehensive Arc42 architecture documentation through systematic analysis, validation, and generation.

## Overview

Arc42 is a pragmatic, structured template for documenting software architectures with 12 sections covering everything from goals to glossary. This skill guides the process of:

1. Analyzing existing repositories and documentation
2. Extracting architectural patterns and components
3. Validating assumptions through structured user questions
4. Generating complete Arc42-compliant documentation

## Documentation Structure Best Practices

### Progressive Disclosure for AI Agents

Arc42 documentation should be structured for **progressive disclosure**—enabling AI agents to load only the context they need:

```
docs/architecture/arc42/
├── README.md                    # Index (~200 tokens) - Load first
├── 01-introduction-goals.md     # Section 1 (~500-1000 tokens)
├── 02-constraints.md            # Section 2 (~300-500 tokens)
├── 03-context-scope.md          # Section 3 (~500-800 tokens)
├── 04-solution-strategy.md      # Section 4 (~600-1000 tokens)
├── 05-building-blocks.md        # Section 5 (~800-1500 tokens)
├── 06-runtime-view.md           # Section 6 (~600-1000 tokens)
├── 07-deployment-view.md        # Section 7 (~500-800 tokens)
├── 08-crosscutting-concepts.md  # Section 8 (~600-1000 tokens)
├── 09-architecture-decisions.md # Section 9 (~300 tokens, links to ADRs)
├── 10-quality-requirements.md   # Section 10 (~500-800 tokens)
├── 11-risks-technical-debt.md   # Section 11 (~400-600 tokens)
└── 12-glossary.md               # Section 12 (~300-500 tokens)
```

### Key Principles for AI-Friendly Documentation

1. **Lightweight Index**: README.md provides navigation with 1-2 sentence summaries per section
2. **Self-Contained Sections**: Each document is complete without requiring other sections
3. **Token Budget**: Keep individual documents under 1500 tokens where possible
4. **Cross-References**: Use relative links `[Section 5](05-building-blocks.md)` for navigation
5. **Frontmatter Metadata**: Include section number, title, and last-updated date
6. **Diagrams First**: Lead with visual representations; details follow

### Document Template

Each section document should follow this structure:

```markdown
# Section N: Title

> One-sentence summary for index extraction.

**Last Updated**: YYYY-MM-DD
**Related Sections**: [Link1](file.md), [Link2](file.md)

---

[Content organized for quick comprehension]
```

## Arc42 Sections Summary

| Section | Purpose | Key Content |
|---------|---------|-------------|
| 1. Introduction & Goals | Business context | Requirements overview, quality goals (top 3-5), stakeholders |
| 2. Constraints | Boundaries | Technical, organizational, and convention constraints |
| 3. Context & Scope | System boundaries | Business context diagram, technical context diagram |
| 4. Solution Strategy | Core decisions | Technology choices, architecture patterns, key approaches |
| 5. Building Block View | Static structure | Hierarchical whitebox/blackbox decomposition (Level 1, 2, 3+) |
| 6. Runtime View | Dynamic behavior | Key scenarios, interaction sequences, workflows |
| 7. Deployment View | Infrastructure | Hardware, environments, deployment mapping |
| 8. Crosscutting Concepts | Shared patterns | Security, logging, error handling, domain models |
| 9. Architecture Decisions | ADRs | Important decisions with rationale (use ADR format) |
| 10. Quality Requirements | Quality tree | Quality scenarios, quality tree structure |
| 11. Risks & Technical Debt | Known issues | Prioritized risks, technical debt items |
| 12. Glossary | Terminology | Domain and technical terms with definitions |

## Workflow

Execute these phases in order:

### Phase 1: Repository Analysis

Analyze the codebase to understand the existing architecture:

```
1. Examine project structure
   - Directory layout and organization patterns
   - Configuration files (package.json, pom.xml, Dockerfile, etc.)
   - Entry points and main modules

2. Identify key documentation
   - README files, ARCHITECTURE.md, design docs
   - API specifications (OpenAPI, GraphQL schemas)
   - Database schemas and migrations

3. Map technical stack
   - Languages, frameworks, libraries
   - External services and integrations
   - Infrastructure as code (Terraform, CloudFormation)

4. Trace component relationships
   - Import/dependency graphs
   - Service communication patterns
   - Data flow paths
```

### Phase 2: Context Validation

**CRITICAL: Validate ALL assumptions with user before proceeding.**

Use the structured question approach in [references/validation-questions.md](references/validation-questions.md) to gather:

- Business context and goals
- Stakeholder expectations
- Quality priorities
- Constraint clarifications
- Missing architectural context

Ask questions in batches of 3-5 to avoid overwhelming the user. Start with highest-priority gaps.

### Phase 3: Architecture Extraction

Extract architectural elements from analyzed sources:

**Building Blocks (Section 5)**
- Level 1: Top-level system decomposition
- Level 2: Component internals for critical blocks
- Level 3: Only for complex/risky components

**Runtime Scenarios (Section 6)**
- Primary use cases (happy path)
- Error handling flows
- Integration touchpoints

**Deployment (Section 7)**
- Production environment topology
- Development/staging differences if significant

### Phase 4: Documentation Generation

Generate Arc42 documentation following [references/arc42-template.md](references/arc42-template.md).

**Output Structure (Default - Progressive Disclosure):**

```
docs/architecture/arc42/
├── README.md                    # Lightweight index with navigation
├── 01-introduction-goals.md     # Requirements, quality goals, stakeholders
├── 02-constraints.md            # Technical, organizational, conventions
├── 03-context-scope.md          # Business and technical context diagrams
├── 04-solution-strategy.md      # Technology choices, patterns
├── 05-building-blocks.md        # System decomposition (Level 1, 2)
├── 06-runtime-view.md           # Key scenarios and workflows
├── 07-deployment-view.md        # Infrastructure and installation
├── 08-crosscutting-concepts.md  # Security, logging, error handling
├── 09-architecture-decisions.md # Links to ADRs with summaries
├── 10-quality-requirements.md   # Quality tree and scenarios
├── 11-risks-technical-debt.md   # Known risks and debt items
└── 12-glossary.md               # Domain and technical terms
```

**Document Guidelines:**
- README.md: <200 tokens, summaries only, navigation links
- Individual sections: 500-1500 tokens each
- Self-contained: Each section readable without others
- Diagrams first: Lead with visuals, follow with details

**Quality Checks:**
- Verify all 12 sections addressed (sections may be marked "not applicable" with justification)
- Ensure diagrams are described or created
- Cross-reference between sections using relative links
- Validate consistency of terminology with glossary
- Check token budget compliance for each document

## Key Principles

### Document What Matters
Arc42 is flexible—not every section needs exhaustive content. Focus on:
- Sections most relevant to stakeholders
- Areas with highest risk or complexity
- Information not obvious from code

### Quality Goals Drive Architecture
The top 3-5 quality goals (Section 1.2) should influence:
- Solution strategy choices (Section 4)
- Crosscutting concepts (Section 8)
- Architecture decisions (Section 9)
- Quality scenarios (Section 10)

### Building Block Hierarchy
```
Level 0: Context (System as blackbox)
    ↓
Level 1: Whitebox of entire system (major components as blackboxes)
    ↓
Level 2: Whitebox of selected Level-1 components
    ↓
Level 3+: Only for complex/risky areas
```

### Blackbox vs Whitebox
- **Blackbox**: Responsibility + interfaces (what it does)
- **Whitebox**: Internal structure + contained blackboxes (how it's built)

## Diagram Conventions

When describing diagrams, use clear textual notation:

**Context Diagram:**
```
[External System A] --> [Our System] --> [External System B]
         |                    |
         v                    v
    [Database]           [Message Queue]
```

**Building Block Diagram:**
```
+------------------+
|    Our System    |
|  +------------+  |
|  | Component A|--|---> [External API]
|  +------------+  |
|       |          |
|       v          |
|  +------------+  |
|  | Component B|  |
|  +------------+  |
+------------------+
```

Use Mermaid, PlantUML, or ASCII art based on user preference.

## References

- **Validation Questions**: [references/validation-questions.md](references/validation-questions.md)
- **Arc42 Template**: [references/arc42-template.md](references/arc42-template.md)
- **ADR Template**: [references/adr-template.md](references/adr-template.md)
- **Quality Scenarios**: [references/quality-scenarios.md](references/quality-scenarios.md)
