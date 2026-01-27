import React from 'react';
import { Box, Text, useInput } from 'ink';

export interface TopRecommendationData {
  id: string;
  title: string;
  becauseClause: string;
  recurrenceCount?: number;
  priority: 'high' | 'medium' | 'low';
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
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Box>
        <Text dimColor>Top recommendation: </Text>
        <Text color={priorityColor} bold>
          [{recommendation.priority.toUpperCase()}]
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text bold color="white">
          &quot;{recommendation.title}&quot;
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Because: </Text>
        <Text color="cyan">{recommendation.becauseClause}</Text>
        {recommendation.recurrenceCount && recommendation.recurrenceCount > 1 && (
          <Text dimColor>(Pattern detected {recommendation.recurrenceCount} times)</Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          [Enter] Apply {'\u2022'} [d] Dismiss {'\u2022'} [?] Details
        </Text>
      </Box>
    </Box>
  );
}

export default TopRecommendation;
