# Quality Scenarios for Arc42 Section 10

Quality scenarios operationalize the quality goals from Section 1.2 into testable, specific requirements.

## Scenario Structure

Each quality scenario follows this structure:

```
Source → Stimulus → Environment → Artifact → Response → Measure
```

| Element | Description | Example |
|---------|-------------|---------|
| Source | Who/what causes the stimulus | End user, External system, Timer |
| Stimulus | Event or condition | Request, Failure, Peak load |
| Environment | Conditions when stimulus occurs | Normal operation, Overload, Startup |
| Artifact | What is affected | System, Component, Data |
| Response | Expected behavior | Process, Log, Recover |
| Measure | Quantifiable success criteria | <200ms, 99.9% success, <1 error |

## Quality Categories and Example Scenarios

### Performance Efficiency

**Response Time:**
```markdown
| Element | Value |
|---------|-------|
| Source | End user |
| Stimulus | Submits search query |
| Environment | Normal operation (<1000 concurrent users) |
| Artifact | Search service |
| Response | Return relevant results |
| Measure | 95th percentile response time <200ms |
```

**Throughput:**
```markdown
| Element | Value |
|---------|-------|
| Source | Multiple concurrent users |
| Stimulus | Submit transactions during peak hours |
| Environment | Peak load (10AM-2PM weekdays) |
| Artifact | Order processing system |
| Response | Process all transactions |
| Measure | >1000 transactions/second |
```

**Resource Utilization:**
```markdown
| Element | Value |
|---------|-------|
| Source | Production workload |
| Stimulus | Normal daily operations |
| Environment | Production environment |
| Artifact | Application servers |
| Response | Handle workload efficiently |
| Measure | CPU utilization <70%, Memory <80% |
```

### Reliability

**Availability:**
```markdown
| Element | Value |
|---------|-------|
| Source | Any user or system |
| Stimulus | Access request at any time |
| Environment | 24/7 operation |
| Artifact | Core system |
| Response | System is operational |
| Measure | 99.9% uptime (8.76 hours downtime/year) |
```

**Fault Tolerance:**
```markdown
| Element | Value |
|---------|-------|
| Source | Infrastructure |
| Stimulus | Primary database server fails |
| Environment | Normal operation |
| Artifact | Database layer |
| Response | Automatic failover to replica |
| Measure | Recovery <30 seconds, zero data loss |
```

**Recoverability:**
```markdown
| Element | Value |
|---------|-------|
| Source | Disaster event |
| Stimulus | Complete datacenter outage |
| Environment | Disaster scenario |
| Artifact | Entire system |
| Response | Restore from backup in secondary DC |
| Measure | RTO <4 hours, RPO <1 hour |
```

### Security

**Authentication:**
```markdown
| Element | Value |
|---------|-------|
| Source | Unauthenticated user |
| Stimulus | Attempts to access protected resource |
| Environment | Any |
| Artifact | Authentication service |
| Response | Block access, redirect to login |
| Measure | 100% of unauthorized requests blocked |
```

**Authorization:**
```markdown
| Element | Value |
|---------|-------|
| Source | Authenticated user |
| Stimulus | Attempts action outside their permissions |
| Environment | Normal operation |
| Artifact | Authorization service |
| Response | Deny access, log attempt |
| Measure | 0% unauthorized access, 100% audit logging |
```

**Data Protection:**
```markdown
| Element | Value |
|---------|-------|
| Source | Attacker |
| Stimulus | Intercepts network traffic |
| Environment | Any network path |
| Artifact | Data in transit |
| Response | Data remains protected |
| Measure | All PII encrypted with TLS 1.3+ |
```

### Maintainability

**Modularity:**
```markdown
| Element | Value |
|---------|-------|
| Source | Developer |
| Stimulus | Needs to modify single feature |
| Environment | Development |
| Artifact | Feature module |
| Response | Change isolated to one module |
| Measure | <3 files changed for typical feature |
```

**Testability:**
```markdown
| Element | Value |
|---------|-------|
| Source | Developer |
| Stimulus | Writes tests for new feature |
| Environment | Development |
| Artifact | Codebase |
| Response | Tests can be written and run easily |
| Measure | >80% code coverage achievable |
```

**Analyzability:**
```markdown
| Element | Value |
|---------|-------|
| Source | Operations team |
| Stimulus | Production error occurs |
| Environment | Production |
| Artifact | Logging and monitoring |
| Response | Root cause identifiable |
| Measure | Mean time to identify root cause <30 min |
```

### Scalability

**Horizontal Scaling:**
```markdown
| Element | Value |
|---------|-------|
| Source | Operations |
| Stimulus | Add new application instances |
| Environment | Increased load conditions |
| Artifact | Application tier |
| Response | Additional capacity available |
| Measure | Linear throughput increase with instances |
```

**Load Handling:**
```markdown
| Element | Value |
|---------|-------|
| Source | Marketing campaign |
| Stimulus | 10x normal traffic spike |
| Environment | Campaign period |
| Artifact | System |
| Response | Handle increased load gracefully |
| Measure | <5% error rate, <2x normal response time |
```

### Usability

**Learnability:**
```markdown
| Element | Value |
|---------|-------|
| Source | New user |
| Stimulus | First-time use of core feature |
| Environment | Production |
| Artifact | User interface |
| Response | User completes task without help |
| Measure | >80% success rate within 3 attempts |
```

**Error Prevention:**
```markdown
| Element | Value |
|---------|-------|
| Source | User |
| Stimulus | Enters invalid data |
| Environment | Data entry |
| Artifact | Form validation |
| Response | Clear error message before submission |
| Measure | 0% invalid data saved to database |
```

## Quality Tree Structure

Organize scenarios hierarchically:

```
Quality
├── Performance
│   ├── QS-P1: Search response time
│   ├── QS-P2: Order processing throughput
│   └── QS-P3: Report generation time
├── Reliability
│   ├── QS-R1: System availability
│   ├── QS-R2: Database failover
│   └── QS-R3: Disaster recovery
├── Security
│   ├── QS-S1: Authentication enforcement
│   ├── QS-S2: Authorization checks
│   └── QS-S3: Data encryption
└── Maintainability
    ├── QS-M1: Feature isolation
    └── QS-M2: Debugging efficiency
```

## Writing Effective Scenarios

### Good Scenario Characteristics

1. **Specific**: Concrete numbers, not vague targets
2. **Measurable**: Can be tested and verified
3. **Relevant**: Tied to real stakeholder concerns
4. **Achievable**: Realistic given constraints
5. **Prioritized**: Ranked by importance

### Common Pitfalls

❌ **Too vague**: "System should be fast"
✅ **Specific**: "95th percentile response time <200ms under 1000 concurrent users"

❌ **Unmeasurable**: "System should be secure"
✅ **Measurable**: "100% of API calls authenticated, 0 critical vulnerabilities in annual pentest"

❌ **Untestable**: "Users should be satisfied"
✅ **Testable**: "80% of users complete checkout in <5 minutes"

## Mapping Quality Goals to Scenarios

| Quality Goal (Section 1.2) | Quality Scenarios (Section 10) |
|----------------------------|--------------------------------|
| High Performance | QS-P1, QS-P2, QS-P3 |
| 99.9% Availability | QS-R1, QS-R2 |
| Strong Security | QS-S1, QS-S2, QS-S3 |

Every quality goal from Section 1.2 should have at least one scenario in Section 10.

## Scenario Review Checklist

- [ ] Does every quality goal have scenarios?
- [ ] Are measures specific and quantifiable?
- [ ] Are scenarios testable (can write automated tests)?
- [ ] Are scenarios realistic (achievable with current resources)?
- [ ] Are the most critical scenarios prioritized?
- [ ] Do scenarios cover both happy path and failure cases?
