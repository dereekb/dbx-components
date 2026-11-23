import type { Argv, CommandModule } from 'yargs';
import { type Maybe, toMaybeString } from '@dereekb/util';
import { DEFAULT_DOCS_SEARCH_LIMIT, MAX_DOCS_SEARCH_LIMIT } from '@dereekb/firebase';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { wrapCommandHandler } from '../util/handler';
import { cliCollectionPickApplier, outputResult } from '../util/output';
import { DEFAULT_DOCS_API_COMMAND_NAME, type DocsApiClientInput, listDocsOverHttp, readDocOverHttp, searchDocsOverHttp } from './docs-api.client';
import { renderDocsListMarkdown, renderDocsSearchMarkdown } from './docs-api.render';

/**
 * Options for {@link buildDocsApiCommand}.
 */
export interface BuildDocsApiCommandOptions {
  /**
   * The group's name. Defaults to {@link DEFAULT_DOCS_API_COMMAND_NAME}.
   */
  readonly commandName?: Maybe<string>;
  /**
   * The CLI's name, used in help text and hints. Defaults to the active context's `cliName`.
   */
  readonly cliName?: Maybe<string>;
  /**
   * Custom fetch implementation for tests.
   */
  readonly fetcher?: Maybe<typeof fetch>;
}

/**
 * Builds the authenticated `docs` group that reads the app API's audience-gated docs over the logged-in session —
 * the CLI counterpart of the MCP `search_<prefix>_documentation` tool and the `docs-read` built-in method.
 *
 * - `docs list [--sections]` — the docs the caller may read (id, title, description, tags, and optionally section ids).
 * - `docs search <words..> [--limit n]` — a keyword search, ranked by the server exactly like the MCP search.
 * - `docs read <id> [section]` — one doc (or one section) as raw markdown on stdout.
 *
 * Every subcommand prints markdown by default; `--json` (or an explicit `--pick` / `--dump-dir` / `--set-pick` /
 * `--set-dump-dir`) prints the `{ ok, data }` envelope with the server's result as `data`. The dataset cache never
 * applies: the responses are `private, no-store` and depend on the caller's audiences.
 *
 * `createCli()` registers it as a built-in API command (so auth runs first) unless `disableDocs` is set or an app
 * command already uses the name.
 *
 * @param options - Optional group name, CLI name and fetch override.
 * @returns A yargs `CommandModule` for the group.
 * @__NO_SIDE_EFFECTS__
 */
export function buildDocsApiCommand(options?: Maybe<BuildDocsApiCommandOptions>): CommandModule {
  const commandName = options?.commandName ?? DEFAULT_DOCS_API_COMMAND_NAME;
  const fetcher = options?.fetcher;

  function clientInput(): DocsApiClientInput {
    const context: CliContext = requireCliContext();
    return { apiBaseUrl: context.env.apiBaseUrl, accessToken: context.accessToken, cliName: options?.cliName ?? context.cliName, envName: context.envName, commandName, scope: context.scope, credential: context.credential, fetcher };
  }

  const listCommand: CommandModule = {
    command: 'list',
    describe: 'List the docs you can read (id, title, description, tags)',
    builder: (yargs: Argv) => withJsonOption(yargs).option('sections', { type: 'boolean', default: false, describe: "Also list each doc's section ids" }),
    handler: wrapCommandHandler(async (argv: any) => {
      const input = clientInput();
      const result = await listDocsOverHttp(input);

      if (docsApiWantsJson(argv)) {
        outputResult(result, undefined, { applyPick: cliCollectionPickApplier('docs') });
      } else {
        writeMarkdown(renderDocsListMarkdown(result, { cliName: input.cliName, commandName, sections: argv.sections === true }));
      }
    })
  };

  const searchCommand: CommandModule = {
    command: 'search <query..>',
    describe: 'Search the docs you can read (ranked like the MCP documentation search)',
    builder: (yargs: Argv) =>
      withJsonOption(yargs)
        .positional('query', { type: 'string', array: true, describe: 'The words to search for' })
        .option('limit', { type: 'number', describe: `Maximum number of hits (default ${DEFAULT_DOCS_SEARCH_LIMIT}, max ${MAX_DOCS_SEARCH_LIMIT})` }),
    handler: wrapCommandHandler(async (argv: any) => {
      const input = clientInput();
      const query = ([] as unknown[])
        .concat(argv.query ?? [])
        .map(String)
        .join(' ')
        .trim();
      const limit: Maybe<number> = typeof argv.limit === 'number' && Number.isFinite(argv.limit) ? argv.limit : undefined;
      const result = await searchDocsOverHttp({ ...input, query, limit });

      if (docsApiWantsJson(argv)) {
        outputResult(result, undefined, { applyPick: cliCollectionPickApplier('results') });
      } else {
        writeMarkdown(renderDocsSearchMarkdown(result, { query, cliName: input.cliName, commandName }));
      }
    })
  };

  const readCommand: CommandModule = {
    command: 'read <id> [section]',
    describe: 'Print one doc (or one of its sections) as markdown',
    builder: (yargs: Argv) =>
      withJsonOption(yargs)
        .positional('id', { type: 'string', describe: 'The doc id, e.g. guestbook/signing' })
        .positional('section', { type: 'string', describe: `A section id (from \`${commandName} list --sections\`); reads the whole doc when omitted` }),
    handler: wrapCommandHandler(async (argv: any) => {
      const input = clientInput();
      const id = String(argv.id);
      const section: Maybe<string> = toMaybeString(argv.section);
      const result = await readDocOverHttp({ ...input, id, section });

      if (docsApiWantsJson(argv)) {
        outputResult(result);
      } else {
        process.stdout.write(`${result.content}\n`);

        if (result.truncated) {
          const docs = `${input.cliName} ${commandName}`;
          process.stderr.write(`"${id}" was cut at the server's maximum read length; read it by section (\`${docs} read ${id} <section>\`; ids: \`${docs} list --sections\`).\n`);
        }
      }
    })
  };

  return {
    command: commandName,
    describe: "Read the app's docs from its API (list, search, read): the docs the MCP documentation tools serve",
    builder: (yargs: Argv) =>
      yargs
        .command(listCommand)
        .command(searchCommand)
        .command(readCommand)
        .demandCommand(1, 'Specify a docs subcommand: list, search or read.')
        .example([
          [`$0 ${commandName} list`, 'List the docs you can read'],
          [`$0 ${commandName} search guestbook`, 'Search the docs'],
          [`$0 ${commandName} read getting-started`, 'Print one doc as markdown']
        ]),
    handler: () => undefined
  };
}

// MARK: Internal
function withJsonOption(yargs: Argv): Argv {
  return yargs.option('json', { type: 'boolean', default: false, describe: 'Print the { ok, data } JSON envelope instead of markdown' });
}

/**
 * Whether a docs subcommand prints the JSON envelope: `--json`, or an explicit `--pick` / `--dump-dir` /
 * `--set-pick` / `--set-dump-dir` (which would otherwise be silently ignored by the markdown output).
 *
 * @param argv - The parsed arguments.
 * @returns True for JSON output.
 */
function docsApiWantsJson(argv: Record<string, unknown>): boolean {
  return argv['json'] === true || argv['pick'] != null || argv['dumpDir'] != null || argv['setPick'] != null || argv['setDumpDir'] != null;
}

function writeMarkdown(markdown: string): void {
  process.stdout.write(markdown.endsWith('\n') ? markdown : `${markdown}\n`);
}
