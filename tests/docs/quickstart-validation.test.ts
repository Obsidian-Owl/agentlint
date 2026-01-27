/**
 * Quickstart Documentation Validation Tests
 *
 * Validates that the API examples in quickstart.md match the actual implementation.
 * This ensures documentation stays in sync with code.
 *
 * Per T075: Validate quickstart.md examples work end-to-end
 *
 * @module tests/docs/quickstart-validation
 */

import { describe, test, expect } from 'bun:test';

// Import tools to verify API signatures match documentation
import {
  storeBaselineTool,
  queryBaselineTool,
  listBaselinesTool,
  calculateDeltaTool,
  queryTrendsTool,
  conductReviewTool,
  getReviewHistoryTool,
  TEMPORAL_TOOLS,
} from '../../src/tools';

// Import config and qualitative modules
import { DEFAULT_THRESHOLD_CONFIG } from '../../src/temporal/config';
import { REVIEW_DIMENSIONS } from '../../src/temporal/qualitative/dimensions';
import { isValidSentiment } from '../../src/temporal/qualitative/sentiment';
import { getBaselinesDir, getBaselinesDbPath } from '../../src/persistence/common';

// =============================================================================
// Tool Registration Validation
// =============================================================================

describe('Quickstart: Tool Registration', () => {
  test('all 7 temporal tools are exported', () => {
    // Quickstart documents 7 tools
    expect(TEMPORAL_TOOLS.length).toBe(7);
  });

  test('all documented tool names are correct', () => {
    const toolNames = TEMPORAL_TOOLS.map((t) => t.name);

    // Matches quickstart.md Tool Reference section
    expect(toolNames).toContain('store_baseline');
    expect(toolNames).toContain('query_baseline');
    expect(toolNames).toContain('list_baselines');
    expect(toolNames).toContain('calculate_delta');
    expect(toolNames).toContain('query_trends');
    expect(toolNames).toContain('conduct_review');
    expect(toolNames).toContain('get_review_history');
  });

  test('tools have descriptions for help output', () => {
    for (const tool of TEMPORAL_TOOLS) {
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  test('all tools have input schemas', () => {
    // Tools use Claude Agent SDK tool() which provides inputSchema
    for (const tool of TEMPORAL_TOOLS) {
      expect(tool.inputSchema).toBeDefined();
      // SDK tools have inputSchema as the raw Zod shape, not JSON Schema
    }
  });
});

// =============================================================================
// Tool Definition Validation (verify tools exist and have required properties)
// =============================================================================

describe('Quickstart: store_baseline', () => {
  test('tool exists with correct name', () => {
    expect(storeBaselineTool.name).toBe('store_baseline');
  });

  test('tool has inputSchema defined', () => {
    expect(storeBaselineTool.inputSchema).toBeDefined();
  });

  test('tool accepts documented parameters', () => {
    // From quickstart.md: store_baseline accepts label (optional)
    // SDK tools have inputSchema as the raw Zod shape object
    const schema = storeBaselineTool.inputSchema;
    expect(schema).toBeDefined();
    expect(schema.label).toBeDefined(); // label is documented as optional parameter
  });
});

describe('Quickstart: query_baseline', () => {
  test('tool exists with correct name', () => {
    expect(queryBaselineTool.name).toBe('query_baseline');
  });

  test('tool has inputSchema defined', () => {
    expect(queryBaselineTool.inputSchema).toBeDefined();
  });
});

describe('Quickstart: list_baselines', () => {
  test('tool exists with correct name', () => {
    expect(listBaselinesTool.name).toBe('list_baselines');
  });

  test('tool has inputSchema defined', () => {
    expect(listBaselinesTool.inputSchema).toBeDefined();
  });
});

describe('Quickstart: calculate_delta', () => {
  test('tool exists with correct name', () => {
    expect(calculateDeltaTool.name).toBe('calculate_delta');
  });

  test('tool has inputSchema defined', () => {
    expect(calculateDeltaTool.inputSchema).toBeDefined();
  });

  test('tool accepts documented parameters', () => {
    // From quickstart.md: calculate_delta accepts fromId, toId, includeGitCommits, detailedDiff
    // SDK tools have inputSchema as the raw Zod shape object
    const schema = calculateDeltaTool.inputSchema;
    expect(schema).toBeDefined();
    expect(schema.fromId).toBeDefined();
    expect(schema.toId).toBeDefined();
  });
});

describe('Quickstart: query_trends', () => {
  test('tool exists with correct name', () => {
    expect(queryTrendsTool.name).toBe('query_trends');
  });

  test('tool has inputSchema defined', () => {
    expect(queryTrendsTool.inputSchema).toBeDefined();
  });
});

describe('Quickstart: conduct_review', () => {
  test('tool exists with correct name', () => {
    expect(conductReviewTool.name).toBe('conduct_review');
  });

  test('tool has inputSchema defined', () => {
    expect(conductReviewTool.inputSchema).toBeDefined();
  });

  test('tool accepts documented parameters', () => {
    // From quickstart.md: conduct_review accepts dimensions array with scores
    // SDK tools have inputSchema as the raw Zod shape object
    const schema = conductReviewTool.inputSchema;
    expect(schema).toBeDefined();
    expect(schema.dimensions).toBeDefined();
  });
});

describe('Quickstart: get_review_history', () => {
  test('tool exists with correct name', () => {
    expect(getReviewHistoryTool.name).toBe('get_review_history');
  });

  test('tool has inputSchema defined', () => {
    expect(getReviewHistoryTool.inputSchema).toBeDefined();
  });
});

// =============================================================================
// Configuration Validation
// =============================================================================

describe('Quickstart: Configuration', () => {
  test('default threshold is documented correctly', () => {
    // From quickstart.md:
    // "default": 0.05 (5% change = significant)

    expect(DEFAULT_THRESHOLD_CONFIG.default).toBe(0.05);
  });

  test('review dimensions match documentation', () => {
    // From quickstart.md: 6 dimensions listed
    // 1. Perceived Friction
    // 2. Trust Calibration
    // 3. Task Fit
    // 4. Configuration Confidence
    // 5. Improvement Attribution
    // 6. Workflow Satisfaction

    expect(REVIEW_DIMENSIONS.length).toBe(6);

    const dimensionNames = REVIEW_DIMENSIONS.map((d) => d.name);
    expect(dimensionNames).toContain('perceivedFriction');
    expect(dimensionNames).toContain('trustCalibration');
    expect(dimensionNames).toContain('taskFit');
    expect(dimensionNames).toContain('configurationConfidence');
    expect(dimensionNames).toContain('improvementAttribution');
    expect(dimensionNames).toContain('workflowSatisfaction');
  });

  test('Likert scale is documented correctly', () => {
    // From quickstart.md:
    // -2: Very negative
    // -1: Negative
    //  0: Neutral
    // +1: Positive
    // +2: Very positive

    // All documented values should be valid
    expect(isValidSentiment(-2)).toBe(true);
    expect(isValidSentiment(-1)).toBe(true);
    expect(isValidSentiment(0)).toBe(true);
    expect(isValidSentiment(1)).toBe(true);
    expect(isValidSentiment(2)).toBe(true);

    // Values outside range should be invalid
    expect(isValidSentiment(-3)).toBe(false);
    expect(isValidSentiment(3)).toBe(false);
    expect(isValidSentiment(0.5)).toBe(false);
  });
});

// =============================================================================
// Storage Location Validation
// =============================================================================

describe('Quickstart: Storage Locations', () => {
  test('storage path functions exist', () => {
    // From quickstart.md:
    // | Baselines | .agentlint/baselines/*.json |
    // | Baseline index | .agentlint/baselines.db |

    // Functions exist and return strings
    expect(typeof getBaselinesDir).toBe('function');
    expect(typeof getBaselinesDbPath).toBe('function');
  });

  test('baselines directory path matches documentation', () => {
    const baselinesDir = getBaselinesDir();

    // Path should contain .agentlint/baselines as documented
    expect(baselinesDir).toContain('.agentlint');
    expect(baselinesDir).toContain('baselines');
    expect(baselinesDir).not.toContain('.db'); // Directory, not DB file
  });

  test('baselines database path matches documentation', () => {
    const dbPath = getBaselinesDbPath();

    // Path should be .agentlint/baselines.db as documented
    expect(dbPath).toContain('.agentlint');
    expect(dbPath).toContain('baselines.db');
  });
});
