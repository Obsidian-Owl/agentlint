import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

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
  defaultExpanded?: boolean;
}

export function ProgressStats({
  stats,
  minimumFeedbackRequired = 5,
  defaultExpanded = false,
}: ProgressStatsProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useInput(
    (input) => {
      if (input === 'p' || input === 'P') {
        setExpanded(!expanded);
      }
    },
    { isActive: true }
  );

  if (stats.totalFeedback < minimumFeedbackRequired) {
    return null;
  }

  const helpfulPercent =
    stats.totalFeedback > 0 ? Math.round((stats.helpfulCount / stats.totalFeedback) * 100) : 0;

  // Compact single-line view
  if (!expanded) {
    return (
      <Box paddingX={1}>
        <Text dimColor>Progress ({stats.period}): </Text>
        <Text color="cyan">{stats.recommendationsApplied} applied</Text>
        <Text dimColor> {'\u2022'} </Text>
        <Text color={helpfulPercent >= 70 ? 'green' : helpfulPercent >= 50 ? 'yellow' : 'red'}>
          {helpfulPercent}% helpful
        </Text>
        {stats.improvementPercent !== undefined && (
          <>
            <Text dimColor> {'\u2022'} </Text>
            <Text color="green">{stats.improvementPercent}% improvement</Text>
          </>
        )}
        <Text dimColor> [p] expand</Text>
      </Box>
    );
  }

  // Expanded detailed view
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="green" paddingX={2} paddingY={1}>
      <Box>
        <Text bold color="green">
          Your progress ({stats.period})
        </Text>
        <Text dimColor> [p] collapse</Text>
      </Box>

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
