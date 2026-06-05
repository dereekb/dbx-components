/**
 * `dbx-components-cli list ...` — inventory the model artifacts an app exposes.
 *
 * Thin yargs wrappers over the pure app-introspection extractors in
 * `@dereekb/dbx-cli/validate` (the same logic the `dbx_*_list_app` MCP tools
 * call). Every command takes `--json` for CI consumption and defaults to the
 * markdown rendering for terminal use.
 */

import { modelApiListApp, modelListComponent, serverActionsListApp } from '@dereekb/dbx-cli/validate';
import { type ArgumentsCamelCase, type Argv, type CommandModule } from 'yargs';
import { resolvePath, runCommand } from '../lib/run.js';

interface ListApiArgs {
  readonly componentDir: string;
  readonly model?: string;
  readonly json: boolean;
}

const listApiCommand: CommandModule<object, ListApiArgs> = {
  command: 'api <componentDir>',
  describe: 'List the CRUD / standalone callModel entries declared in a -firebase component.',
  builder: (yargs: Argv): Argv<ListApiArgs> => yargs.positional('componentDir', { type: 'string', demandOption: true, describe: 'Relative path to the `-firebase` component package (e.g. components/demo-firebase).' }).option('model', { type: 'string', describe: 'Restrict the output to a single model name.' }).option('json', { type: 'boolean', default: false, describe: 'Emit JSON instead of markdown.' }) as Argv<ListApiArgs>,
  handler: (args: ArgumentsCamelCase<ListApiArgs>): Promise<void> =>
    runCommand(async () => {
      const component = resolvePath(args.componentDir);
      const report = await modelApiListApp.listAppModelApi(component.abs, { componentDir: component.rel, modelFilter: args.model });
      return args.json ? modelApiListApp.formatReportAsJson(report) : modelApiListApp.formatReportAsMarkdown(report);
    })
};

interface ListModelsArgs {
  readonly componentDir: string;
  readonly api?: string;
  readonly json: boolean;
}

const listModelsCommand: CommandModule<object, ListModelsArgs> = {
  command: 'models <componentDir>',
  describe: "List the Firestore models declared under a -firebase component's src/lib/model.",
  builder: (yargs: Argv): Argv<ListModelsArgs> => yargs.positional('componentDir', { type: 'string', demandOption: true, describe: 'Relative path to the `-firebase` component package (e.g. components/demo-firebase).' }).option('api', { type: 'string', describe: 'Relative path to the API app, to cross-reference fixture coverage.' }).option('json', { type: 'boolean', default: false, describe: 'Emit JSON instead of markdown.' }) as Argv<ListModelsArgs>,
  handler: (args: ArgumentsCamelCase<ListModelsArgs>): Promise<void> =>
    runCommand(async () => {
      const component = resolvePath(args.componentDir);
      const api = args.api === undefined ? undefined : resolvePath(args.api);
      const report = await modelListComponent.listComponentModels(component.abs, { componentDir: component.rel, apiDir: api?.rel, apiAbs: api?.abs });
      return args.json ? modelListComponent.formatReportAsJson(report) : modelListComponent.formatReportAsMarkdown(report);
    })
};

interface ListActionsArgs {
  readonly apiDir: string;
  readonly json: boolean;
}

const listActionsCommand: CommandModule<object, ListActionsArgs> = {
  command: 'actions <apiDir>',
  describe: 'List the *ServerActions classes an API app exposes and how they are wired.',
  builder: (yargs: Argv): Argv<ListActionsArgs> => yargs.positional('apiDir', { type: 'string', demandOption: true, describe: 'Relative path to the API app (e.g. apps/demo-api).' }).option('json', { type: 'boolean', default: false, describe: 'Emit JSON instead of markdown.' }) as Argv<ListActionsArgs>,
  handler: (args: ArgumentsCamelCase<ListActionsArgs>): Promise<void> =>
    runCommand(async () => {
      const api = resolvePath(args.apiDir);
      const report = await serverActionsListApp.listAppServerActions(api.abs, { apiDir: api.rel });
      return args.json ? serverActionsListApp.formatReportAsJson(report) : serverActionsListApp.formatReportAsMarkdown(report);
    })
};

/**
 * The `list` command group.
 */
export const LIST_COMMAND: CommandModule = {
  command: 'list <command>',
  describe: 'Inventory app model artifacts (api / models / actions).',
  builder: (yargs: Argv): Argv => yargs.command(listApiCommand).command(listModelsCommand).command(listActionsCommand).demandCommand(1, 'Specify a list subcommand.'),
  handler: () => undefined
};
