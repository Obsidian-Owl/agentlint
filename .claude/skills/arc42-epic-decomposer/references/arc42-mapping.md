# Arc42 Section to Epic Mapping

Detailed guidance on extracting epic content from each Arc42 section.

## Section Reference Table

| Section | Content | Epic Type | Key Extractions |
|---------|---------|-----------|-----------------|
| §1 Introduction & Goals | Business context, quality goals, stakeholders | All | Acceptance criteria, success metrics, stakeholder needs |
| §2 Constraints | Technical and organisational constraints | Enabler | Tech mandates, compliance requirements, timeline pressures |
| §3 Context & Scope | System boundaries, external interfaces | Integration | External systems, API boundaries, data flows |
| §4 Solution Strategy | Fundamental decisions, patterns | Foundation | Core patterns to implement, technology choices |
| §5 Building Block View | Component hierarchy, decomposition | Business | Components, modules, bounded contexts, responsibilities |
| §6 Runtime View | Key scenarios, interactions | Business | Transaction boundaries, workflow sequences |
| §7 Deployment View | Infrastructure, environments | Foundation | Infrastructure provisioning, environment setup |
| §8 Crosscutting Concepts | Security, logging, error handling | Enabler | Horizontal capabilities needed across epics |
| §9 Architecture Decisions | ADRs, rationale | All | Constraints on implementation approach |
| §10 Quality Requirements | Quality scenarios, NFRs | All | Performance targets, security requirements |
| §11 Risks & Technical Debt | Known problems | Enabler | Remediation epics, risk mitigation work |
| §12 Glossary | Domain terminology | — | Consistent naming in epic descriptions |

## Extracting Foundation Epics

**From §4 Solution Strategy:**
- Core architectural patterns requiring implementation
- Framework/library setup decisions
- Authentication/authorisation approach

**From §7 Deployment View:**
- CI/CD pipeline requirements
- Environment provisioning (dev, staging, prod)
- Infrastructure as code setup
- Container orchestration setup

**From §8 Crosscutting Concepts (foundational aspects):**
- Logging infrastructure
- Configuration management
- Shared utilities/libraries

## Extracting Business Epics

**From §5 Building Block View:**
- Each Level 1 component is a candidate epic
- Group tightly coupled Level 2 components
- Identify bounded context boundaries

**From §6 Runtime View:**
- Key user journeys become epic scope
- Transaction boundaries define epic boundaries
- Async vs sync flows may warrant separate epics

**Questions to ask:**
1. Can this component deliver value independently?
2. Does it map to a distinct user capability?
3. Can it be demonstrated to stakeholders alone?

## Extracting Enabler Epics

**From §2 Constraints:**
- Compliance requirements (GDPR, SOC2, etc.)
- Mandated technology adoption
- Security certifications needed

**From §8 Crosscutting Concepts:**
- Observability (metrics, tracing, alerting)
- Security hardening
- Internationalisation/localisation
- Performance optimisation

**From §11 Risks & Technical Debt:**
- Critical tech debt remediation
- Risk mitigation implementations
- Architectural runway items

## Extracting Integration Epics

**From §3 Context & Scope:**
- Each external system interface = potential epic
- Data synchronisation requirements
- API contract implementations

**Questions to ask:**
1. Is there a defined API contract?
2. What's the integration pattern (sync/async/batch)?
3. Are there data migration requirements?

## Cross-Referencing with ADRs

For each epic, check `docs/architecture/adr/` for:
- Decisions that constrain implementation approach
- Technology choices already made
- Patterns that must be followed
- Trade-offs already evaluated

Include relevant ADR numbers in epic traceability section.

## Cross-Referencing with Requirements

If `docs/requirements/` exists, check for:
- Persona definitions → Epic user focus
- Use case specifications → Epic scope refinement
- Detailed requirements → Acceptance criteria