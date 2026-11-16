import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphContext, MicrosoftGraphError, createDraftMessage, isMicrosoftGraphNotFoundError, microsoftGraphListMessagesRequest, microsoftGraphPermanentDeleteMessageRequest, microsoftGraphRequest } from '@dereekb/microsoft';
import { type EmailAddress, type Maybe } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCliConfigStore, msGraphCliPaths } from '../config/cli.config';
import { msGraphCommandHandler } from '../middleware/auth.middleware';
import { parseMsGraphCliAddressesOption } from '../util/mail.write';
import { outputMsGraphCliResult } from '../util/output';

/**
 * The subject of the draft the write probe creates and deletes at once.
 */
export const MSGRAPH_CLI_MAILBOX_CHECK_DRAFT_SUBJECT = 'msgraph-cli mailbox check (never sent; safe to delete)';

/**
 * What one probe of a mailbox found.
 *
 * - `ok`: the call succeeded.
 * - `denied`: 401 / 403 — a missing `*.Shared` scope or a missing Exchange permission on the mailbox.
 * - `not-found`: 404 / `ErrorInvalidUser` — no such mailbox, or one not enabled for REST.
 * - `error`: any other failure (see `code`).
 * - `skipped`: not probed (the read failed, or `--no-write`).
 */
export type MsGraphCliMailboxAccess = 'ok' | 'denied' | 'not-found' | 'error' | 'skipped';

/**
 * The Graph codes that mean the mailbox address does not resolve.
 */
export const MSGRAPH_CLI_MAILBOX_NOT_FOUND_CODES: readonly string[] = ['ErrorInvalidUser', 'MailboxNotEnabledForRESTAPI', 'ErrorNonExistentMailbox'];

/**
 * One row of `mail mailboxes check`.
 */
export interface MsGraphCliMailboxCheckResult {
  readonly mailbox: EmailAddress;
  readonly read: MsGraphCliMailboxAccess;
  readonly write: MsGraphCliMailboxAccess;
  readonly readCode?: string;
  readonly writeCode?: string;
  /**
   * The probe draft's id when it was created but could not be deleted.
   */
  readonly draftLeft?: string;
}

/**
 * Classifies a probe failure.
 *
 * @param error - The thrown value.
 * @returns The access verdict and Graph's code.
 * @throws {unknown} The error itself when it is not a Graph error (a timeout, a network failure).
 */
export function msGraphCliMailboxProbeFailure(error: unknown): { readonly access: MsGraphCliMailboxAccess; readonly code?: string } {
  let result: { readonly access: MsGraphCliMailboxAccess; readonly code?: string };

  if (error instanceof MicrosoftGraphError) {
    if (error.status === 401 || error.status === 403) {
      result = { access: 'denied', code: error.code };
    } else if (isMicrosoftGraphNotFoundError(error) || MSGRAPH_CLI_MAILBOX_NOT_FOUND_CODES.includes(error.code)) {
      result = { access: 'not-found', code: error.code };
    } else {
      result = { access: 'error', code: error.code };
    }
  } else {
    throw error;
  }

  return result;
}

/**
 * Probes one mailbox: a top-1 read of its messages, then (unless `write` is false) creating a draft in it and
 * permanently deleting that draft at once. The draft is never sent.
 *
 * @param graphContext - The Graph context.
 * @param mailbox - The mailbox address.
 * @param options - Whether to run the write probe.
 * @param options.write - Run the write probe. Defaults to true.
 * @returns The result.
 */
export async function checkMsGraphCliMailbox(graphContext: MicrosoftGraphContext, mailbox: EmailAddress, options?: Maybe<{ readonly write?: Maybe<boolean> }>): Promise<MsGraphCliMailboxCheckResult> {
  const request = microsoftGraphRequest(graphContext);
  let read: MsGraphCliMailboxAccess = 'ok';
  let readCode: Maybe<string>;
  let write: MsGraphCliMailboxAccess = 'skipped';
  let writeCode: Maybe<string>;
  let draftLeft: Maybe<string>;

  try {
    await request({ method: 'GET', ...microsoftGraphListMessagesRequest({ mailbox, top: 1, select: 'id' }) });
  } catch (e) {
    const failure = msGraphCliMailboxProbeFailure(e);
    read = failure.access;
    readCode = failure.code;
  }

  if (read === 'ok' && options?.write !== false) {
    try {
      const draft = await createDraftMessage(graphContext)({ mailbox, message: { subject: MSGRAPH_CLI_MAILBOX_CHECK_DRAFT_SUBJECT } });
      write = 'ok';

      try {
        await request(microsoftGraphPermanentDeleteMessageRequest({ mailbox, id: draft.id }));
      } catch {
        draftLeft = draft.id;
      }
    } catch (e) {
      const failure = msGraphCliMailboxProbeFailure(e);
      write = failure.access;
      writeCode = failure.code;
    }
  }

  return { mailbox, read, write, ...(readCode ? { readCode } : {}), ...(writeCode ? { writeCode } : {}), ...(draftLeft ? { draftLeft } : {}) };
}

export const MAIL_MAILBOXES_CHECK_COMMAND: CommandModule = {
  command: 'check [mailboxes..]',
  describe: 'Probe shared mailboxes: read (top-1 message) and write (create a draft, then delete it; never sent)',
  builder: (yargs: Argv) =>
    yargs
      .positional('mailboxes', { type: 'string', array: true, describe: 'Mailbox addresses. Default: the saved list (msgraph-cli config set mailboxes a@x,b@y)' })
      .option('write', { type: 'boolean', default: true, describe: 'Also probe write access with a draft that is created and deleted at once (--no-write to skip)' })
      .example([
        ['$0 mail mailboxes check support@example.com', 'Can I read and draft in the support mailbox?'],
        ['$0 config set mailboxes support@example.com,billing@example.com && $0 mail mailboxes check', 'Check every saved mailbox']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const mailboxes = parseMsGraphCliAddressesOption('mailboxes', argv.mailboxes?.length ? argv.mailboxes : undefined) ?? (await msGraphCliConfigStore(msGraphCliPaths()).loadConfigFile())?.mailboxes ?? [];

    if (mailboxes.length === 0) {
      throw new CliError({ message: 'No mailboxes to check.', code: 'INVALID_ARGUMENT', suggestion: 'Pass addresses, or save them: msgraph-cli config set mailboxes a@example.com,b@example.com. Graph cannot list the mailboxes you may open.' });
    }

    const results: MsGraphCliMailboxCheckResult[] = [];

    for (const mailbox of mailboxes) {
      results.push(await checkMsGraphCliMailbox(graphContext, mailbox, { write: argv.write }));
    }

    outputMsGraphCliResult(results);
  })
};

export const MAIL_MAILBOXES_COMMAND: CommandModule = {
  command: 'mailboxes',
  describe: 'Shared mailboxes: check read / write access',
  builder: (yargs: Argv) => yargs.command(MAIL_MAILBOXES_CHECK_COMMAND).demandCommand(1, 'Please specify a mailboxes subcommand.'),
  handler: () => undefined
};
