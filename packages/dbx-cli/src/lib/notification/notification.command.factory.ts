import { noop } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { wrapSyncCommandHandler } from '../util/handler';
import { CliError, outputResult } from '../util/output';
import { type CliNotificationConfig, DEFAULT_CLI_NOTIFICATION_COMMAND_NAME } from './notification.config';
import { renderCliNotificationTaskTypesView, renderCliNotificationTypesView } from './notification.render';
import { notificationTaskTypesView, notificationTypesView } from './notification.view';

/**
 * Adds the `--expanded` and `--json` output options shared by every notification command.
 *
 * @param yargs - The command's yargs builder.
 * @returns The builder, for chaining.
 */
export function withCliNotificationOutputOptions(yargs: Argv): Argv {
  return yargs
    .option('expanded', {
      type: 'boolean',
      default: false,
      describe: 'Print the full detail instead of the compact table.'
    })
    .option('json', {
      type: 'boolean',
      default: false,
      describe: 'Emit a structured JSON envelope. Combine with --expanded for the expanded view model.'
    });
}

/**
 * Emits a notification view: the `{ ok, data }` envelope under `--json`, otherwise the rendered text.
 *
 * @param input - The view, the output mode and the renderer.
 * @param input.view - The view model.
 * @param input.json - Whether `--json` was passed.
 * @param input.render - Renders the view as text.
 * @param input.meta - Optional envelope metadata.
 */
export function emitCliNotificationView<T>(input: { readonly view: T; readonly json: boolean; readonly render: () => string; readonly meta?: Record<string, unknown> }): void {
  if (input.json) {
    outputResult(input.view, input.meta);
  } else {
    process.stdout.write(input.render());
  }
}

interface NotificationCatalogArgv {
  readonly type?: string;
  readonly all?: boolean;
  readonly expanded?: boolean;
  readonly json?: boolean;
}

/**
 * Builds the root notification catalog group, `notification types [type]` and `notification task-types [type]`.
 *
 * Both read only the app's runtime template type info record and the generated notification manifest, so they run without a login. Register
 * the group through `runCli({ notification })`, which adds it to the auth-free config commands.
 *
 * @param config - The app's notification wiring.
 * @returns The command group.
 * @__NO_SIDE_EFFECTS__
 */
export function createNotificationCommand(config: CliNotificationConfig): CommandModule {
  const commandName = config.commandName ?? DEFAULT_CLI_NOTIFICATION_COMMAND_NAME;

  const typesCommand: CommandModule = {
    command: 'types [type]',
    describe: 'List the notification template types the settings page shows, with each delivery method default.',
    builder: (yargs: Argv) => withCliNotificationOutputOptions(yargs.positional('type', { type: 'string', describe: 'Template type code to show. Omit to list every type.' }).option('all', { type: 'boolean', default: false, describe: 'Include the types hidden from the settings page.' })),
    handler: wrapSyncCommandHandler((argv: any) => {
      const { type, all, expanded = false, json = false } = argv as NotificationCatalogArgv;
      const view = notificationTypesView({ config, type: type || undefined, all, expanded });

      if (type && view.types.length === 0) {
        throw new CliError({ message: `No notification template type '${type}'.`, code: 'NOTIFICATION_TYPE_NOT_FOUND', suggestion: `Run \`${commandName} types --all\` to list every type.` });
      }

      emitCliNotificationView({ view, json, render: () => renderCliNotificationTypesView(view, expanded) });
    })
  };

  const taskTypesCommand: CommandModule = {
    command: 'task-types [type]',
    describe: 'List the notification task types, with their checkpoint flows (from the generated notification manifest).',
    builder: (yargs: Argv) => withCliNotificationOutputOptions(yargs.positional('type', { type: 'string', describe: 'Task type code to show. Omit to list every task type.' })),
    handler: wrapSyncCommandHandler((argv: any) => {
      const { type, expanded = false, json = false } = argv as NotificationCatalogArgv;
      const manifest = config.manifest;

      if (manifest == null) {
        throw new CliError({
          message: 'This CLI was not built with a notification manifest.',
          code: 'NOTIFICATION_MANIFEST_MISSING',
          suggestion: 'Run `dbx-cli-generate-notification-manifest --cli-output=<file.ts> --project=<name>` and pass the emitted `<NS>_NOTIFICATION_MANIFEST` as `notification.manifest` to `runCli()`.'
        });
      }

      const view = notificationTaskTypesView({ manifest, type: type || undefined, expanded });

      if (type && view.tasks.length === 0) {
        throw new CliError({ message: `No notification task type '${type}'.`, code: 'NOTIFICATION_TASK_TYPE_NOT_FOUND', suggestion: `Run \`${commandName} task-types\` to list every task type.` });
      }

      emitCliNotificationView({ view, json, render: () => renderCliNotificationTaskTypesView(view, expanded) });
    })
  };

  return {
    command: commandName,
    describe: 'Browse the notification catalog: template types and task types.',
    builder: (yargs: Argv) => yargs.command(typesCommand).command(taskTypesCommand).demandCommand(1, 'Specify a notification subcommand.'),
    handler: noop
  };
}
