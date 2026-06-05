/**
 * `dbx-components-cli validate ...` — run a dbx-components folder-convention
 * validator over a component + API pair.
 *
 * Thin yargs wrappers over the pure validators in `@dereekb/dbx-cli/validate`
 * (the same logic the `dbx_*_validate_folder` MCP tools call). Every command
 * takes `--json` for CI consumption, and sets a non-zero exit code when the
 * validation reports any error-severity violation so the CLI works as a CI gate.
 */

import { notificationValidateFolder, storagefileValidateFolder } from '@dereekb/dbx-cli/validate';
import { type ArgumentsCamelCase, type Argv, type CommandModule } from 'yargs';
import { resolvePath, runCommand } from '../lib/run.js';

const FOLDER_KINDS = ['notification', 'storagefile'] as const;
type FolderKind = (typeof FOLDER_KINDS)[number];

interface FolderValidationOutcome {
  readonly errorCount: number;
  readonly warningCount: number;
}

/**
 * One folder-validator kind: how to inspect the two-side folder pair and
 * render the result. Keyed by the `--kind` value.
 */
interface FolderValidator {
  readonly run: (input: { readonly componentRootDir: string; readonly componentRelDir: string; readonly apiRootDir: string; readonly apiRelDir: string }) => Promise<{ readonly outcome: FolderValidationOutcome; readonly markdown: string; readonly json: unknown }>;
}

const FOLDER_VALIDATORS: Record<FolderKind, FolderValidator> = {
  notification: {
    run: async (input) => {
      const inspection = await notificationValidateFolder.inspectNotificationFolder(input);
      const result = notificationValidateFolder.validateNotificationFolder(inspection);
      return { outcome: result, markdown: notificationValidateFolder.formatResult(result), json: result };
    }
  },
  storagefile: {
    run: async (input) => {
      const inspection = await storagefileValidateFolder.inspectStorageFileFolder(input);
      const result = storagefileValidateFolder.validateStorageFileFolder(inspection);
      return { outcome: result, markdown: storagefileValidateFolder.formatResult(result), json: result };
    }
  }
};

interface ValidateFolderArgs {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly kind: FolderKind;
  readonly json: boolean;
}

const validateFolderCommand: CommandModule<object, ValidateFolderArgs> = {
  command: 'folder <componentDir> <apiDir>',
  describe: 'Validate a component + API folder pair against a model-domain folder convention.',
  builder: (yargs: Argv): Argv<ValidateFolderArgs> =>
    yargs
      .positional('componentDir', { type: 'string', demandOption: true, describe: 'Relative path to the `-firebase` component package (e.g. components/demo-firebase).' })
      .positional('apiDir', { type: 'string', demandOption: true, describe: 'Relative path to the API app (e.g. apps/demo-api).' })
      .option('kind', { choices: FOLDER_KINDS, demandOption: true, describe: 'Which folder convention to validate.' })
      .option('json', { type: 'boolean', default: false, describe: 'Emit JSON instead of markdown.' }) as Argv<ValidateFolderArgs>,
  handler: (args: ArgumentsCamelCase<ValidateFolderArgs>): Promise<void> =>
    runCommand(async () => {
      const component = resolvePath(args.componentDir);
      const api = resolvePath(args.apiDir);
      const validator = FOLDER_VALIDATORS[args.kind];
      const { outcome, markdown, json } = await validator.run({ componentRootDir: component.abs, componentRelDir: component.rel, apiRootDir: api.abs, apiRelDir: api.rel });
      if (outcome.errorCount > 0) {
        process.exitCode = 1;
      }
      return args.json ? JSON.stringify(json, null, 2) : markdown;
    })
};

/**
 * The `validate` command group.
 */
export const VALIDATE_COMMAND: CommandModule = {
  command: 'validate <command>',
  describe: 'Run a dbx-components folder-convention validator (folder).',
  builder: (yargs: Argv): Argv => yargs.command(validateFolderCommand).demandCommand(1, 'Specify a validate subcommand.'),
  handler: () => undefined
};
