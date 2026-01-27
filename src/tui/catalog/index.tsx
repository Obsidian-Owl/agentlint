#!/usr/bin/env bun
import React, { useState, useCallback } from 'react';
import { render, Box, Text, useInput } from 'ink';

import { AgentStateIndicator } from '../components/AgentStateIndicator';
import { StatusBar } from '../components/StatusBar';
import { ActionMenu } from '../components/ActionMenu';
import { QuitDialog } from '../components/QuitDialog';
import { LoadingProgress } from '../components/LoadingProgress';
import { ToolPhaseRenderer } from '../components/ToolPhaseRenderer';
import { Progress } from '../components/Progress';
import { SessionSummary } from '../components/SessionSummary';
import { TopRecommendation } from '../components/TopRecommendation';
import { FeedbackPrompt } from '../components/FeedbackPrompt';
import { ProgressStats } from '../components/ProgressStats';

import {
  sampleAgentStates,
  sampleToolChunks,
  sampleStatusBar,
  sampleMenuOptions,
  sampleLoadingSteps,
  sampleLastSession,
  sampleTopRecommendation,
  sampleProgressStats,
} from './samples';

interface CatalogItem {
  name: string;
  render: () => React.ReactElement;
}

const catalogItems: CatalogItem[] = [
  {
    name: 'AgentStateIndicator - idle',
    render: () => <AgentStateIndicator state={sampleAgentStates[0]!} />,
  },
  {
    name: 'AgentStateIndicator - thinking',
    render: () => <AgentStateIndicator state={sampleAgentStates[1]!} />,
  },
  {
    name: 'AgentStateIndicator - calling_tool',
    render: () => <AgentStateIndicator state={sampleAgentStates[2]!} />,
  },
  {
    name: 'AgentStateIndicator - waiting_response',
    render: () => <AgentStateIndicator state={sampleAgentStates[3]!} />,
  },
  {
    name: 'AgentStateIndicator - streaming',
    render: () => <AgentStateIndicator state={sampleAgentStates[4]!} />,
  },
  {
    name: 'AgentStateIndicator - complete',
    render: () => <AgentStateIndicator state={sampleAgentStates[5]!} />,
  },
  {
    name: 'AgentStateIndicator - error',
    render: () => <AgentStateIndicator state={sampleAgentStates[6]!} />,
  },
  {
    name: 'StatusBar',
    render: () => <StatusBar context={sampleStatusBar} />,
  },
  {
    name: 'ActionMenu',
    render: () => (
      <ActionMenu
        title="Sample Menu"
        subtitle="Choose an option"
        options={sampleMenuOptions}
        onSelect={() => {}}
        disabled
      />
    ),
  },
  {
    name: 'QuitDialog',
    render: () => <QuitDialog onConfirm={() => {}} onCancel={() => {}} />,
  },
  {
    name: 'LoadingProgress',
    render: () => <LoadingProgress steps={sampleLoadingSteps} />,
  },
  {
    name: 'ToolPhaseRenderer - preparing',
    render: () => <ToolPhaseRenderer chunk={sampleToolChunks[0]!} phase="preparing" />,
  },
  {
    name: 'ToolPhaseRenderer - running',
    render: () => <ToolPhaseRenderer chunk={sampleToolChunks[0]!} phase="running" />,
  },
  {
    name: 'ToolPhaseRenderer - complete',
    render: () => <ToolPhaseRenderer chunk={sampleToolChunks[1]!} phase="complete" />,
  },
  {
    name: 'Progress - scanning',
    render: () => <Progress phase="scanning" percent={45} elapsedMs={12000} isActive={true} />,
  },
  {
    name: 'Progress - complete',
    render: () => <Progress phase="complete" percent={100} elapsedMs={45000} isActive={false} />,
  },
  {
    name: 'SessionSummary',
    render: () => (
      <SessionSummary
        lastSession={sampleLastSession}
        gitSummary={null}
        openRecommendations={3}
        commitsSinceLastSession={12}
        filesChangedSinceLastSession={8}
      />
    ),
  },
  {
    name: 'TopRecommendation',
    render: () => (
      <TopRecommendation
        recommendation={sampleTopRecommendation}
        onApply={() => {}}
        onDismiss={() => {}}
        onDetails={() => {}}
        disabled
      />
    ),
  },
  {
    name: 'FeedbackPrompt',
    render: () => (
      <FeedbackPrompt
        recommendationTitle="Add error handling patterns"
        recommendationId="rec-001"
        onHelpful={() => {}}
        onNotHelpful={() => {}}
        onSkip={() => {}}
        disabled
      />
    ),
  },
  {
    name: 'ProgressStats',
    render: () => <ProgressStats stats={sampleProgressStats} />,
  },
];

function Catalog(): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleUp = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : catalogItems.length - 1));
  }, []);

  const handleDown = useCallback(() => {
    setSelectedIndex((prev) => (prev < catalogItems.length - 1 ? prev + 1 : 0));
  }, []);

  useInput((input, key) => {
    if (input === 'q') {
      process.exit(0);
    }
    if (key.upArrow || input === 'k') {
      handleUp();
    }
    if (key.downArrow || input === 'j') {
      handleDown();
    }
  });

  const selected = catalogItems[selectedIndex]!;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          TUI Component Catalog
        </Text>
        <Text dimColor> ({catalogItems.length} components)</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Navigate: j/k or arrows | Quit: q</Text>
      </Box>

      <Box flexDirection="row" height={20}>
        <Box flexDirection="column" width={40} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text bold dimColor>
            Components
          </Text>
          <Box marginTop={1} flexDirection="column">
            {catalogItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <Text key={item.name} color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                  {isSelected ? '\u25B6 ' : '  '}
                  {item.name}
                </Text>
              );
            })}
          </Box>
        </Box>

        <Box
          flexDirection="column"
          flexGrow={1}
          borderStyle="single"
          borderColor="cyan"
          paddingX={2}
          paddingY={1}
          marginLeft={1}
        >
          <Text bold color="cyan">
            {selected.name}
          </Text>
          <Box marginTop={1}>{selected.render()}</Box>
        </Box>
      </Box>
    </Box>
  );
}

render(<Catalog />);
