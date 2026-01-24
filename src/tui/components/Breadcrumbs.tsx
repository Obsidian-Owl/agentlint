/**
 * EP17 TUI Components - Breadcrumbs
 *
 * Displays navigation context as a breadcrumb trail.
 *
 * @module tui/components/Breadcrumbs
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { BreadcrumbsProps, ExplorationStep } from '../types';

// =============================================================================
// Separator
// =============================================================================

function Separator(): React.ReactElement {
  return (
    <Text color="gray" dimColor>
      {' \u203A '}
    </Text>
  );
}

// =============================================================================
// Step Renderer
// =============================================================================

interface StepProps {
  step: ExplorationStep;
  isLast: boolean;
  onNavigate?: ((stepId: string) => void) | undefined;
}

function StepRenderer({ step, isLast }: StepProps): React.ReactElement {
  return (
    <Text color={isLast ? 'cyan' : 'white'} bold={isLast} dimColor={!isLast}>
      {step.topic}
    </Text>
  );
}

// =============================================================================
// Component
// =============================================================================

/**
 * Breadcrumbs navigation component.
 *
 * Displays the current exploration path as a trail of steps.
 * Each step shows its topic, with the current (last) step highlighted.
 *
 * @example
 * ```tsx
 * <Breadcrumbs
 *   steps={state.explorationPath}
 *   onNavigate={(stepId) => goToStep(stepId)}
 * />
 * ```
 */
export function Breadcrumbs({
  steps,
  onNavigate: _onNavigate,
}: BreadcrumbsProps): React.ReactElement {
  if (steps.length === 0) {
    return <Box />;
  }

  return (
    <Box>
      <Text color="gray" dimColor>
        {'['}{' '}
      </Text>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <StepRenderer step={step} isLast={index === steps.length - 1} />
          {index < steps.length - 1 && <Separator />}
        </React.Fragment>
      ))}
      <Text color="gray" dimColor>
        {' '}
        {']'}
      </Text>
    </Box>
  );
}

// =============================================================================
// Exports
// =============================================================================

export default Breadcrumbs;
