/**
 * `dbx-components-cli spec ...` — scan an API app's `*.spec.ts` test files.
 *
 * Thin yargs wrappers over the pure scanners in `@dereekb/dbx-cli/model-test`
 * (the same logic the `dbx_model_test_*` MCP tools call). Every command takes
 * `--json` so the output is consumable by scripts/CI, and defaults to the
 * markdown rendering for terminal use.
 */

import { discoverSpecFilesByGroup, formatListAppAsJson, formatListAppAsMarkdown, formatSearchAsJson, formatSearchAsMarkdown, formatTreeAsJson, formatTreeAsMarkdown, inspectSpecFile, searchSpecTree, type SpecSearchQuery, type SpecTreeView } from '@dereekb/dbx-cli/model-test';
import { type ArgumentsCamelCase, type Argv, type CommandModule } from 'yargs';
import { resolvePath, runCommand } from '../lib/run.js';

const SEARCH_MODES = ['model', 'chain', 'describe', 'it'] as const;
const TREE_VIEWS: readonly SpecTreeView[] = ['all', 'describes', 'fixtures', 'its', 'helpers'];

interface SpecTreeArgs {
  readonly specFile: string;
  readonly api?: string;
  readonly view: SpecTreeView;
  readonly filterModel?: string;
  readonly filterDescribe?: string;
  readonly json: boolean;
}

const specTreeCommand: CommandModule<object, SpecTreeArgs> = {
  command: 'tree <specFile>',
  describe: 'Parse one .spec.ts file into its describe/it/fixture skeleton.',
  builder: (yargs: Argv): Argv<SpecTreeArgs> =>
    yargs
      .positional('specFile', { type: 'string', demandOption: true, describe: 'Relative path to the .spec.ts file.' })
      .option('api', { type: 'string', describe: 'Relative path to the API app (enables authoritative prefix + fixture-name detection).' })
      .option('view', { choices: TREE_VIEWS, default: 'all' as SpecTreeView, describe: 'View mode.' })
      .option('filterModel', { type: 'string', describe: 'Keep only subtrees containing a fixture for this model.' })
      .option('filterDescribe', { type: 'string', describe: '>-separated describe path to keep.' })
      .option('json', { type: 'boolean', default: false, describe: 'Emit JSON instead of markdown.' }) as Argv<SpecTreeArgs>,
  handler: (args: ArgumentsCamelCase<SpecTreeArgs>): Promise<void> =>
    runCommand(async () => {
      const spec = resolvePath(args.specFile);
      const api = args.api === undefined ? undefined : resolvePath(args.api);
      const tree = await inspectSpecFile({ specAbs: spec.abs, specRel: spec.rel, apiAbs: api?.abs, apiRel: api?.rel });
      const filters = { filterByModel: args.filterModel, filterByDescribePath: args.filterDescribe };
      return args.json ? formatTreeAsJson(tree, args.view, filters) : formatTreeAsMarkdown(tree, args.view, filters);
    })
};

interface SpecSearchArgs {
  readonly specFile: string;
  readonly query: string;
  readonly mode: (typeof SEARCH_MODES)[number];
  readonly api?: string;
  readonly json: boolean;
}

const specSearchCommand: CommandModule<object, SpecSearchArgs> = {
  command: 'search <specFile> <query>',
  describe: 'Search a .spec.ts tree by model, fixture chain, describe, or it title.',
  builder: (yargs: Argv): Argv<SpecSearchArgs> =>
    yargs
      .positional('specFile', { type: 'string', demandOption: true, describe: 'Relative path to the .spec.ts file.' })
      .positional('query', { type: 'string', demandOption: true, describe: 'Search value (interpretation depends on --mode).' })
      .option('mode', { choices: SEARCH_MODES, default: 'model' as (typeof SEARCH_MODES)[number], describe: 'Search mode.' })
      .option('api', { type: 'string', describe: 'Relative path to the API app.' })
      .option('json', { type: 'boolean', default: false, describe: 'Emit JSON instead of markdown.' }) as Argv<SpecSearchArgs>,
  handler: (args: ArgumentsCamelCase<SpecSearchArgs>): Promise<void> =>
    runCommand(async () => {
      const spec = resolvePath(args.specFile);
      const api = args.api === undefined ? undefined : resolvePath(args.api);
      const tree = await inspectSpecFile({ specAbs: spec.abs, specRel: spec.rel, apiAbs: api?.abs, apiRel: api?.rel });
      const query: SpecSearchQuery = { mode: args.mode, value: args.query };
      const result = searchSpecTree(tree, query);
      return args.json ? formatSearchAsJson(tree, result) : formatSearchAsMarkdown(tree, result);
    })
};

interface SpecListArgs {
  readonly apiDir: string;
  readonly json: boolean;
}

const specListCommand: CommandModule<object, SpecListArgs> = {
  command: 'list <apiDir>',
  describe: 'Inventory every model-group .spec.ts file under an API app.',
  builder: (yargs: Argv): Argv<SpecListArgs> => yargs.positional('apiDir', { type: 'string', demandOption: true, describe: 'Relative path to the API app (e.g. apps/demo-api).' }).option('json', { type: 'boolean', default: false, describe: 'Emit JSON instead of markdown.' }) as Argv<SpecListArgs>,
  handler: (args: ArgumentsCamelCase<SpecListArgs>): Promise<void> =>
    runCommand(async () => {
      const api = resolvePath(args.apiDir);
      const catalog = await discoverSpecFilesByGroup({ apiAbs: api.abs, apiRel: api.rel });
      return args.json ? formatListAppAsJson(catalog) : formatListAppAsMarkdown(catalog);
    })
};

/**
 * The `spec` command group.
 */
export const SPEC_COMMAND: CommandModule = {
  command: 'spec <command>',
  describe: 'Scan API *.spec.ts test files (tree / search / list).',
  builder: (yargs: Argv): Argv => yargs.command(specTreeCommand).command(specSearchCommand).command(specListCommand).demandCommand(1, 'Specify a spec subcommand.'),
  handler: () => undefined
};
