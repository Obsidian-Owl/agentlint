# ADR-0020: Sentiment Scale Normalization

## Status
Accepted

## Context

The temporal analysis system uses sentiment values to represent user feedback quality across different dimensions. During development, two different scales emerged:

1. **Likert Scale (-2 to +2)**: Used internally by the system for sentiment calculations
   - -2: Very Negative
   - -1: Negative
   -  0: Neutral
   - +1: Positive
   - +2: Very Positive

2. **Normalized Scale (-1 to +1)**: Initially used in some golden test datasets
   - Convenient for percentage-based calculations
   - Common in ML contexts

This inconsistency was identified during PR review (Greptile comment on review-quality.test.ts:499) and causes confusion in evaluation tests.

## Decision

We standardize on the **Likert Scale (-2 to +2)** as the canonical sentiment representation throughout the system:

1. **Internal calculations**: Use Likert scale (-2 to +2)
2. **Golden datasets**: Use Likert scale (-2 to +2)
3. **Tool outputs**: Use Likert scale (-2 to +2)
4. **Normalization utilities**: Provided for external integrations that may need -1 to +1

### Scale Conversion Formulas

```
Likert to Normalized: normalized = likert / 2
Normalized to Likert: likert = normalized * 2
```

### Utility Functions

The `src/temporal/qualitative/sentiment.ts` module provides:

- `likertToNormalized(value)`: Convert Likert (-2 to +2) to normalized (-1 to +1)
- `normalizedToLikert(value)`: Convert normalized (-1 to +1) to Likert (-2 to +2)
- `isValidSentiment(value)`: Validate Likert scale values
- `clampSentiment(value)`: Clamp to valid Likert range

## Consequences

### Positive

- **Consistency**: Single scale throughout the codebase reduces confusion
- **Expressiveness**: Likert scale provides 5 discrete levels for finer granularity
- **Compatibility**: Normalization utilities available for external integrations
- **Clarity**: Integer values (-2, -1, 0, 1, 2) are easier to interpret than decimals

### Negative

- **Migration**: Golden datasets needed updating to use Likert scale
- **Learning curve**: Contributors must understand the Likert convention

### Neutral

- **External APIs**: May need conversion when integrating with systems expecting -1 to +1

## References

- [EP09 Temporal Analysis Spec](../../../specs/ep09-temporal-analysis/spec.md) - Q1 resolution on sentiment scale
- [sentiment.ts](../../../src/temporal/qualitative/sentiment.ts) - Implementation
- [ADR-0019](./0019-tool-agent-boundary-temporal.md) - Tool/agent boundary decisions
