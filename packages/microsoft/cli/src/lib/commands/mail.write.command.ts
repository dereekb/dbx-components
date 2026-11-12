import { CliError } from '@dereekb/dbx-cli';
import {
  type MicrosoftGraphMessage,
  type MicrosoftGraphOutgoingMessageInput,
  type MicrosoftGraphRequestInput,
  createDraftMessage,
  deleteMessages,
  microsoftGraphCreateDraftRequest,
  microsoftGraphDeleteMessagesRequests,
  microsoftGraphDraftStateRequest,
  microsoftGraphMoveMessageRequest,
  microsoftGraphRespondToMessageRequest,
  microsoftGraphSendDraftRequest,
  microsoftGraphSendMailRequest,
  microsoftGraphUpdateDraftRequest,
  moveMessages,
  respondToMessage,
  sendDraftMessage,
  sendMail,
  updateDraftMessage,
  uploadMessageAttachment
} from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { readFile } from 'node:fs/promises';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCommandHandler } from '../middleware/auth.middleware';
import { MSGRAPH_CLI_BULK_MAX_PER_MINUTE, parseMsGraphCliBulkRecipients, planMsGraphCliBulkSend, readMsGraphCliBulkProgress, sendMsGraphCliBulkMail } from '../util/mail.bulk';
import {
  appendMsGraphCliSignature,
  appendMsGraphCliSignatureToComment,
  isMsGraphCliHtmlFile,
  msGraphCliBodyOptions,
  msGraphCliComposeOptions,
  msGraphCliConfirmOptions,
  msGraphCliDryRunOptions,
  msGraphCliDryRunOutput,
  msGraphCliWriteResultsOutput,
  parseMsGraphCliAddressesOption,
  readMsGraphCliAttachments,
  readMsGraphCliBodyOption,
  readMsGraphCliSignature,
  requireMsGraphCliConfirmation,
  splitMsGraphCliAttachments
} from '../util/mail.write';
import { msGraphCliMailboxOptions, readMsGraphCliIdsOption } from '../util/option';
import { outputMsGraphCliResult } from '../util/output';

/**
 * A composed message: the fields sent in the first call, and the attachments too large to send inline.
 */
export interface MsGraphCliComposedMessage {
  readonly message: MicrosoftGraphOutgoingMessageInput;
  readonly largeAttachments: NonNullable<MicrosoftGraphOutgoingMessageInput['attachments']>;
}

/**
 * Composes a message from the compose options: recipients, subject, body with the signature appended, and
 * attachments split into inline and large.
 *
 * @param argv - The parsed arguments.
 * @param options - Whether to append the signature to the body.
 * @param options.signature - Append the signature (a new message's body); false for a PATCH that leaves the body alone.
 * @returns The composed message.
 */
export async function composeMsGraphCliMessage(argv: any, options: { readonly signature: boolean }): Promise<MsGraphCliComposedMessage> {
  const body = await readMsGraphCliBodyOption(argv);
  const signature = options.signature ? await readMsGraphCliSignature(argv) : undefined;
  const { inline, large } = splitMsGraphCliAttachments(await readMsGraphCliAttachments(argv.attach));

  const message: MicrosoftGraphOutgoingMessageInput = {
    subject: argv.subject,
    body: appendMsGraphCliSignature(body, signature),
    to: parseMsGraphCliAddressesOption('to', argv.to),
    cc: parseMsGraphCliAddressesOption('cc', argv.cc),
    bcc: parseMsGraphCliAddressesOption('bcc', argv.bcc),
    from: argv.sendAs,
    attachments: inline.length > 0 ? inline : undefined
  };

  return { message, largeAttachments: large };
}

/**
 * What a draft command prints: the draft's id and link, never its content or recipients.
 */
export interface MsGraphCliDraftOutput {
  readonly id: string;
  readonly isDraft?: Maybe<boolean>;
  readonly webLink?: Maybe<string>;
  readonly conversationId?: Maybe<string>;
  readonly uploadedAttachments?: number;
}

/**
 * Builds what a draft command prints.
 *
 * @param message - The draft Graph returned.
 * @param uploadedAttachments - How many large attachments were uploaded to it.
 * @returns The output.
 */
export function msGraphCliDraftOutput(message: MicrosoftGraphMessage, uploadedAttachments?: number): MsGraphCliDraftOutput {
  return { id: message.id, isDraft: message.isDraft ?? true, webLink: message.webLink, conversationId: message.conversationId, ...(uploadedAttachments ? { uploadedAttachments } : {}) };
}

function largeAttachmentNote(count: number): Maybe<string> {
  return count > 0 ? `Then ${count} attachment(s) of 3 MB or more are uploaded to the draft in sessions (createUploadSession + chunk PUTs).` : undefined;
}

// MARK: Draft
export const MAIL_DRAFT_CREATE_COMMAND: CommandModule = {
  command: 'create',
  describe: 'Create a draft in Drafts (not sent). Prints its immutable id',
  builder: (yargs: Argv) =>
    msGraphCliDryRunOptions(msGraphCliComposeOptions(msGraphCliMailboxOptions(yargs))).example([
      ['$0 mail draft create --to ada@example.com --subject "Hello" --body-file note.html', 'An HTML draft with the saved signature'],
      ['$0 mail draft create --to ada@example.com --subject "Report" --body "Attached." --attach report.pdf', 'A draft with an attachment (over 3 MB uploads in a session)']
    ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const { message, largeAttachments } = await composeMsGraphCliMessage(argv, { signature: true });
    const input = { mailbox: argv.mailbox, immutableIds: !argv.mutableIds, message };

    if (argv.dryRun) {
      outputMsGraphCliResult(msGraphCliDryRunOutput([microsoftGraphCreateDraftRequest(input)], largeAttachmentNote(largeAttachments.length)));
    } else {
      const draft = await createDraftMessage(graphContext)(input);

      for (const attachment of largeAttachments) {
        await uploadMessageAttachment(graphContext)({ mailbox: argv.mailbox, id: draft.id, attachment });
      }

      outputMsGraphCliResult(msGraphCliDraftOutput(draft, largeAttachments.length));
    }
  })
};

export const MAIL_DRAFT_UPDATE_COMMAND: CommandModule = {
  command: 'update <id>',
  describe: "Change a draft's recipients, subject or body (refused once it is sent)",
  builder: (yargs: Argv) =>
    msGraphCliDryRunOptions(msGraphCliComposeOptions(msGraphCliMailboxOptions(yargs)))
      .positional('id', { type: 'string', demandOption: true, describe: 'The draft id' })
      .example([['$0 mail draft update AAMk... --subject "Hello again" --cc grace@example.com', 'Change the subject and Cc; the body is left alone']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    if (argv.attach?.length) {
      throw new CliError({ message: 'mail draft update cannot add attachments.', code: 'INVALID_ARGUMENT', suggestion: 'Create a new draft with --attach, or attach in Outlook.' });
    }

    // the signature is appended only when a new body replaces the old one
    const { message } = await composeMsGraphCliMessage(argv, { signature: argv.body != null || argv.bodyFile != null });
    const input = { mailbox: argv.mailbox, immutableIds: !argv.mutableIds, id: argv.id, message };

    if (argv.dryRun) {
      outputMsGraphCliResult(msGraphCliDryRunOutput([microsoftGraphDraftStateRequest(input), microsoftGraphUpdateDraftRequest(input)], 'The GET checks isDraft first; a sent message is refused before the PATCH.'));
    } else {
      outputMsGraphCliResult(msGraphCliDraftOutput(await updateDraftMessage(graphContext)(input)));
    }
  })
};

export const MAIL_DRAFT_COMMAND: CommandModule = {
  command: 'draft',
  describe: 'Create or change drafts',
  builder: (yargs: Argv) => yargs.command(MAIL_DRAFT_CREATE_COMMAND).command(MAIL_DRAFT_UPDATE_COMMAND).demandCommand(1, 'Please specify a draft subcommand.'),
  handler: () => undefined
};

// MARK: Send
/**
 * What `mail send` prints. Graph answers 202 with no body; `sendMail` returns no id.
 */
export interface MsGraphCliSendOutput {
  readonly sent: true;
  /**
   * The draft that was sent. With immutable ids, it finds the copy in Sent Items (UNVERIFIED until live test B3).
   */
  readonly id?: string;
  readonly recipients?: number;
}

export const MAIL_SEND_COMMAND: CommandModule = {
  command: 'send [draftId]',
  describe: 'Send a draft by id, or compose and send a new message in one call (sendMail). Needs --yes',
  builder: (yargs: Argv) =>
    msGraphCliConfirmOptions(msGraphCliDryRunOptions(msGraphCliComposeOptions(msGraphCliMailboxOptions(yargs))))
      .positional('draftId', { type: 'string', describe: 'A draft to send. Without it, the message is composed from --to / --subject / --body' })
      .option('save', { type: 'boolean', default: true, describe: 'Save the sent copy to Sent Items (--no-save to skip; one-shot send only)' })
      .example([
        ['$0 mail send AAMk... --yes', 'Send a draft'],
        ['$0 mail send --to ada@example.com --subject "Hi" --body "Thanks!" --yes', 'Compose and send in one call'],
        ['$0 mail send --mailbox support@example.com --to ada@example.com --subject "Re: ticket" --body-file reply.html --yes', 'Send from a shared mailbox (saved to its Sent Items)'],
        ['$0 mail send --to ada@example.com --subject "Hi" --body "x" --dry-run', 'Print the Graph call, recipients redacted to counts']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    if (argv.draftId) {
      const request = microsoftGraphSendDraftRequest({ mailbox: argv.mailbox, id: argv.draftId });

      if (argv.dryRun) {
        outputMsGraphCliResult(msGraphCliDryRunOutput([request]));
      } else {
        requireMsGraphCliConfirmation({ yes: argv.yes, action: 'send this draft' });
        await sendDraftMessage(graphContext)({ mailbox: argv.mailbox, id: argv.draftId });
        const output: MsGraphCliSendOutput = { sent: true, id: argv.draftId };
        outputMsGraphCliResult(output);
      }
    } else {
      const { message, largeAttachments } = await composeMsGraphCliMessage(argv, { signature: true });

      if (!message.to?.length || message.subject == null) {
        throw new CliError({ message: 'A new message needs --to and --subject (or pass a draft id to send a draft).', code: 'INVALID_ARGUMENT' });
      }

      if (largeAttachments.length > 0) {
        throw new CliError({ message: 'Attachments of 3 MB or more cannot go in a one-shot send.', code: 'INVALID_ARGUMENT', suggestion: 'Create a draft with mail draft create --attach …, then send it with mail send <draftId> --yes.' });
      }

      const input = { mailbox: argv.mailbox, message, saveToSentItems: argv.save !== false };
      const recipients = (message.to?.length ?? 0) + (message.cc?.length ?? 0) + (message.bcc?.length ?? 0);

      if (argv.dryRun) {
        outputMsGraphCliResult(msGraphCliDryRunOutput([microsoftGraphSendMailRequest(input)]));
      } else {
        requireMsGraphCliConfirmation({ yes: argv.yes, action: `send a message to ${recipients} recipient(s)` });
        await sendMail(graphContext)(input);
        const output: MsGraphCliSendOutput = { sent: true, recipients };
        outputMsGraphCliResult(output);
      }
    }
  })
};

export const MAIL_SEND_BULK_COMMAND: CommandModule = {
  command: 'send-bulk',
  describe: `Send one templated message per recipient row (CSV or JSON), paced to ${MSGRAPH_CLI_BULK_MAX_PER_MINUTE}/min, resumable. Needs --yes`,
  builder: (yargs: Argv) =>
    msGraphCliConfirmOptions(msGraphCliDryRunOptions(msGraphCliMailboxOptions(yargs)))
      .option('file', { type: 'string', demandOption: true, describe: 'Recipients: .csv with a header row and a "to" column, or .json (array of objects with "to"). Other columns are template fields; ";" separates several addresses; no bcc' })
      .option('template', { type: 'string', demandOption: true, describe: 'The body template; {{field}} placeholders are filled per row. .html / .htm is sent as HTML' })
      .option('subject', { type: 'string', demandOption: true, describe: 'The subject template ({{field}} placeholders allowed)' })
      .option('html', { type: 'boolean', default: false, describe: 'Send the body as HTML' })
      .option('limit', { type: 'number', describe: 'The most messages this run sends. Required when more than 500 are left' })
      .option('progress-file', { type: 'string', describe: 'Records sent rows so a re-run resumes. Default: <file>.progress.json' })
      .option('send-as', { type: 'string', describe: 'Send as this address (sets `from`)' })
      .option('save', { type: 'boolean', default: true, describe: 'Save sent copies to Sent Items (--no-save to skip)' })
      .option('signature-file', { type: 'string', describe: 'Append this signature. Default: the saved signature-file' })
      .option('signature', { type: 'boolean', default: true, describe: 'Append the signature (--no-signature to skip)' })
      .example([
        ['$0 mail send-bulk --file subs.csv --template invite.html --subject "Hi {{name}}" --dry-run', 'Counts and the first Graph call, recipients redacted'],
        ['$0 mail send-bulk --file subs.csv --template invite.html --subject "Hi {{name}}" --yes', 'Send; re-run the same command to resume after an interruption']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const file = String(argv.file);
    const rows = parseMsGraphCliBulkRecipients(await readFile(file, 'utf8'), /\.json$/i.test(file) ? 'json' : 'csv');
    const progressFile = argv.progressFile ?? `${file}.progress.json`;
    const progress = await readMsGraphCliBulkProgress(progressFile);
    const html = argv.html || isMsGraphCliHtmlFile(argv.template);
    const template = { subject: argv.subject, body: await readFile(argv.template, 'utf8'), html, signature: await readMsGraphCliSignature(argv), mailbox: argv.mailbox, sendAs: argv.sendAs, saveToSentItems: argv.save !== false };
    const plan = planMsGraphCliBulkSend({ rows, progress, template, limit: argv.limit });

    if (argv.dryRun) {
      const first = plan.toSend[0]?.request;
      outputMsGraphCliResult({
        ...msGraphCliDryRunOutput(first ? [first] : [], `Only the first of ${plan.toSend.length} sendMail calls is shown. They go in $batch calls of up to 10, paced to ${MSGRAPH_CLI_BULK_MAX_PER_MINUTE} messages a minute.`),
        rows: plan.rows,
        alreadySent: plan.alreadySent,
        toSend: plan.toSend.length,
        deferred: plan.deferred,
        minimumMinutes: Math.ceil(plan.toSend.length / MSGRAPH_CLI_BULK_MAX_PER_MINUTE),
        progressFile
      });
    } else {
      requireMsGraphCliConfirmation({ yes: argv.yes, action: `send ${plan.toSend.length} message(s)` });
      outputMsGraphCliResult(await sendMsGraphCliBulkMail({ graphContext, plan, progress, progressFile, onProgress: (line) => process.stderr.write(`${line}\n`) }));
    }
  })
};

// MARK: Reply / Forward
async function respondHandler(argv: any, graphContext: Parameters<typeof respondToMessage>[0], kind: 'reply' | 'replyAll' | 'forward'): Promise<void> {
  if (argv.comment != null && (argv.body != null || argv.bodyFile != null)) {
    // models: M-d (message-reply) — a comment and a message body together answer 400
    throw new CliError({ message: 'Pass --comment or --body / --body-file, not both: Graph rejects a comment with a message body.', code: 'INVALID_ARGUMENT', suggestion: '--comment keeps the quoted original below your text; --body replaces the reply body.' });
  }

  const signature = await readMsGraphCliSignature(argv);
  const body = await readMsGraphCliBodyOption(argv);
  const to = parseMsGraphCliAddressesOption('to', argv.to);
  const cc = parseMsGraphCliAddressesOption('cc', argv.cc);

  if (kind === 'forward' && !argv.draft && !to?.length) {
    throw new CliError({ message: 'mail forward needs --to.', code: 'INVALID_ARGUMENT' });
  }

  const comment = argv.comment == null ? undefined : appendMsGraphCliSignatureToComment(String(argv.comment), signature);
  const messageBody = comment == null ? appendMsGraphCliSignature(body, signature) : undefined;
  const message: MicrosoftGraphOutgoingMessageInput = { body: messageBody, to, cc };
  const input = { mailbox: argv.mailbox, immutableIds: !argv.mutableIds, id: argv.id, kind, draft: argv.draft, comment, message };

  if (argv.dryRun) {
    outputMsGraphCliResult(msGraphCliDryRunOutput([microsoftGraphRespondToMessageRequest(input)]));
  } else {
    if (!argv.draft) {
      requireMsGraphCliConfirmation({ yes: argv.yes, action: kind === 'forward' ? 'forward this message' : 'send this reply' });
    }

    const draft = await respondToMessage(graphContext)(input);
    outputMsGraphCliResult(draft ? msGraphCliDraftOutput(draft) : { sent: true, id: argv.id });
  }
}

function respondOptions(yargs: Argv) {
  return msGraphCliConfirmOptions(msGraphCliDryRunOptions(msGraphCliBodyOptions(msGraphCliMailboxOptions(yargs))))
    .positional('id', { type: 'string', demandOption: true, describe: 'The message to answer' })
    .option('comment', { type: 'string', describe: 'Text above the quoted original. Not with --body / --body-file' })
    .option('to', { type: 'string', array: true, describe: 'Recipient addresses (repeat, or comma-separated)' })
    .option('cc', { type: 'string', array: true, describe: 'Cc addresses (repeat, or comma-separated)' })
    .option('draft', { type: 'boolean', default: false, describe: 'Create the draft (createReply / createReplyAll / createForward) instead of sending; needs no --yes' });
}

export const MAIL_REPLY_COMMAND: CommandModule = {
  command: 'reply <id>',
  describe: 'Reply (or --all: reply all) on the thread. Needs --yes unless --draft',
  builder: (yargs: Argv) =>
    respondOptions(yargs)
      .option('all', { type: 'boolean', default: false, describe: 'Reply to every recipient (replyAll)' })
      .example([
        ['$0 mail reply AAMk... --comment "Thanks, done." --yes', 'Reply above the quoted original'],
        ['$0 mail reply AAMk... --all --comment "See below." --draft', 'Create a reply-all draft to edit before sending']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => respondHandler(argv, graphContext, argv.all ? 'replyAll' : 'reply'))
};

export const MAIL_FORWARD_COMMAND: CommandModule = {
  command: 'forward <id>',
  describe: 'Forward a message to --to. Needs --yes unless --draft',
  builder: (yargs: Argv) => respondOptions(yargs).example([['$0 mail forward AAMk... --to grace@example.com --comment "FYI" --yes', 'Forward with a note']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => respondHandler(argv, graphContext, 'forward'))
};

// MARK: Move / Copy / Delete
function idsOptions(yargs: Argv) {
  return msGraphCliDryRunOptions(msGraphCliMailboxOptions(yargs)).positional('ids', { type: 'string', array: true, describe: 'Message ids' }).option('ids-file', { type: 'string', describe: 'A file of message ids: one per line, or a JSON array' });
}

async function moveOrCopyHandler(argv: any, graphContext: Parameters<typeof moveMessages>[0], copy: boolean): Promise<void> {
  const ids = await readMsGraphCliIdsOption({ ids: argv.ids, idsFile: argv.idsFile });
  const input = { mailbox: argv.mailbox, immutableIds: !argv.mutableIds, ids, destination: String(argv.to), copy };

  if (argv.dryRun) {
    outputMsGraphCliResult(
      msGraphCliDryRunOutput(
        ids.map((id) => microsoftGraphMoveMessageRequest({ ...input, id })),
        ids.length > 1 ? 'Sent through $batch, 20 per HTTP call.' : undefined
      )
    );
  } else {
    outputMsGraphCliResult(msGraphCliWriteResultsOutput(await moveMessages(graphContext)(input)));
  }
}

export const MAIL_MOVE_COMMAND: CommandModule = {
  command: 'move [ids..]',
  describe: 'Move messages to a folder ($batch when several). Immutable ids stay the same',
  builder: (yargs: Argv) =>
    idsOptions(yargs)
      .option('to', { type: 'string', demandOption: true, describe: 'The destination folder id or well-known name (inbox, archive, deleteditems, junkemail)' })
      .example([['$0 mail move AAMk1... AAMk2... --to archive', 'Archive two messages']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => moveOrCopyHandler(argv, graphContext, false))
};

export const MAIL_COPY_COMMAND: CommandModule = {
  command: 'copy [ids..]',
  describe: 'Copy messages to a folder; prints each copy as newId',
  builder: (yargs: Argv) =>
    idsOptions(yargs)
      .option('to', { type: 'string', demandOption: true, describe: 'The destination folder id or well-known name' })
      .example([['$0 mail copy AAMk... --to archive', 'Copy a message to Archive']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => moveOrCopyHandler(argv, graphContext, true))
};

export const MAIL_DELETE_COMMAND: CommandModule = {
  command: 'delete [ids..]',
  describe: 'Delete messages: moved to Deleted Items (recoverable), or --hard to delete permanently. $batch, per-id results. Needs --yes',
  builder: (yargs: Argv) =>
    msGraphCliConfirmOptions(idsOptions(yargs))
      .option('hard', { type: 'boolean', default: false, describe: 'Delete permanently (permanentDelete): skips Deleted Items and cannot be recovered' })
      .example([
        ['$0 mail delete AAMk1... AAMk2... --yes', 'Move two messages to Deleted Items'],
        ['$0 mail delete --ids-file ids.txt --hard --dry-run', 'Print the permanentDelete calls']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const ids = await readMsGraphCliIdsOption({ ids: argv.ids, idsFile: argv.idsFile });
    const input = { mailbox: argv.mailbox, immutableIds: !argv.mutableIds, ids, hard: argv.hard };

    if (argv.dryRun) {
      const requests: MicrosoftGraphRequestInput[] = microsoftGraphDeleteMessagesRequests(input);
      outputMsGraphCliResult(msGraphCliDryRunOutput(requests, ids.length > 1 ? 'Sent through $batch, 20 per HTTP call.' : undefined));
    } else {
      requireMsGraphCliConfirmation({ yes: argv.yes, action: `${argv.hard ? 'permanently delete' : 'delete'} ${ids.length} message(s)` });
      outputMsGraphCliResult(msGraphCliWriteResultsOutput(await deleteMessages(graphContext)(input)));
    }
  })
};

/**
 * The mail write subcommands, registered on `mail` next to the read commands.
 */
export const MAIL_WRITE_COMMANDS: readonly CommandModule[] = [MAIL_DRAFT_COMMAND, MAIL_SEND_COMMAND, MAIL_SEND_BULK_COMMAND, MAIL_REPLY_COMMAND, MAIL_FORWARD_COMMAND, MAIL_MOVE_COMMAND, MAIL_COPY_COMMAND, MAIL_DELETE_COMMAND];
