# agentlint-evals

TruLens evaluation framework for agentlint's LLM-as-judge quality assessments.

## Setup

```bash
cd tests/evals
uv sync
```

## Usage

```bash
# Check TruLens availability
uv run python trulens-runner.py --check

# Run temporal analysis evaluations
uv run python -m tests.evals.temporal.run --all

# Run recommendation evaluations
uv run python -m tests.evals.recommendations.run --all
```

## Architecture

Per ADR-0011 and ADR-0012, evaluations use:
- **TruLens** for LLM-as-judge feedback functions
- **LiteLLM** with Anthropic for evaluation (avoiding meta-circularity)
- **Golden datasets** in `golden/` for consistent evaluation scenarios
