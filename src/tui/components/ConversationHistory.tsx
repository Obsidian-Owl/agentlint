import React from 'react';
import { Box, Text } from 'ink';
import type { ConversationMessage } from '../types';

export interface ConversationHistoryProps {
  messages: ConversationMessage[];
  maxDisplay?: number;
}

export function ConversationHistory({
  messages,
  maxDisplay = 6,
}: ConversationHistoryProps): React.ReactElement | null {
  if (messages.length === 0) {
    return null;
  }

  const displayMessages = messages.slice(-maxDisplay);

  return (
    <Box flexDirection="column" marginBottom={1}>
      {displayMessages.map((msg, idx) => (
        <Box
          key={`${msg.timestamp}-${idx}`}
          marginBottom={idx < displayMessages.length - 1 ? 1 : 0}
        >
          <Box marginRight={1}>
            <Text color={msg.role === 'user' ? 'cyan' : 'green'} bold>
              {msg.role === 'user' ? '>' : '◆'}
            </Text>
          </Box>
          <Box flexDirection="column" flexShrink={1}>
            <Text wrap="wrap">{msg.content}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default ConversationHistory;
