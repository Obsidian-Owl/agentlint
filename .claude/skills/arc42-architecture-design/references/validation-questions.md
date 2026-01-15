# Validation Questions for Arc42 Documentation

**CRITICAL**: All design questions and assumptions MUST be validated with the user before finalizing documentation. Never assume—always ask.

## Question Strategy

1. Start with highest-impact gaps
2. Ask 3-5 questions per batch maximum
3. Acknowledge answers before asking follow-ups
4. Explicitly state assumptions being validated

## Phase 1: Business Context Questions

### Requirements & Goals (Section 1.1)

**If no requirements doc found:**
```
I couldn't find formal requirements documentation. To create accurate Arc42 documentation, I need to understand:

1. What is the primary business problem this system solves?
2. Who are the main users of this system, and what do they need to accomplish?
3. What are the 2-3 most critical features or capabilities?
```

**If requirements doc found but incomplete:**
```
I found [document name] but need clarification on:

1. Is [feature X] still a current requirement, or has this changed?
2. The document mentions [Y]—can you elaborate on the business need?
3. Are there requirements not captured in this document?
```

### Quality Goals (Section 1.2)

**Always ask—quality goals are critical:**
```
Quality goals drive architectural decisions. Please rank these by importance (1=highest):

- Performance: Response time, throughput targets
- Reliability: Uptime requirements, fault tolerance
- Security: Authentication, authorization, data protection
- Scalability: Expected growth, peak load handling
- Maintainability: Code quality, ease of changes
- Usability: User experience priorities

Which 3-5 are MOST critical for this system, and what specific targets exist?
```

### Stakeholders (Section 1.3)

```
Who needs to understand or use this architecture documentation?

1. Development team roles?
2. Operations/DevOps teams?
3. Business stakeholders or product owners?
4. External parties (partners, auditors, regulators)?
5. What are their specific expectations from the documentation?
```

## Phase 2: Constraint Questions

### Technical Constraints (Section 2)

**If detected from codebase:**
```
Based on my analysis, the system uses:
- Language: [X]
- Framework: [Y]
- Database: [Z]
- Cloud/Infrastructure: [W]

Questions:
1. Are these technology choices mandated, or open to change?
2. Are there specific versions that must be maintained?
3. What integration constraints exist with other systems?
```

**If not detected:**
```
What technical constraints apply to this system?

1. Mandated technologies or frameworks?
2. Required compatibility (browsers, devices, APIs)?
3. Infrastructure limitations or requirements?
4. Performance or resource constraints?
```

### Organizational Constraints

```
What organizational factors constrain the architecture?

1. Team structure and expertise available?
2. Development process requirements (Agile, specific tools)?
3. Compliance or regulatory requirements?
4. Budget or timeline constraints affecting technical choices?
```

## Phase 3: Context Questions

### Business Context (Section 3.1)

**If external interfaces detected:**
```
I identified these external systems/interfaces:
- [System A]: [detected interaction]
- [System B]: [detected interaction]

For each, please confirm or correct:
1. What data flows in each direction?
2. Who owns/maintains the external system?
3. What SLAs or contracts govern the integration?
4. Are there any I missed?
```

**If no external interfaces found:**
```
What external systems does this system interact with?

1. Upstream data sources?
2. Downstream consumers?
3. Third-party services (payment, auth, notifications)?
4. Internal corporate systems?
```

### Technical Context (Section 3.2)

```
For the technical interfaces:

1. What protocols are used (REST, gRPC, messaging)?
2. What authentication/authorization mechanisms?
3. Are there rate limits or quotas?
4. What data formats are exchanged?
```

## Phase 4: Architecture Questions

### Solution Strategy (Section 4)

```
What fundamental decisions shaped this architecture?

1. Why was [technology X] chosen over alternatives?
2. What architecture pattern is used (microservices, modular monolith, etc.)?
3. What trade-offs were explicitly made?
4. What problems is the current architecture optimized for?
```

### Building Blocks (Section 5)

**After initial analysis:**
```
Based on code analysis, I identified these major components:
- [Component A]: [detected responsibility]
- [Component B]: [detected responsibility]
- [Component C]: [detected responsibility]

Questions:
1. Is this decomposition accurate?
2. Are there components I missed or mischaracterized?
3. Which components are most critical/complex and need detailed documentation?
4. Are there planned components not yet implemented?
```

### Runtime Scenarios (Section 6)

```
What are the most important runtime scenarios to document?

1. Primary user workflows (happy paths)?
2. Critical error handling scenarios?
3. High-volume or performance-critical paths?
4. Security-sensitive operations?

For each, what are the key building blocks involved?
```

### Deployment (Section 7)

**If infrastructure code found:**
```
From [Dockerfile/Terraform/K8s manifests], I see:
- [deployment pattern detected]
- [infrastructure components]

Is this accurate? What environments exist (dev, staging, prod)?
```

**If no infrastructure code:**
```
How is the system deployed?

1. What environments exist?
2. Cloud provider and services used?
3. Containerization approach?
4. CI/CD pipeline details?
5. Scaling configuration?
```

## Phase 5: Crosscutting & Decisions

### Crosscutting Concepts (Section 8)

```
Which crosscutting concerns have defined approaches?

1. Logging and monitoring strategy?
2. Error handling patterns?
3. Security implementation (authentication, authorization)?
4. Data validation approach?
5. Configuration management?
6. Testing strategy?

Which of these need detailed documentation?
```

### Architecture Decisions (Section 9)

```
What were the most significant architecture decisions?

For each important decision:
1. What problem was being solved?
2. What options were considered?
3. Why was this option chosen?
4. What are the known trade-offs or consequences?

Are there any decisions that should be revisited or documented as "pending"?
```

## Phase 6: Quality & Risks

### Quality Scenarios (Section 10)

**Based on earlier quality goals:**
```
For the quality goal of [X], what specific scenarios should we document?

Example format:
- Source: [who/what triggers]
- Stimulus: [what happens]
- Response: [expected behavior]
- Measure: [how to verify]

What are your top 3-5 quality scenarios?
```

### Risks & Technical Debt (Section 11)

```
What risks or technical debt should be documented?

1. Known architectural risks?
2. Areas of technical debt?
3. Single points of failure?
4. Dependencies that concern you?
5. Security vulnerabilities being tracked?

For each, what is the potential impact and any mitigation plans?
```

## Phase 7: Terminology

### Glossary (Section 12)

```
What domain-specific terms should be defined?

1. Business terms that might be unfamiliar to developers?
2. Technical terms with project-specific meanings?
3. Acronyms used in the codebase or documentation?
4. Terms that have caused confusion before?
```

## Assumption Validation Template

When making assumptions, use this format:

```
I'm making the following assumptions based on my analysis:

**Assumption 1**: [statement]
- Evidence: [what I observed]
- Impact if wrong: [what would change in documentation]

**Assumption 2**: [statement]
- Evidence: [what I observed]
- Impact if wrong: [what would change in documentation]

Please confirm these assumptions or provide corrections.
```

## Answer Integration

After receiving answers:

1. Summarize what was learned
2. Identify any follow-up questions
3. Explain how answers affect documentation
4. Ask permission to proceed with next phase
