import React from 'react';
import { Box, Text } from 'ink';
import type { LoadingStep } from '../types';

export interface LoadingProgressProps {
  steps: LoadingStep[];
  title?: string;
}

const STATUS_ICONS: Record<LoadingStep['status'], string> = {
  pending: '○',
  loading: '◐',
  complete: '●',
  error: '✗',
  skipped: '◌',
};

const STATUS_COLORS: Record<LoadingStep['status'], string> = {
  pending: 'gray',
  loading: 'yellow',
  complete: 'green',
  error: 'red',
  skipped: 'gray',
};

export function LoadingProgress({ steps, title }: LoadingProgressProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      {title && (
        <Text bold color="cyan" dimColor>
          {title}
        </Text>
      )}
      <Box flexDirection="column" marginTop={title ? 1 : 0}>
        {steps.map((step) => (
          <Box key={step.id} gap={1}>
            <Text color={STATUS_COLORS[step.status]}>{STATUS_ICONS[step.status]}</Text>
            <Text color={step.status === 'loading' ? 'white' : 'gray'}>{step.label}</Text>
            {step.detail && <Text dimColor> - {step.detail}</Text>}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default LoadingProgress;
