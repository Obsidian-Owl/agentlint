import React from 'react';
import { Box, Text } from 'ink';
import type { StatusBarContext } from '../types';

export interface StatusBarProps {
  context: StatusBarContext;
}

function shortenPath(path: string, maxLength = 30): string {
  if (path.length <= maxLength) return path;
  const home = process.env['HOME'] ?? '';
  if (home && path.startsWith(home)) {
    path = '~' + path.slice(home.length);
  }
  if (path.length <= maxLength) return path;
  return '...' + path.slice(-(maxLength - 3));
}

export function StatusBar({ context }: StatusBarProps): React.ReactElement {
  const { helpHint, status, model, openRecommendations, projectPath } = context;
  const shortPath = shortenPath(projectPath);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box>
        <Text dimColor>{helpHint}</Text>
        <Text dimColor> │ </Text>
        <Text color={status === 'Loading...' ? 'yellow' : status === 'Complete' ? 'green' : 'cyan'}>
          {status}
        </Text>
        {model && (
          <>
            <Text dimColor> │ </Text>
            <Text dimColor>{model}</Text>
          </>
        )}
        {openRecommendations > 0 && (
          <>
            <Text dimColor> │ </Text>
            <Text color="cyan">{openRecommendations} recs</Text>
          </>
        )}
      </Box>
      <Box>
        <Text dimColor>{shortPath}</Text>
      </Box>
    </Box>
  );
}

export default StatusBar;
