import React from 'react';
import { Box, Text, useInput } from 'ink';

export interface FeedbackPromptProps {
  recommendationTitle: string;
  recommendationId: string;
  onHelpful: (id: string) => void;
  onNotHelpful: (id: string) => void;
  onSkip: (id: string) => void;
  disabled?: boolean;
}

export function FeedbackPrompt({
  recommendationTitle,
  recommendationId,
  onHelpful,
  onNotHelpful,
  onSkip,
  disabled = false,
}: FeedbackPromptProps): React.ReactElement {
  useInput(
    (input) => {
      if (input === 'y' || input === 'Y') {
        onHelpful(recommendationId);
      } else if (input === 'n' || input === 'N') {
        onNotHelpful(recommendationId);
      } else if (input === 's' || input === 'S') {
        onSkip(recommendationId);
      }
    },
    { isActive: !disabled }
  );

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
      <Text bold color="yellow">
        Was this recommendation helpful?
      </Text>

      <Box marginTop={1}>
        <Text dimColor>&quot;{recommendationTitle}&quot;</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="green">[y] Helpful</Text>
        <Text dimColor> {'\u2022'} </Text>
        <Text color="red">[n] Not helpful</Text>
        <Text dimColor> {'\u2022'} </Text>
        <Text dimColor>[s] Skip</Text>
      </Box>
    </Box>
  );
}

export default FeedbackPrompt;
