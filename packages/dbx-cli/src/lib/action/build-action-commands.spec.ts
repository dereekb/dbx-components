import { describe, expect, it } from 'vitest';
import yargs from 'yargs';
import { buildActionCommands } from './build-action-commands';
import type { ActionCommandSpec } from './action.command.factory';

const ROOT_SPEC: ActionCommandSpec = {
  command: 'sync-all',
  describe: 'Root-level sync action.',
  handler: () => ({ ok: true })
};

const REGION_DISTRICTS_SPEC: ActionCommandSpec = {
  command: 'districts <region>',
  describe: 'List Districts in a Region.',
  model: 'region',
  handler: () => ({ ok: true })
};

const DISTRICT_JOBS_SPEC: ActionCommandSpec = {
  command: 'open-jobs <district>',
  describe: 'List open Jobs for a District.',
  model: 'district',
  handler: () => ({ ok: true })
};

function helpFor(specs: readonly ActionCommandSpec[], argv: readonly string[]): Promise<string> {
  return yargs([...argv])
    .scriptName('demo-cli')
    .command(buildActionCommands(specs))
    .exitProcess(false)
    .fail(false)
    .getHelp();
}

describe('buildActionCommands()', () => {
  it('returns an empty list when no specs are provided', () => {
    expect(buildActionCommands([])).toEqual([]);
  });

  it('returns a single `action <action>` parent command that lists each subcommand under --help', async () => {
    const commands = buildActionCommands([ROOT_SPEC, REGION_DISTRICTS_SPEC, DISTRICT_JOBS_SPEC]);

    expect(commands).toHaveLength(1);
    expect(commands[0].command).toBe('action <action>');

    const help = await helpFor([ROOT_SPEC, REGION_DISTRICTS_SPEC, DISTRICT_JOBS_SPEC], ['action', '--help']);
    expect(help).toContain('sync-all');
    expect(help).toContain('region <action>');
    expect(help).toContain('district <action>');
  });

  it('groups model-scoped actions under `action <model> <action>`', async () => {
    const help = await helpFor([REGION_DISTRICTS_SPEC, DISTRICT_JOBS_SPEC], ['action', 'region', '--help']);
    expect(help).toContain('districts <region>');
    expect(help).toContain('List Districts in a Region');
  });

  it('keeps root-level actions out of model subtrees', async () => {
    const help = await helpFor([ROOT_SPEC, REGION_DISTRICTS_SPEC], ['action', 'region', '--help']);
    expect(help).not.toContain('sync-all');
    expect(help).toContain('districts <region>');
  });

  it('honors a custom actionCommandName', () => {
    const commands = buildActionCommands([ROOT_SPEC], { actionCommandName: 'do' });
    expect(commands[0].command).toBe('do <action>');
  });
});
