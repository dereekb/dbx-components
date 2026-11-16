import type { Argv, CommandModule } from 'yargs';
import { CliError, outputResult } from '../util/output';
import { wrapCommandHandler } from '../util/handler';
import { buildPackageRefsDocsIndex, type EmbeddedPackageRefs, renderPackageRefsDocsIndexMarkdown, resolvePackageRefsDocsTopic } from './package-refs';

/**
 * Error code when `<cli> docs <topic>` names no embedded doc.
 */
export const DOCS_TOPIC_NOT_FOUND_ERROR_CODE = 'DOCS_TOPIC_NOT_FOUND';

/**
 * Error code when a bare `<cli> docs <doc>` matches a sub-doc of more than one ref.
 */
export const DOCS_TOPIC_AMBIGUOUS_ERROR_CODE = 'DOCS_TOPIC_AMBIGUOUS';

/**
 * Configuration for {@link createPackageRefsDocsCommand}.
 */
export interface CreatePackageRefsDocsCommandConfig {
  /**
   * The CLI's binary name, e.g. `msgraph-cli`.
   */
  readonly cliName: string;
  /**
   * The refs the package ships, embedded through `?raw` imports.
   */
  readonly refs: EmbeddedPackageRefs;
}

/**
 * The `--json` output of `<cli> docs` with no topic.
 */
export interface PackageRefsDocsIndexOutput {
  readonly packageName: string;
  readonly topics: ReturnType<typeof buildPackageRefsDocsIndex>;
}

/**
 * The `--json` output of `<cli> docs <topic>`.
 */
export interface PackageRefsDocsTopicOutput {
  readonly packageName: string;
  readonly topic: string;
  readonly content: string;
}

/**
 * Creates the `docs [topic]` command that prints the agent docs (dbx-claude refs) a package ships.
 *
 * - `<cli> docs` prints a markdown index of the topics.
 * - `<cli> docs <ref>` prints the ref's REF.md verbatim, frontmatter included: byte-identical to what dbx-claude serves.
 * - `<cli> docs <ref>/<doc>` prints a sub-doc; a bare `<doc>` works when exactly one ref has it.
 * - `--json` wraps either in the standard `{ ok, data }` envelope.
 *
 * Register it with the CLI's config commands: it needs no auth and its output must not be filtered.
 *
 * @param config - The CLI name and the embedded refs.
 * @returns A yargs `CommandModule` for `docs [topic]`.
 * @throws {CliError} `DOCS_TOPIC_NOT_FOUND` for an unknown topic, `DOCS_TOPIC_AMBIGUOUS` for a bare doc key two refs share.
 * @__NO_SIDE_EFFECTS__
 */
export function createPackageRefsDocsCommand(config: CreatePackageRefsDocsCommandConfig): CommandModule {
  const { cliName, refs } = config;

  return {
    command: 'docs [topic]',
    describe: `Print the agent docs shipped with ${refs.packageName} (an index, or one topic)`,
    builder: (yargs: Argv) =>
      yargs
        .positional('topic', { type: 'string', describe: 'A ref name, <ref>/<doc>, or a sub-doc name' })
        .option('json', { type: 'boolean', default: false, describe: 'Print a JSON envelope instead of markdown' })
        .example([
          [`$0 docs`, 'List the topics'],
          [`$0 docs ${refs.refs[0]?.name ?? '<ref>'}`, 'Print one ref']
        ]),
    handler: wrapCommandHandler(async (argv: any) => {
      const topic: string | undefined = argv.topic;
      const json: boolean = argv.json === true;

      if (topic == null || topic.trim().length === 0) {
        if (json) {
          const output: PackageRefsDocsIndexOutput = { packageName: refs.packageName, topics: buildPackageRefsDocsIndex(refs) };
          outputResult(output);
        } else {
          process.stdout.write(renderPackageRefsDocsIndexMarkdown(refs, cliName));
        }
      } else {
        const resolved = resolvePackageRefsDocsTopic(refs, topic);

        if (!resolved.found) {
          const isAmbiguous = resolved.reason === 'ambiguous';
          throw new CliError({
            message: isAmbiguous ? `Docs topic "${topic}" matches more than one ref.` : `No docs topic "${topic}".`,
            code: isAmbiguous ? DOCS_TOPIC_AMBIGUOUS_ERROR_CODE : DOCS_TOPIC_NOT_FOUND_ERROR_CODE,
            suggestion: `${isAmbiguous ? 'Use one of' : 'Topics'}: ${resolved.candidates.join(', ')}. Run: ${cliName} docs`
          });
        }

        if (json) {
          const output: PackageRefsDocsTopicOutput = { packageName: refs.packageName, topic: resolved.topic, content: resolved.content };
          outputResult(output);
        } else {
          process.stdout.write(resolved.content);
        }
      }
    })
  };
}
