import React from 'react';
import { Box, Text, useInput } from 'ink';

export interface TopRecommendationData {
  id: string;
  title: string;
  becauseClause: string;
  recurrenceCount?: number;
  priority: 'high' | 'medium' | 'low';
  /** 1-line preview of what change will be made */
  actionPreview?: string;
  /** Where the change will be applied */
  target?: string;
  /** Expected impact if available */
  expectedImpact?: string;
}

export interface TopRecommendationProps {
  recommendation: TopRecommendationData;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
  onDetails: (id: string) => void;
  disabled?: boolean;
}

function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high':
      return 'red';
    case 'medium':
      return 'yellow';
    case 'low':
      return 'green';
  }
}

export function TopRecommendation({
  recommendation,
  onApply,
  onDismiss,
  onDetails,
  disabled = false,
}: TopRecommendationProps): React.ReactElement {
  useInput(
    (input, key) => {
      if (key.return) {
        onApply(recommendation.id);
      } else if (input === 'd' || input === 'D') {
        onDismiss(recommendation.id);
      } else if (input === '?') {
        onDetails(recommendation.id);
      }
    },
    { isActive: !disabled }
  );

  const priorityColor = getPriorityColor(recommendation.priority);

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={3} paddingY={2}>
      <Box marginBottom={1}>
        <Text bold color="cyan" dimColor>
          TOP RECOMMENDATION{' '}
        </Text>
        <Text color={priorityColor} bold>
          [{recommendation.priority.toUpperCase()}]
        </Text>
        {recommendation.recurrenceCount && recommendation.recurrenceCount > 1 && (
          <Text dimColor>
            {' '}
            {'\u2022'} Pattern {recommendation.recurrenceCount}x
          </Text>
        )}
      </Box>

      <Box marginY={1}>
        <Text bold color="white" wrap="wrap">
          {recommendation.title}
        </Text>
      </Box>

      <Box marginY={1} flexDirection="column">
        <Text color="cyan" wrap="wrap">
          {recommendation.becauseClause}
        </Text>
      </Box>

      {(recommendation.actionPreview || recommendation.target || recommendation.expectedImpact) && (
        <Box
          marginY={1}
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          {recommendation.actionPreview && (
            <Box>
              <Text dimColor>Change: </Text>
              <Text color="white">{recommendation.actionPreview}</Text>
            </Box>
          )}
          {recommendation.target && (
            <Box>
              <Text dimColor>Target: </Text>
              <Text color="yellow">{recommendation.target}</Text>
            </Box>
          )}
          {recommendation.expectedImpact && (
            <Box>
              <Text dimColor>Impact: </Text>
              <Text color="green">{recommendation.expectedImpact}</Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          [Enter] Apply {'\u2022'} [d] Dismiss {'\u2022'} [?] Details
        </Text>
      </Box>
    </Box>
  );
}

export default TopRecommendation;
