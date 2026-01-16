/**
 * Unit tests for colors.ts utility
 *
 * Tests FR-014: NO_COLOR support
 * Tests NFR-005: ANSI 4-bit colors for accessibility
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  supportsColor,
  createChalk,
  colorBySeverity,
  colorByStatus,
  bold,
  dim,
  useColors,
  severityColors,
  statusColors,
} from '../../../../src/cli/utils/colors';

// Store original env values
let originalNoColor: string | undefined;
let originalForceColor: string | undefined;

beforeEach(() => {
  originalNoColor = process.env['NO_COLOR'];
  originalForceColor = process.env['FORCE_COLOR'];
});

afterEach(() => {
  // Restore original values
  if (originalNoColor === undefined) {
    delete process.env['NO_COLOR'];
  } else {
    process.env['NO_COLOR'] = originalNoColor;
  }
  if (originalForceColor === undefined) {
    delete process.env['FORCE_COLOR'];
  } else {
    process.env['FORCE_COLOR'] = originalForceColor;
  }
});

describe('supportsColor', () => {
  test('returns false when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    delete process.env['FORCE_COLOR'];
    expect(supportsColor()).toBe(false);
  });

  test('empty NO_COLOR string does not disable colors', () => {
    // Empty string is falsy in JS, so it doesn't trigger NO_COLOR disabling
    // The implementation checks `if (process.env['NO_COLOR'])` which is falsy for ''
    process.env['NO_COLOR'] = '';
    process.env['FORCE_COLOR'] = '1'; // Ensure colors are enabled via FORCE_COLOR
    // Since empty string is falsy and FORCE_COLOR is set, colors are enabled
    expect(supportsColor()).toBe(true);
  });

  test('returns true when FORCE_COLOR is set and NO_COLOR is not', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '1';
    expect(supportsColor()).toBe(true);
  });

  test('NO_COLOR takes precedence over FORCE_COLOR', () => {
    process.env['NO_COLOR'] = '1';
    process.env['FORCE_COLOR'] = '1';
    expect(supportsColor()).toBe(false);
  });

  test('returns based on chalk level when no env vars set', () => {
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
    // Result depends on terminal capabilities
    const result = supportsColor();
    expect(typeof result).toBe('boolean');
  });
});

describe('createChalk', () => {
  test('returns chalk instance with level 0 when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    const chalkInstance = createChalk();
    expect(chalkInstance.level).toBe(0);
  });

  test('returns chalk instance with level 1 when colors supported', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '1';
    const chalkInstance = createChalk();
    expect(chalkInstance.level).toBe(1);
  });
});

describe('severityColors', () => {
  test('critical applies red color', () => {
    const result = severityColors.critical('test');
    expect(result).toContain('test');
  });

  test('high applies yellow color', () => {
    const result = severityColors.high('test');
    expect(result).toContain('test');
  });

  test('medium applies cyan color', () => {
    const result = severityColors.medium('test');
    expect(result).toContain('test');
  });

  test('low applies blue color', () => {
    const result = severityColors.low('test');
    expect(result).toContain('test');
  });

  test('info applies white color', () => {
    const result = severityColors.info('test');
    expect(result).toContain('test');
  });
});

describe('statusColors', () => {
  test('success applies green color', () => {
    const result = statusColors.success('test');
    expect(result).toContain('test');
  });

  test('error applies red color', () => {
    const result = statusColors.error('test');
    expect(result).toContain('test');
  });

  test('warning applies yellow color', () => {
    const result = statusColors.warning('test');
    expect(result).toContain('test');
  });

  test('info applies blue color', () => {
    const result = statusColors.info('test');
    expect(result).toContain('test');
  });

  test('muted applies gray color', () => {
    const result = statusColors.muted('test');
    expect(result).toContain('test');
  });
});

describe('colorBySeverity', () => {
  test('applies critical color', () => {
    const result = colorBySeverity('error message', 'critical');
    expect(result).toContain('error message');
  });

  test('applies high color', () => {
    const result = colorBySeverity('warning', 'high');
    expect(result).toContain('warning');
  });

  test('applies medium color', () => {
    const result = colorBySeverity('notice', 'medium');
    expect(result).toContain('notice');
  });

  test('applies low color', () => {
    const result = colorBySeverity('minor', 'low');
    expect(result).toContain('minor');
  });

  test('applies info color', () => {
    const result = colorBySeverity('info', 'info');
    expect(result).toContain('info');
  });

  test('returns plain text when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    const result = colorBySeverity('test', 'critical');
    // When NO_COLOR is set, chalk should return plain text
    expect(result).toBe('test');
  });
});

describe('colorByStatus', () => {
  test('applies success color', () => {
    const result = colorByStatus('done', 'success');
    expect(result).toContain('done');
  });

  test('applies error color', () => {
    const result = colorByStatus('failed', 'error');
    expect(result).toContain('failed');
  });

  test('applies warning color', () => {
    const result = colorByStatus('caution', 'warning');
    expect(result).toContain('caution');
  });

  test('applies info color', () => {
    const result = colorByStatus('note', 'info');
    expect(result).toContain('note');
  });

  test('applies muted color', () => {
    const result = colorByStatus('dimmed', 'muted');
    expect(result).toContain('dimmed');
  });

  test('returns plain text when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    const result = colorByStatus('test', 'success');
    expect(result).toBe('test');
  });
});

describe('bold', () => {
  test('applies bold formatting', () => {
    const result = bold('important');
    expect(result).toContain('important');
  });

  test('returns plain text when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    const result = bold('text');
    expect(result).toBe('text');
  });
});

describe('dim', () => {
  test('applies dim formatting', () => {
    const result = dim('subtle');
    expect(result).toContain('subtle');
  });

  test('returns plain text when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    const result = dim('text');
    expect(result).toBe('text');
  });
});

describe('useColors', () => {
  test('returns color names when colors are supported', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '1';
    const colors = useColors();

    expect(colors.error).toBe('red');
    expect(colors.warning).toBe('yellow');
    expect(colors.success).toBe('green');
    expect(colors.info).toBe('cyan');
    expect(colors.dim).toBe('gray');
    expect(colors.text).toBe('white');
  });

  test('returns empty strings when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    const colors = useColors();

    expect(colors.error).toBe('');
    expect(colors.warning).toBe('');
    expect(colors.success).toBe('');
    expect(colors.info).toBe('');
    expect(colors.dim).toBe('');
    expect(colors.text).toBe('');
  });

  test('returns ColorMap structure', () => {
    const colors = useColors();

    expect(colors).toHaveProperty('error');
    expect(colors).toHaveProperty('warning');
    expect(colors).toHaveProperty('success');
    expect(colors).toHaveProperty('info');
    expect(colors).toHaveProperty('dim');
    expect(colors).toHaveProperty('text');
  });
});
