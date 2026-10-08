import { type FirestoreModelKey, type Notification, type NotificationUser, addOrReplaceLimitInConstraints, notificationIdentity, notificationUserIdentity, notificationsNewestFirstQuery } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { CLI_READ_VIA_EPILOGUE } from '../api/get.command';
import { discoverOidcMetadata, fetchUserInfo } from '../auth/oidc.client';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { cliFirestoreCollectionForQuery } from '../firestore/firestore.collection';
import { requireCliFirestoreModels } from '../firestore/firestore.models';
import { CLI_READ_VIA_VALUES, DEFAULT_CLI_READ_VIA, cliReadResultMeta, coerceCliReadVia, getModelOverFirestore, resolveCliReadSource } from '../firestore/firestore.read';
import { type CliModelCommands } from '../manifest/build-manifest-commands';
import { wrapCommandHandler } from '../util/handler';
import { CliError } from '../util/output';
import { emitCliNotificationView, withCliNotificationOutputOptions } from './notification.command.factory';
import { type CliNotificationConfig, DEFAULT_CLI_NOTIFICATION_MODEL_COMMAND_NAME } from './notification.config';
import { renderCliNotificationTaskView, renderCliNotificationTasksView, renderCliNotificationUserSettingsView } from './notification.render';
import { CLI_NOTIFICATION_TASK_STATE_FILTER_VALUES, type CliNotificationTaskStateFilter, assertCliNotificationKey, notificationTaskView, notificationTasksView, notificationUserSettingsView, resolveCliNotificationBoxKey } from './notification.view';

/**
 * Default `--limit` of `model notification tasks`.
 */
export const DEFAULT_CLI_NOTIFICATION_TASKS_LIMIT = 200;

/**
 * Builds the notification leaves of the CLI's model tree, for `buildManifestCommands(manifest, { modelCommands })`:
 * - `model notificationUser settings [uid-or-key]`: a user's notification settings, as the settings page shows them.
 * - `model notification tasks [box]`: the notification tasks of one NotificationBox.
 * - `model notification task <key>`: one notification task.
 *
 * @param config - The app's notification wiring.
 * @returns The leaves, keyed by model type.
 * @__NO_SIDE_EFFECTS__
 */
export function buildNotificationModelCommands(config: CliNotificationConfig): CliModelCommands {
  return {
    [notificationUserIdentity.modelType]: [buildNotificationUserSettingsCommand(config)],
    [notificationIdentity.modelType]: [buildNotificationTasksCommand(config), buildNotificationTaskCommand(config)]
  };
}

function withViaOption(yargs: Argv): Argv {
  return yargs
    .option('via', {
      type: 'string',
      choices: CLI_READ_VIA_VALUES as unknown as string[],
      default: DEFAULT_CLI_READ_VIA,
      describe: 'Read transport: auto (default), firestore, or api.'
    })
    .epilogue(CLI_READ_VIA_EPILOGUE);
}

async function readCliModel<T>(input: { readonly context: CliContext; readonly via: unknown; readonly modelType: string; readonly key: FirestoreModelKey }) {
  const { context, modelType, key } = input;
  const resolved = await resolveCliReadSource({ context, via: coerceCliReadVia(input.via), modelType });
  const result = resolved.models ? await getModelOverFirestore<T>({ models: resolved.models, modelType, key }) : await context.getModel<Maybe<T>>(modelType, key);
  return { data: result.data ?? null, meta: cliReadResultMeta(resolved) };
}

async function loadCliCurrentUserUid(context: CliContext): Promise<string> {
  const meta = await discoverOidcMetadata({ issuer: context.env.oidcIssuer, fallbackBaseUrl: context.env.apiBaseUrl });
  const userinfoEndpoint = meta.userinfo_endpoint;
  const claims = userinfoEndpoint == null ? undefined : await fetchUserInfo({ userinfoEndpoint, accessToken: context.accessToken });
  const sub = claims?.['sub'];

  if (typeof sub !== 'string' || sub.length === 0) {
    throw new CliError({
      message: 'Could not resolve the logged-in user from the OIDC userinfo endpoint.',
      code: 'NOTIFICATION_USER_UNRESOLVED',
      suggestion: 'Pass the uid or the NotificationUser key (nu/<uid>) explicitly.'
    });
  }

  return sub;
}

function buildNotificationUserSettingsCommand(config: CliNotificationConfig): CommandModule {
  const modelType = notificationUserIdentity.modelType;

  return {
    command: 'settings [uidOrKey]',
    describe: 'Show a user’s notification settings as the settings page shows them: each type × delivery method, resolved to on/off.',
    builder: (yargs: Argv) =>
      withViaOption(
        withCliNotificationOutputOptions(
          yargs.positional('uidOrKey', {
            type: 'string',
            describe: `The user's uid or NotificationUser key (${notificationUserIdentity.collectionName}/<uid>). Defaults to the logged-in user.`
          })
        )
      ),
    handler: wrapCommandHandler(async (argv: any) => {
      const context = requireCliContext();
      const raw = typeof argv.uidOrKey === 'string' ? argv.uidOrKey.trim() : '';
      const uidOrKey = raw.length > 0 ? raw : await loadCliCurrentUserUid(context);
      const key = uidOrKey.includes('/') ? uidOrKey : `${notificationUserIdentity.collectionName}/${uidOrKey}`;
      const expanded = argv.expanded === true;
      const { data, meta } = await readCliModel<NotificationUser>({ context, via: argv.via, modelType, key });
      const view = notificationUserSettingsView({ config, key, notificationUser: data, cliName: context.cliName, expanded });

      emitCliNotificationView({ view, json: argv.json === true, meta, render: () => renderCliNotificationUserSettingsView(view, expanded) });
    })
  };
}

function buildNotificationTasksCommand(config: CliNotificationConfig): CommandModule {
  const modelCommandName = config.modelCommandName ?? DEFAULT_CLI_NOTIFICATION_MODEL_COMMAND_NAME;

  return {
    command: 'tasks [box]',
    describe: 'List the notification tasks of one NotificationBox, newest first. Reads Firestore directly, so it needs a sys-admin login.',
    builder: (yargs: Argv) =>
      withCliNotificationOutputOptions(
        yargs
          .positional('box', {
            type: 'string',
            describe: 'The NotificationBox: a box key (nb/<id>), a bare box id, or a model key (e.g. pr/<uid> lists nb/pr_<uid>). Defaults to the framework task box.'
          })
          .option('type', { type: 'string', describe: 'Only list this task type.' })
          .option('state', {
            type: 'string',
            choices: CLI_NOTIFICATION_TASK_STATE_FILTER_VALUES as unknown as string[],
            default: 'all',
            describe: 'Only list pending (ready or scheduled) or done tasks.'
          })
          .option('limit', { type: 'number', default: DEFAULT_CLI_NOTIFICATION_TASKS_LIMIT, describe: 'Maximum notifications to read, before the type and state filters.' })
      ).epilogue(
        [
          'Tasks are listed one NotificationBox at a time; there is no cross-box query.',
          '  - Framework tasks (e.g. SFP, FSPS) and tasks created without a model live in the framework task box (the default).',
          '  - A task created for a model lives in that model’s box: pass the model key.',
          `Inspect one task with \`${modelCommandName} ${notificationIdentity.modelType} task <key> --expanded\`.`
        ].join('\n')
      ),
    handler: wrapCommandHandler(async (argv: any) => {
      const context = requireCliContext();
      const box = resolveCliNotificationBoxKey(argv.box);
      const limit = typeof argv.limit === 'number' && argv.limit > 0 ? argv.limit : DEFAULT_CLI_NOTIFICATION_TASKS_LIMIT;
      const expanded = argv.expanded === true;
      const models = await requireCliFirestoreModels(context);
      const collection = cliFirestoreCollectionForQuery({ models, modelType: models.modelTypeForCollection(notificationIdentity.collectionName), scope: 'COLLECTION', isNested: true, parentKey: box });
      const pairs = await collection.queryDocument(...addOrReplaceLimitInConstraints(limit)(notificationsNewestFirstQuery())).getDocSnapshotDataPairs();
      // the pair's own data is the raw snapshot data, so decode through the document's converter
      const notifications = pairs.map((pair) => ({ key: pair.document.key, notification: pair.document.converter.fromFirestore(pair.snapshot as never) as Partial<Notification> }));
      const view = notificationTasksView({ box, notifications, manifest: config.manifest, type: argv.type || undefined, state: argv.state as CliNotificationTaskStateFilter, expanded });

      emitCliNotificationView({ view, json: argv.json === true, meta: { source: 'firestore', limit }, render: () => renderCliNotificationTasksView(view, expanded) });
    })
  };
}

function buildNotificationTaskCommand(config: CliNotificationConfig): CommandModule {
  const modelType = notificationIdentity.modelType;

  return {
    command: 'task <key>',
    describe: 'Show one notification task: its state, attempts and checkpoint progress.',
    builder: (yargs: Argv) => withViaOption(withCliNotificationOutputOptions(yargs.positional('key', { type: 'string', describe: 'The notification key, nb/<boxId>/nbn/<id>.' }))),
    handler: wrapCommandHandler(async (argv: any) => {
      const context = requireCliContext();
      const key = typeof argv.key === 'string' ? argv.key.trim() : '';
      assertCliNotificationKey(key);

      const expanded = argv.expanded === true;
      const { data, meta } = await readCliModel<Notification>({ context, via: argv.via, modelType, key });

      if (data == null) {
        throw new CliError({ message: `Notification '${key}' does not exist.`, code: 'NOTIFICATION_NOT_FOUND', suggestion: 'Done tasks are deleted on cleanup.' });
      }

      const view = notificationTaskView({ key, notification: data, manifest: config.manifest, expanded });
      emitCliNotificationView({ view, json: argv.json === true, meta, render: () => renderCliNotificationTaskView(view) });
    })
  };
}
