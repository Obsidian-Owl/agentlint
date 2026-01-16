/**
 * T017: Unit tests for --help output
 *
 * Tests FR-002: Help text for all commands
 */

import { describe, test, expect } from 'bun:test';
import { createProgram } from '../../../src/cli/program';

describe('CLI Help', () => {
  describe('createProgram help configuration', () => {
    test('program has correct name', () => {
      const program = createProgram();
      expect(program.name()).toBe('agentlint');
    });

    test('program has description', () => {
      const program = createProgram();
      expect(program.description()).toContain('AI-assisted development');
    });

    test('program has version option', () => {
      const program = createProgram();
      const versionOption = program.options.find(
        (opt) => opt.short === '-v' || opt.long === '--version'
      );
      expect(versionOption).toBeDefined();
    });
  });

  describe('global options', () => {
    test('--json option is registered', () => {
      const program = createProgram();
      const option = program.options.find((opt) => opt.long === '--json');
      expect(option).toBeDefined();
      expect(option?.description).toContain('JSON');
    });

    test('--markdown option is registered', () => {
      const program = createProgram();
      const option = program.options.find((opt) => opt.long === '--markdown');
      expect(option).toBeDefined();
      expect(option?.description).toContain('Markdown');
    });

    test('--plain option is registered', () => {
      const program = createProgram();
      const option = program.options.find((opt) => opt.long === '--plain');
      expect(option).toBeDefined();
      expect(option?.description?.toLowerCase()).toContain('plain');
    });

    test('--verbose option is registered', () => {
      const program = createProgram();
      const option = program.options.find((opt) => opt.long === '--verbose');
      expect(option).toBeDefined();
      expect(option?.description).toContain('detailed');
    });

    test('--fail-on-findings option is registered', () => {
      const program = createProgram();
      const option = program.options.find((opt) => opt.long === '--fail-on-findings');
      expect(option).toBeDefined();
      expect(option?.description).toContain('findings');
    });
  });

  describe('commands', () => {
    test('scan command is registered', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'scan');
      expect(command).toBeDefined();
      expect(command?.description()).toContain('Discover');
    });

    test('analyse command is registered', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'analyse');
      expect(command).toBeDefined();
      expect(command?.description()).toContain('analysis');
    });

    test('analyse has analyze alias', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'analyse');
      expect(command?.aliases()).toContain('analyze');
    });

    test('baseline command is registered', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'baseline');
      expect(command).toBeDefined();
      expect(command?.description()).toContain('baseline');
    });

    test('compare command is registered', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'compare');
      expect(command).toBeDefined();
      expect(command?.description()).toContain('Compare');
    });

    test('trace command is registered', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'trace');
      expect(command).toBeDefined();
      expect(command?.description()).toContain('Trace');
    });

    test('learn command is registered', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'learn');
      expect(command).toBeDefined();
      expect(command?.description()).toContain('learnings');
    });

    test('learn has subcommands', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'learn');
      const listCmd = command?.commands.find((cmd) => cmd.name() === 'list');
      const addCmd = command?.commands.find((cmd) => cmd.name() === 'add');
      const promoteCmd = command?.commands.find((cmd) => cmd.name() === 'promote');
      expect(listCmd).toBeDefined();
      expect(addCmd).toBeDefined();
      expect(promoteCmd).toBeDefined();
    });

    test('recommend command is registered', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'recommend');
      expect(command).toBeDefined();
      expect(command?.description()).toContain('recommendations');
    });

    test('validate command is registered', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'validate');
      expect(command).toBeDefined();
      expect(command?.description()).toContain('Validate');
    });

    test('update command is registered', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'update');
      expect(command).toBeDefined();
      expect(command?.description()).toContain('Update');
    });
  });

  describe('command options', () => {
    test('scan has --directory option', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'scan');
      const option = command?.options.find((opt) => opt.long === '--directory');
      expect(option).toBeDefined();
    });

    test('analyse has --config-only option', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'analyse');
      const option = command?.options.find((opt) => opt.long === '--config-only');
      expect(option).toBeDefined();
    });

    test('analyse has --sessions-only option', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'analyse');
      const option = command?.options.find((opt) => opt.long === '--sessions-only');
      expect(option).toBeDefined();
    });

    test('baseline has --label option', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'baseline');
      const option = command?.options.find((opt) => opt.long === '--label');
      expect(option).toBeDefined();
    });

    test('compare has --baseline option', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'compare');
      const option = command?.options.find((opt) => opt.long === '--baseline');
      expect(option).toBeDefined();
    });

    test('update has --check option', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'update');
      const option = command?.options.find((opt) => opt.long === '--check');
      expect(option).toBeDefined();
    });

    test('update has --channel option', () => {
      const program = createProgram();
      const command = program.commands.find((cmd) => cmd.name() === 'update');
      const option = command?.options.find((opt) => opt.long === '--channel');
      expect(option).toBeDefined();
    });
  });

  describe('help configuration', () => {
    test('subcommands are sorted', () => {
      const program = createProgram();
      const helpConfig = program.configureHelp();
      expect(helpConfig.sortSubcommands).toBe(true);
    });

    test('options are not sorted', () => {
      const program = createProgram();
      const helpConfig = program.configureHelp();
      expect(helpConfig.sortOptions).toBe(false);
    });
  });
});
