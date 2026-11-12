import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphAutomaticRepliesSetting, type MicrosoftGraphContext, getAutomaticRepliesSetting, microsoftGraphGetAutomaticRepliesRequest, microsoftGraphUpdateAutomaticRepliesRequest, updateAutomaticRepliesSetting } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { readFile } from 'node:fs/promises';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCliPaths } from '../config/cli.config';
import { msGraphCommandHandler } from '../middleware/auth.middleware';
import { MSGRAPH_CLI_AUTO_REPLY_AUDIENCES, MSGRAPH_CLI_AUTO_REPLY_STATUSES, msGraphCliAutoReplyBackupPath, msGraphCliAutoReplyOutput, parseMsGraphCliDateTimeTimeZoneOption, parseMsGraphCliEnumOption, readMsGraphCliAutoReplyBackup, writeMsGraphCliAutoReplyBackup } from '../util/auto.reply';
import { msGraphCliConfirmOptions, msGraphCliDryRunOptions, msGraphCliDryRunOutput, msGraphCliTextToHtml, requireMsGraphCliConfirmation } from '../util/mail.write';
import { outputMsGraphCliResult } from '../util/output';

/**
 * What a changing `mail auto-reply` command prints.
 */
export interface MsGraphCliAutoReplyChangeOutput {
  readonly status: Maybe<string>;
  /**
   * Where the setting from before the change was saved; `mail auto-reply restore` puts it back.
   */
  readonly backup: string;
}

/**
 * Reads the current setting, saves it as the backup, then PATCHes the change.
 *
 * @param graphContext - The Graph context.
 * @param configDir - The CLI config dir the backup is saved in.
 * @param setting - The fields to change.
 * @returns What the command prints.
 */
export async function changeMsGraphCliAutoReply(graphContext: MicrosoftGraphContext, configDir: string, setting: MicrosoftGraphAutomaticRepliesSetting): Promise<MsGraphCliAutoReplyChangeOutput> {
  const previous = await getAutomaticRepliesSetting(graphContext)();
  await writeMsGraphCliAutoReplyBackup(configDir, previous);
  const updated = await updateAutomaticRepliesSetting(graphContext)(setting);
  return { status: updated.status ?? setting.status, backup: msGraphCliAutoReplyBackupPath(configDir) };
}

async function readMessageFile(path: Maybe<string>): Promise<Maybe<string>> {
  let result: Maybe<string>;

  if (path) {
    const content = await readFile(path, 'utf8');
    result = /\.html?$/i.test(path) ? content : msGraphCliTextToHtml(content);
  }

  return result;
}

/**
 * Builds the setting `mail auto-reply set` PATCHes from its options.
 *
 * @param argv - The parsed options.
 * @returns The setting.
 * @throws {CliError} `INVALID_ARGUMENT` when an option is invalid, or `scheduled` lacks its window.
 */
export async function msGraphCliAutoReplySetSetting(argv: any): Promise<MicrosoftGraphAutomaticRepliesSetting> {
  const start = parseMsGraphCliDateTimeTimeZoneOption('start', argv.start, argv.tz);
  const end = parseMsGraphCliDateTimeTimeZoneOption('end', argv.end, argv.tz);
  const status = parseMsGraphCliEnumOption('status', argv.status, MSGRAPH_CLI_AUTO_REPLY_STATUSES) ?? (start || end ? 'scheduled' : 'alwaysEnabled');

  if (status === 'scheduled' && (!start || !end)) {
    throw new CliError({ message: '--status scheduled needs --start and --end.', code: 'INVALID_ARGUMENT' });
  }

  return {
    status,
    externalAudience: parseMsGraphCliEnumOption('audience', argv.audience, MSGRAPH_CLI_AUTO_REPLY_AUDIENCES),
    scheduledStartDateTime: start,
    scheduledEndDateTime: end,
    internalReplyMessage: await readMessageFile(argv.internalFile),
    externalReplyMessage: await readMessageFile(argv.externalFile)
  };
}

const AUTO_REPLY_CONFIRM_DESCRIBE = 'Confirm the change: automatic replies go to everyone who writes, so it refuses to run without --yes';

const DRY_RUN_BACKUP_NOTE = 'The GET is saved to the backup file before the PATCH.';

interface RunChangeInput {
  readonly argv: any;
  readonly graphContext: MicrosoftGraphContext;
  readonly setting: MicrosoftGraphAutomaticRepliesSetting;
  readonly action: string;
}

async function runChange({ argv, graphContext, setting, action }: RunChangeInput): Promise<void> {
  if (argv.dryRun) {
    outputMsGraphCliResult(msGraphCliDryRunOutput([microsoftGraphGetAutomaticRepliesRequest(), microsoftGraphUpdateAutomaticRepliesRequest(setting)], DRY_RUN_BACKUP_NOTE));
  } else {
    requireMsGraphCliConfirmation({ yes: argv.yes, action });
    outputMsGraphCliResult(await changeMsGraphCliAutoReply(graphContext, msGraphCliPaths().configDir, setting));
  }
}

export const MAIL_AUTO_REPLY_GET_COMMAND: CommandModule = {
  command: 'get',
  describe: 'Show the automatic replies: status, audience and window (the messages only with --show-messages)',
  builder: (yargs: Argv) => yargs.option('show-messages', { type: 'boolean', default: false, describe: 'Include the internal and external reply messages' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    outputMsGraphCliResult(msGraphCliAutoReplyOutput(await getAutomaticRepliesSetting(graphContext)(), argv.showMessages === true));
  })
};

export const MAIL_AUTO_REPLY_SET_COMMAND: CommandModule = {
  command: 'set',
  describe: 'Turn on automatic replies (always, or --start/--end scheduled). Saves the previous setting first. Needs --yes',
  builder: (yargs: Argv) =>
    msGraphCliConfirmOptions(msGraphCliDryRunOptions(yargs), AUTO_REPLY_CONFIRM_DESCRIBE)
      .option('status', { type: 'string', describe: `${MSGRAPH_CLI_AUTO_REPLY_STATUSES.join(' | ')} (default: scheduled with --start/--end, else alwaysEnabled)` })
      .option('start', { type: 'string', describe: 'Window start: an ISO 8601 instant, or a local date-time with --tz' })
      .option('end', { type: 'string', describe: 'Window end: an ISO 8601 instant, or a local date-time with --tz' })
      .option('tz', { type: 'string', describe: 'The time zone --start and --end are in, e.g. "Pacific Standard Time"' })
      .option('internal-file', { type: 'string', describe: 'The reply sent inside the organization (.html / .htm as HTML, else text)' })
      .option('external-file', { type: 'string', describe: 'The reply sent outside the organization (.html / .htm as HTML, else text)' })
      .option('audience', { type: 'string', describe: `Who outside the organization gets the external reply: ${MSGRAPH_CLI_AUTO_REPLY_AUDIENCES.join(' | ')}` })
      .example([['$0 mail auto-reply set --start 2026-12-22T00:00 --end 2027-01-02T00:00 --tz "Pacific Standard Time" --internal-file away.html --audience none --yes', 'Scheduled replies over the holidays, internal only']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const setting = await msGraphCliAutoReplySetSetting(argv);
    await runChange({ argv, graphContext, setting, action: 'turn on automatic replies' });
  })
};

export const MAIL_AUTO_REPLY_OFF_COMMAND: CommandModule = {
  command: 'off',
  describe: 'Turn automatic replies off. Saves the previous setting first. Needs --yes',
  builder: (yargs: Argv) => msGraphCliConfirmOptions(msGraphCliDryRunOptions(yargs), AUTO_REPLY_CONFIRM_DESCRIBE),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => runChange({ argv, graphContext, setting: { status: 'disabled' }, action: 'turn off automatic replies' }))
};

export const MAIL_AUTO_REPLY_RESTORE_COMMAND: CommandModule = {
  command: 'restore',
  describe: 'Put back the setting saved before the last change. The current one is saved in its place, so a second restore undoes the first. Needs --yes',
  builder: (yargs: Argv) => msGraphCliConfirmOptions(msGraphCliDryRunOptions(yargs), AUTO_REPLY_CONFIRM_DESCRIBE),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const backup = await readMsGraphCliAutoReplyBackup(msGraphCliPaths().configDir);
    await runChange({ argv, graphContext, setting: backup.setting, action: `restore the automatic replies saved at ${backup.savedAt}` });
  })
};

/**
 * The `mail auto-reply` command: `get`, `set`, `off`, `restore`.
 */
export const MAIL_AUTO_REPLY_COMMAND: CommandModule = {
  command: 'auto-reply',
  describe: 'Read and change automatic replies (out of office). Needs MailboxSettings.ReadWrite to change',
  builder: (yargs: Argv) => yargs.command(MAIL_AUTO_REPLY_GET_COMMAND).command(MAIL_AUTO_REPLY_SET_COMMAND).command(MAIL_AUTO_REPLY_OFF_COMMAND).command(MAIL_AUTO_REPLY_RESTORE_COMMAND).demandCommand(1, 'Please specify an auto-reply subcommand.'),
  handler: () => undefined
};
