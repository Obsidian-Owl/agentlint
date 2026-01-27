import React from 'react';
import { Box, Text } from 'ink';

export interface ProgressStatsData {
  period: string;
  recommendationsApplied: number;
  helpfulCount: number;
  totalFeedback: number;
  improvementPercent?: number;
  improvementMetric?: string;
  mostEffective?: {
    title: string;
    preventedIssues: number;
  };
}

export interface ProgressStatsProps {
  stats: ProgressStatsData;
  minimumFeedbackRequired?: number;
}

export function ProgressStats({
  stats,
  minimumFeedbackRequired = 5,
}: ProgressStatsProps): React.ReactElement | null {
  if (stats.totalFeedback < minimumFeedbackRequired) {
    return null;
  }

  const helpfulPercent =
    stats.totalFeedback > 0 ? Math.round((stats.helpfulCount / stats.totalFeedback) * 100) : 0;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={2} paddingY={1}>
      <Text bold color="green">
        Your progress ({stats.period}):
      </Text>

      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text dimColor>{'\u2022'} </Text>
          <Text color="cyan">{stats.recommendationsApplied}</Text>
          <Text dimColor> recommendations applied</Text>
        </Box>

        <Box>
          <Text dimColor>{'\u2022'} </Text>
          <Text color="cyan">{stats.helpfulCount}</Text>
          <Text dimColor> marked as helpful </Text>
          <Text color={helpfulPercent >= 70 ? 'green' : helpfulPercent >= 50 ? 'yellow' : 'red'}>
            ({helpfulPercent}%)
          </Text>
        </Box>

        {stats.improvementPercent !== undefined && stats.improvementMetric && (
          <Box>
            <Text dimColor>{'\u2022'} </Text>
            <Text color="green">{stats.improvementMetric}</Text>
            <Text dimColor> down </Text>
            <Text color="green">{stats.improvementPercent}%</Text>
            <Text dimColor> since baseline</Text>
          </Box>
        )}
      </Box>

      {stats.mostEffective && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Most effective: </Text>
          <Text color="cyan">&quot;{stats.mostEffective.title}&quot;</Text>
          <Text dimColor>
            (prevented {stats.mostEffective.preventedIssues} issues in subsequent sessions)
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default ProgressStats;
