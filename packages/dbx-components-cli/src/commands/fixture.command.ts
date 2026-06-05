/**
 * `dbx-components-cli fixture ...` — scan an API app's `src/test/fixture.ts`.
 *
 * Thin yargs wrappers over the pure fixture scanners in
 * `@dereekb/dbx-cli/model-test` (the extraction half of the
 * `dbx_model_fixture_*` MCP tools). Validation is intentionally not exposed
 * here — it depends on the rule-catalog layer that lives in
 * `dbx-components-mcp`.
 */

import { formatListAsJson, formatListAsMarkdown, formatLookupAsJson, formatLookupAsMarkdown, inspectAppFixtures } from '@dereekb/dbx-cli/model-test';
import { type ArgumentsCamelCase, type Argv, type CommandModule } from 'yargs';
import { resolvePath, runCommand } from '../lib/run.js';

interface FixtureListArgs {
  readonly apiDir: string;
  readonly json: boolean;
}

const fixtureListCommand: CommandModule<object, FixtureListArgs> = {
  command: 'list <apiDir>',
  describe: 'List every fixture triplet declared in an API app.',
  builder: (yargs: Argv): Argv<FixtureListArgs> => yargs.positional('apiDir', { type: 'string', demandOption: true, describe: 'Relative path to the API app (e.g. apps/demo-api).' }).option('json', { type: 'boolean', default: false, describe: 'Emit JSON instead of markdown.' }) as Argv<FixtureListArgs>,
  handler: (args: ArgumentsCamelCase<FixtureListArgs>): Promise<void> =>
    runCommand(async () => {
      const api = resolvePath(args.apiDir);
      const extraction = await inspectAppFixtures(api.abs, api.rel);
      return args.json ? formatListAsJson(extraction) : formatListAsMarkdown(extraction);
    })
};

interface FixtureLookupArgs {
  readonly apiDir: string;
  readonly model: string;
  readonly json: boolean;
}

const fixtureLookupCommand: CommandModule<object, FixtureLookupArgs> = {
  command: 'lookup <apiDir> <model>',
  describe: 'Show the fixture triplet, params, and forwarders for one model.',
  builder: (yargs: Argv): Argv<FixtureLookupArgs> => yargs.positional('apiDir', { type: 'string', demandOption: true, describe: 'Relative path to the API app.' }).positional('model', { type: 'string', demandOption: true, describe: 'Bare model name (e.g. Guestbook).' }).option('json', { type: 'boolean', default: false, describe: 'Emit JSON instead of markdown.' }) as Argv<FixtureLookupArgs>,
  handler: (args: ArgumentsCamelCase<FixtureLookupArgs>): Promise<void> =>
    runCommand(async () => {
      const api = resolvePath(args.apiDir);
      const extraction = await inspectAppFixtures(api.abs, api.rel);
      const wanted = args.model.toLowerCase();
      const entry = extraction.entries.find((e) => e.model.toLowerCase() === wanted);
      if (entry === undefined) {
        const available = extraction.entries.map((e) => e.model).join(', ') || '(none)';
        throw new Error(`No fixture found for model '${args.model}' in ${api.rel}. Available: ${available}`);
      }
      return args.json ? formatLookupAsJson(extraction, entry) : formatLookupAsMarkdown(extraction, entry);
    })
};

/**
 * The `fixture` command group.
 */
export const FIXTURE_COMMAND: CommandModule = {
  command: 'fixture <command>',
  describe: 'Scan an API app src/test/fixture.ts (list / lookup).',
  builder: (yargs: Argv): Argv => yargs.command(fixtureListCommand).command(fixtureLookupCommand).demandCommand(1, 'Specify a fixture subcommand.'),
  handler: () => undefined
};
