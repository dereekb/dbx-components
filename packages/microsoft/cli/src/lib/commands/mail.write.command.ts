import { CliError } from '@dereekb/dbx-cli';
import {
  type MicrosoftGraphContext,
  type MicrosoftGraphFileAttachmentInput,
  type MicrosoftGraphMessage,
  type MicrosoftGraphOutgoingMessageInput,
  type MicrosoftGraphRequestInput,
  type MicrosoftGraphRespondToMessageInput,
  MICROSOFT_GRAPH_DELETED_ITEMS_FOLDER,
  MICROSOFT_GRAPH_MESSAGE_INLINE_ATTACHMENT_MAX_BYTES,
  addMessageAttachment,
  createDraftMessage,
  deleteMessages,
  microsoftGraphAddMessageAttachmentRequest,
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
import { resolve } from 'node:path';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCliPaths } from '../config/cli.config';
import { msGraphCommandHandler } from '../middleware/auth.middleware';
import { type MsGraphCliConnectionSettings, type MsGraphCliServerSettingsSource, msGraphCliServerDefaults } from '../util/connection.settings';
import { type MsGraphCliDriveAttachmentInfo, msGraphCliAttachFileOptions, msGraphCliAttachItemOptions, msGraphCliDriveAttachmentsNote, readMsGraphCliMessageAttachments } from '../util/mail.attach';
import { MSGRAPH_CLI_BULK_MAX_PER_MINUTE, parseMsGraphCliBulkRecipients, planMsGraphCliBulkSend, readMsGraphCliBulkProgress, sendMsGraphCliBulkMail } from '../util/mail.bulk';
import {
  appendMsGraphCliSignature,
  appendMsGraphCliSignatureToComment,
  isMsGraphCliHtmlFile,
  msGraphCliBodyOptions,
  msGraphCliComposeOptions,
  msGraphCliConfirmOptions,
  msGraphCliDryRunOptions,
  MSGRAPH_CLI_WRITE_RESULTS_MAX_ROWS,
  msGraphCliDryRunOutput,
  msGraphCliSignatureAttachments,
  msGraphCliWriteResultsOutput,
  parseMsGraphCliAddressesOption,
  readMsGraphCliBodyOption,
  readMsGraphCliSignature,
  requireMsGraphCliConfirmation,
  runMsGraphCliMessageWrites,
  splitMsGraphCliAttachments
} from '../util/mail.write';
import {
  DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER,
  MSGRAPH_CLI_MAIL_SELECTION_SUGGESTION,
  checkMsGraphCliMailSelectionFolders,
  msGraphCliMailSelectionOptions,
  msGraphCliMailTargetMode,
  msGraphCliMaxSecondsOption,
  readMsGraphCliCategoryOption,
  readMsGraphCliMailSelection,
  readMsGraphCliWholeNumberOption,
  runMsGraphCliMailSelectionWrite
} from '../util/mail.select';
import { type MsGraphCliMailTagMode, runMsGraphCliMailTag } from '../util/mail.tag';
import {
  type MsGraphCliUndoJournalKind,
  type MsGraphCliUndoJournalWriter,
  MSGRAPH_CLI_UNDO_LIST_MAX,
  MSGRAPH_CLI_UNDO_MAX_JOURNALS,
  findMsGraphCliPendingUndoJournal,
  listMsGraphCliUndoJournals,
  msGraphCliUndoListRows,
  msGraphCliUndoOutput,
  openMsGraphCliUndoJournal,
  readMsGraphCliUndoJournal,
  undoMsGraphCliJournal
} from '../util/mail.undo';
import { msGraphCliMailboxOptions, readMsGraphCliIdsOption } from '../util/option';
import { outputMsGraphCliResult } from '../util/output';

/**
 * A composed message: the fields sent in the first call, and the attachments too large to send inline.
 */
export interface MsGraphCliComposedMessage {
  readonly message: MicrosoftGraphOutgoingMessageInput;
  readonly largeAttachments: NonNullable<MicrosoftGraphOutgoingMessageInput['attachments']>;
  /**
   * The OneDrive / SharePoint files attached (`--attach-item`). A dry run only reads their details, so they are
   * not in `message` or `largeAttachments` there.
   */
  readonly driveFiles: MsGraphCliDriveAttachmentInfo[];
}

/**
 * Composes a message from the compose options: recipients, subject, body with the signature appended, and
 * attachments (the signature's inline images first, then `--attach` files, then `--attach-item` drive files) split
 * into inline and large.
 *
 * @param argv - The parsed arguments.
 * @param options - Whether to append the signature to the body, the server defaults, and the Graph context for drive files.
 * @param options.signature - Append the signature (a new message's body); false for a PATCH that leaves the body alone.
 * @param options.serverSettings - Reads the server defaults, consulted when no flag or local signature applies.
 * @param options.graphContext - Reads and downloads the `--attach-item` drive files.
 * @param options.dryRun - Read the drive files' details only; download nothing.
 * @returns The composed message.
 * @throws {CliError} `INVALID_ARGUMENT` when the signature's images are too large to send inline.
 */
export async function composeMsGraphCliMessage(argv: any, options: { readonly signature: boolean; readonly serverSettings?: Maybe<() => Promise<Maybe<MsGraphCliConnectionSettings>>>; readonly graphContext?: Maybe<MicrosoftGraphContext>; readonly dryRun?: Maybe<boolean> }): Promise<MsGraphCliComposedMessage> {
  const signature = options.signature ? await readMsGraphCliSignature({ ...argv, serverSettings: options.serverSettings }) : undefined;
  const body = appendMsGraphCliSignature(await readMsGraphCliBodyOption(argv), signature);
  const { attachments, driveFiles } = await readMsGraphCliMessageAttachments({ argv, graphContext: options.graphContext, dryRun: options.dryRun });
  const { inline, large } = splitMsGraphCliAttachments([...msGraphCliSignatureAttachments(body, signature), ...attachments]);

  if (large.some((x) => x.isInline)) {
    throw new CliError({ message: 'The signature images are 3 MB or more together, too large to send inline.', code: 'INVALID_ARGUMENT', suggestion: 'Shrink the images, or use web URLs for them in the signature file.' });
  }

  const message: MicrosoftGraphOutgoingMessageInput = {
    subject: argv.subject,
    body,
    to: parseMsGraphCliAddressesOption('to', argv.to),
    cc: parseMsGraphCliAddressesOption('cc', argv.cc),
    bcc: parseMsGraphCliAddressesOption('bcc', argv.bcc),
    from: argv.sendAs,
    attachments: inline.length > 0 ? inline : undefined
  };

  return { message, largeAttachments: large, driveFiles };
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

function joinNotes(...notes: Maybe<string>[]): Maybe<string> {
  const present = notes.filter((x): x is string => !!x);
  return present.length > 0 ? present.join(' ') : undefined;
}

// MARK: Draft
export const MAIL_DRAFT_CREATE_COMMAND: CommandModule = {
  command: 'create',
  describe: 'Create a draft in Drafts (not sent). Prints its immutable id',
  builder: (yargs: Argv) =>
    msGraphCliAttachItemOptions(msGraphCliDryRunOptions(msGraphCliComposeOptions(msGraphCliMailboxOptions(yargs)))).example([
      ['$0 mail draft create --to ada@example.com --subject "Hello" --body-file note.html', 'An HTML draft with the saved signature'],
      ['$0 mail draft create --to ada@example.com --subject "Report" --body "Attached." --attach report.pdf', 'A draft with an attachment (over 3 MB uploads in a session)'],
      ['$0 mail draft create --to ada@example.com --subject "COI" --body "Attached." --site https://contoso.sharepoint.com/sites/Ops --attach-item "/Insurance/COI 2026.pdf"', 'Attach a SharePoint file by path']
    ]),
  handler: msGraphCommandHandler(async (argv: any, context) => {
    const { graphContext } = context;
    const defaults = msGraphCliServerDefaults(argv, context);
    const { message, largeAttachments, driveFiles } = await composeMsGraphCliMessage(argv, { signature: true, serverSettings: defaults.serverSettings, graphContext, dryRun: argv.dryRun });
    const input = { mailbox: argv.mailbox, immutableIds: !argv.mutableIds, message };

    if (argv.dryRun) {
      outputMsGraphCliResult(msGraphCliDryRunOutput([microsoftGraphCreateDraftRequest(input)], joinNotes(largeAttachmentNote(largeAttachments.length), msGraphCliDriveAttachmentsNote(driveFiles)), defaults.warnings));
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
  handler: msGraphCommandHandler(async (argv: any, context) => {
    const { graphContext } = context;

    if (argv.attach?.length) {
      throw new CliError({ message: 'mail draft update cannot add attachments.', code: 'INVALID_ARGUMENT', suggestion: 'Create a new draft with --attach, or attach in Outlook.' });
    }

    // the signature is appended only when a new body replaces the old one
    const defaults = msGraphCliServerDefaults(argv, context);
    const { message } = await composeMsGraphCliMessage(argv, { signature: argv.body != null || argv.bodyFile != null, serverSettings: defaults.serverSettings });
    const input = { mailbox: argv.mailbox, immutableIds: !argv.mutableIds, id: argv.id, message };

    if (argv.dryRun) {
      outputMsGraphCliResult(msGraphCliDryRunOutput([microsoftGraphDraftStateRequest(input), microsoftGraphUpdateDraftRequest(input)], 'The GET checks isDraft first; a sent message is refused before the PATCH.', defaults.warnings));
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
    msGraphCliAttachItemOptions(msGraphCliConfirmOptions(msGraphCliDryRunOptions(msGraphCliComposeOptions(msGraphCliMailboxOptions(yargs)))))
      .positional('draftId', { type: 'string', describe: 'A draft to send. Without it, the message is composed from --to / --subject / --body' })
      .option('save', { type: 'boolean', default: true, describe: 'Save the sent copy to Sent Items (--no-save to skip; one-shot send only)' })
      .example([
        ['$0 mail send AAMk... --yes', 'Send a draft'],
        ['$0 mail send --to ada@example.com --subject "Hi" --body "Thanks!" --yes', 'Compose and send in one call'],
        ['$0 mail send --mailbox support@example.com --to ada@example.com --subject "Re: ticket" --body-file reply.html --yes', 'Send from a shared mailbox (saved to its Sent Items)'],
        ['$0 mail send --to ada@example.com --subject "Hi" --body "x" --dry-run', 'Print the Graph call, recipients redacted to counts']
      ]),
  handler: msGraphCommandHandler(async (argv: any, context) => {
    const { graphContext } = context;

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
      const defaults = msGraphCliServerDefaults(argv, context);
      const { message, largeAttachments, driveFiles } = await composeMsGraphCliMessage(argv, { signature: true, serverSettings: defaults.serverSettings, graphContext, dryRun: argv.dryRun });

      if (!message.to?.length || message.subject == null) {
        throw new CliError({ message: 'A new message needs --to and --subject (or pass a draft id to send a draft).', code: 'INVALID_ARGUMENT' });
      }

      if (largeAttachments.length > 0 || driveFiles.reduce((total, x) => total + x.size, 0) >= MICROSOFT_GRAPH_MESSAGE_INLINE_ATTACHMENT_MAX_BYTES) {
        throw new CliError({ message: 'Attachments of 3 MB or more cannot go in a one-shot send.', code: 'INVALID_ARGUMENT', suggestion: 'Create a draft with mail draft create --attach … / --attach-item …, then send it with mail send <draftId> --yes.' });
      }

      const input = { mailbox: argv.mailbox, message, saveToSentItems: argv.save !== false };
      const recipients = (message.to?.length ?? 0) + (message.cc?.length ?? 0) + (message.bcc?.length ?? 0);

      if (argv.dryRun) {
        outputMsGraphCliResult(msGraphCliDryRunOutput([microsoftGraphSendMailRequest(input)], msGraphCliDriveAttachmentsNote(driveFiles), defaults.warnings));
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
      .option('signature-file', { type: 'string', describe: "Append this signature. Default: the saved signature-file of the address sent as, else the app's server default for it" })
      .option('signature', { type: 'boolean', default: true, describe: 'Append the signature (--no-signature to skip)' })
      .example([
        ['$0 mail send-bulk --file subs.csv --template invite.html --subject "Hi {{name}}" --dry-run', 'Counts and the first Graph call, recipients redacted'],
        ['$0 mail send-bulk --file subs.csv --template invite.html --subject "Hi {{name}}" --yes', 'Send; re-run the same command to resume after an interruption']
      ]),
  handler: msGraphCommandHandler(async (argv: any, context) => {
    const { graphContext } = context;
    const defaults = msGraphCliServerDefaults(argv, context);
    const file = String(argv.file);
    const rows = parseMsGraphCliBulkRecipients(await readFile(file, 'utf8'), /\.json$/i.test(file) ? 'json' : 'csv');
    const progressFile = argv.progressFile ?? `${file}.progress.json`;
    const progress = await readMsGraphCliBulkProgress(progressFile);
    const html = argv.html || isMsGraphCliHtmlFile(argv.template);
    const template = { subject: argv.subject, body: await readFile(argv.template, 'utf8'), html, signature: await readMsGraphCliSignature({ ...argv, serverSettings: defaults.serverSettings }), mailbox: argv.mailbox, sendAs: argv.sendAs, saveToSentItems: argv.save !== false };
    const plan = planMsGraphCliBulkSend({ rows, progress, template, limit: argv.limit });

    if (argv.dryRun) {
      const first = plan.toSend[0]?.request;
      outputMsGraphCliResult({
        ...msGraphCliDryRunOutput(first ? [first] : [], `Only the first of ${plan.toSend.length} sendMail calls is shown. They go in $batch calls of up to 10, paced to ${MSGRAPH_CLI_BULK_MAX_PER_MINUTE} messages a minute.`, defaults.warnings),
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
async function respondHandler(argv: any, context: MsGraphCliServerSettingsSource & { readonly graphContext: Parameters<typeof respondToMessage>[0] }, kind: 'reply' | 'replyAll' | 'forward'): Promise<void> {
  const { graphContext } = context;

  if (argv.comment != null && (argv.body != null || argv.bodyFile != null)) {
    // models: M-d (message-reply) — a comment and a message body together answer 400
    throw new CliError({ message: 'Pass --comment or --body / --body-file, not both: Graph rejects a comment with a message body.', code: 'INVALID_ARGUMENT', suggestion: '--comment keeps the quoted original below your text; --body replaces the reply body.' });
  }

  const defaults = msGraphCliServerDefaults(argv, context);
  const signature = await readMsGraphCliSignature({ ...argv, serverSettings: defaults.serverSettings });
  const body = await readMsGraphCliBodyOption(argv);
  const to = parseMsGraphCliAddressesOption('to', argv.to);
  const cc = parseMsGraphCliAddressesOption('cc', argv.cc);

  if (kind === 'forward' && !argv.draft && !to?.length) {
    throw new CliError({ message: 'mail forward needs --to.', code: 'INVALID_ARGUMENT' });
  }

  const comment = argv.comment == null ? undefined : appendMsGraphCliSignatureToComment(String(argv.comment), signature);
  const messageBody = comment == null ? appendMsGraphCliSignature(body, signature) : undefined;
  const message: MicrosoftGraphOutgoingMessageInput = { body: messageBody, to, cc };
  const images = msGraphCliSignatureAttachments(comment == null ? messageBody : { contentType: 'html', content: comment }, signature);
  const { attachments: files, driveFiles } = await readMsGraphCliMessageAttachments({ argv, graphContext, dryRun: argv.dryRun });
  const { inline, large } = splitMsGraphCliAttachments([...images, ...files]);
  const input: MicrosoftGraphRespondToMessageInput = { mailbox: argv.mailbox, immutableIds: !argv.mutableIds, id: argv.id, kind, draft: argv.draft, comment, message };

  if (large.some((x) => x.isInline)) {
    throw new CliError({ message: 'The signature images are 3 MB or more together, too large to send inline.', code: 'INVALID_ARGUMENT', suggestion: 'Shrink the images, or use web URLs for them in the signature file.' });
  }

  if (argv.dryRun) {
    const viaDraft = inline.length > 0 || large.length > 0 || driveFiles.length > 0;
    const noun = kind === 'forward' ? 'forward' : 'reply';
    const note = viaDraft ? joinNotes(`The ${noun} carries attachments, so its draft is created, the attachments are added to it, and it is then sent (unless --draft).`, largeAttachmentNote(large.length), msGraphCliDriveAttachmentsNote(driveFiles)) : undefined;
    outputMsGraphCliResult(msGraphCliDryRunOutput(msGraphCliRespondRequests({ input, attachments: inline, viaDraft }), note, defaults.warnings));
  } else {
    if (!argv.draft) {
      requireMsGraphCliConfirmation({ yes: argv.yes, action: kind === 'forward' ? 'forward this message' : 'send this reply' });
    }

    // the signature's images ride along inline; only the --attach / --attach-item files are reported
    const draft = inline.length + large.length > 0 ? await respondMsGraphCliViaDraft({ graphContext, input, attachments: inline, largeAttachments: large }) : await respondToMessage(graphContext)(input);
    outputMsGraphCliResult(draft && argv.draft ? msGraphCliDraftOutput(draft, large.length) : { sent: true, id: argv.id, ...(files.length > 0 ? { attachments: files.length } : {}) });
  }
}

/**
 * Returns the Graph calls a reply or forward makes. With attachments (the signature's images, `--attach` and
 * `--attach-item` files) it goes through its draft: a reply or forward carries no attachments in one call, so the
 * draft is created, each attachment is added to it, and it is then sent unless `draft`.
 *
 * @param config - The response, its inline attachments, and whether it goes through its draft.
 * @param config.input - The reply or forward.
 * @param config.attachments - The attachments added to the draft in one POST each.
 * @param config.viaDraft - Go through the draft even with no `attachments` (large or drive files are added later). Defaults to whether there are attachments.
 * @returns The requests, in order; `{draftId}` stands for the draft's id.
 */
export function msGraphCliRespondRequests(config: { readonly input: MicrosoftGraphRespondToMessageInput; readonly attachments: readonly MicrosoftGraphFileAttachmentInput[]; readonly viaDraft?: Maybe<boolean> }): MicrosoftGraphRequestInput[] {
  const { input, attachments } = config;
  const viaDraft = config.viaDraft ?? attachments.length > 0;
  let result: MicrosoftGraphRequestInput[];

  if (viaDraft) {
    const draftRef = { mailbox: input.mailbox, id: '{draftId}' };
    result = [microsoftGraphRespondToMessageRequest({ ...input, draft: true }), ...attachments.map((attachment) => microsoftGraphAddMessageAttachmentRequest({ ...draftRef, attachment })), ...(input.draft ? [] : [microsoftGraphSendDraftRequest(draftRef)])];
  } else {
    result = [microsoftGraphRespondToMessageRequest(input)];
  }

  return result;
}

/**
 * Answers a message through its draft, so attachments can be added: creates the reply or forward draft, adds each
 * inline-sized attachment, uploads each large one in a session, then sends it unless `input.draft`.
 *
 * @param config - The Graph context, the response and the attachments.
 * @param config.graphContext - The Graph context.
 * @param config.input - The reply or forward.
 * @param config.attachments - Attachments small enough for one POST each (the signature's images among them).
 * @param config.largeAttachments - Attachments of 3 MB or more, uploaded in sessions.
 * @returns The draft.
 */
async function respondMsGraphCliViaDraft(config: {
  readonly graphContext: MicrosoftGraphContext;
  readonly input: MicrosoftGraphRespondToMessageInput;
  readonly attachments: readonly MicrosoftGraphFileAttachmentInput[];
  readonly largeAttachments: readonly MicrosoftGraphFileAttachmentInput[];
}): Promise<Maybe<MicrosoftGraphMessage>> {
  const { graphContext, input, attachments, largeAttachments } = config;
  const draft = await respondToMessage(graphContext)({ ...input, draft: true });

  if (draft) {
    for (const attachment of attachments) {
      await addMessageAttachment(graphContext)({ mailbox: input.mailbox, id: draft.id, attachment });
    }

    for (const attachment of largeAttachments) {
      await uploadMessageAttachment(graphContext)({ mailbox: input.mailbox, id: draft.id, attachment });
    }

    if (!input.draft) {
      await sendDraftMessage(graphContext)({ mailbox: input.mailbox, id: draft.id });
    }
  }

  return draft;
}

function respondOptions(yargs: Argv) {
  return msGraphCliAttachItemOptions(msGraphCliAttachFileOptions(msGraphCliConfirmOptions(msGraphCliDryRunOptions(msGraphCliBodyOptions(msGraphCliMailboxOptions(yargs))))))
    .positional('id', { type: 'string', demandOption: true, describe: 'The message to answer' })
    .option('comment', { type: 'string', describe: 'Text above the quoted original. Not with --body / --body-file' })
    .option('to', { type: 'string', array: true, describe: 'Recipient addresses (repeat, or comma-separated)' })
    .option('cc', { type: 'string', array: true, describe: 'Cc addresses (repeat, or comma-separated)' })
    .option('draft', { type: 'boolean', default: false, describe: 'Create the draft (createReply / createReplyAll / createForward) instead of sending; needs no --yes' });
}

export const MAIL_REPLY_COMMAND: CommandModule = {
  command: 'reply <id>',
  describe: 'Reply (or --all: reply all) on the thread, optionally with --attach / --attach-item files. Needs --yes unless --draft',
  builder: (yargs: Argv) =>
    respondOptions(yargs)
      .option('all', { type: 'boolean', default: false, describe: 'Reply to every recipient (replyAll)' })
      .example([
        ['$0 mail reply AAMk... --comment "Thanks, done." --yes', 'Reply above the quoted original'],
        ['$0 mail reply AAMk... --all --comment "See below." --draft', 'Create a reply-all draft to edit before sending'],
        ['$0 mail reply AAMk... --comment "Our COI is attached." --site https://contoso.sharepoint.com/sites/Ops --attach-item "/Insurance/COI 2026.pdf" --yes', 'Reply with a SharePoint file attached'],
        ['$0 mail reply AAMk... --comment "Signed copy attached." --attach signed.pdf --draft', 'A reply draft with a local file attached']
      ]),
  handler: msGraphCommandHandler(async (argv: any, context) => respondHandler(argv, context, argv.all ? 'replyAll' : 'reply'))
};

export const MAIL_FORWARD_COMMAND: CommandModule = {
  command: 'forward <id>',
  describe: 'Forward a message to --to, optionally with --attach / --attach-item files. Needs --yes unless --draft',
  builder: (yargs: Argv) =>
    respondOptions(yargs).example([
      ['$0 mail forward AAMk... --to grace@example.com --comment "FYI" --yes', 'Forward with a note'],
      ['$0 mail forward AAMk... --to grace@example.com --comment "Plan attached." --attach-item 01ABCDEF... --yes', 'Forward with a OneDrive file attached (by item id)']
    ]),
  handler: msGraphCommandHandler(async (argv: any, context) => respondHandler(argv, context, 'forward'))
};

// MARK: Move / Copy / Delete
const IDS_POSITIONAL_DESCRIBE = 'Message ids. Pass every id in ONE call: they go through $batch, 20 per HTTP call';

function idsOptions(yargs: Argv, idsDescribe = IDS_POSITIONAL_DESCRIBE) {
  return msGraphCliDryRunOptions(msGraphCliMailboxOptions(yargs))
    .positional('ids', { type: 'string', array: true, describe: idsDescribe })
    .option('ids-file', { type: 'string', describe: 'A file of message ids: one per line, a JSON array, or the saved JSON output of mail list / mail search (--all-pages --pick id)' })
    .option('all-results', { type: 'boolean', default: false, describe: `Print a row for every id. Default: above ${MSGRAPH_CLI_WRITE_RESULTS_MAX_ROWS} ids a move or delete prints only the failed rows and counts the rest in "omitted"` });
}

/**
 * The ids options plus the selection options of `mail delete` / `mail move`.
 *
 * @param yargs - The command's yargs.
 * @returns The yargs, with the options added.
 */
function idsOrSelectionOptions(yargs: Argv) {
  return msGraphCliMailSelectionOptions(idsOptions(yargs, `${IDS_POSITIONAL_DESCRIBE}. Or pass no ids and select by filter in the same call: --folder, --from, --since, --until, --unread, --has-attachments, --category, --search`));
}

/**
 * Adds `--undo-file` and `--no-undo` to `mail move` / `mail delete`.
 *
 * @param yargs - The command's yargs.
 * @returns The yargs, with the options added.
 */
function undoOptions(yargs: Argv) {
  return yargs
    .option('undo', { type: 'boolean', default: true, describe: `Save an undo journal (<configDir>/undo, newest ${MSGRAPH_CLI_UNDO_MAX_JOURNALS} kept) and print undo.command; mail undo moves the messages back. --no-undo skips it` })
    .option('undo-file', { type: 'string', describe: 'Write the undo journal to this file instead (never pruned)' });
}

/**
 * Prepares the run's undo journal before anything is changed, unless `--no-undo`.
 *
 * @param argv - The parsed arguments.
 * @param kind - The journal kind.
 * @returns The writer, or undefined with `--no-undo`.
 */
async function openUndoJournal(argv: any, kind: MsGraphCliUndoJournalKind): Promise<Maybe<MsGraphCliUndoJournalWriter>> {
  let result: Maybe<MsGraphCliUndoJournalWriter>;

  if (argv.undo === false) {
    if (argv.undoFile) {
      throw new CliError({ message: '--undo-file and --no-undo contradict each other.', code: 'INVALID_ARGUMENT', suggestion: 'Drop one of them.' });
    }
  } else {
    result = await openMsGraphCliUndoJournal({ configDir: msGraphCliPaths().configDir, kind, file: argv.undoFile ? resolve(String(argv.undoFile)) : undefined });
  }

  return result;
}

/**
 * Adds `undo: { file, command }` to an output when the run wrote a journal.
 *
 * @param output - The run's output.
 * @param journal - The run's journal.
 * @param argv - The parsed arguments (`tokenSource`).
 * @returns The output.
 */
function withUndoOutput<T extends object>(output: T, journal: Maybe<MsGraphCliUndoJournalWriter>, argv: any): T {
  return journal?.written() ? { ...output, undo: msGraphCliUndoOutput(journal.file, typeof argv.tokenSource === 'string' ? argv.tokenSource : undefined) } : output;
}

function hasIdsArgument(argv: any): boolean {
  return (argv.ids ?? []).some((x: unknown) => String(x).length > 0) || Boolean(argv.idsFile);
}

function progressLine(line: string): void {
  process.stderr.write(`${line}\n`);
}

function writeResultsMaxRows(argv: any, copy = false): Maybe<number> {
  // a copy's new ids are its result, so every row is printed
  return copy || argv.allResults ? undefined : MSGRAPH_CLI_WRITE_RESULTS_MAX_ROWS;
}

async function moveOrCopyHandler(argv: any, graphContext: MicrosoftGraphContext, copy: boolean): Promise<void> {
  const startedAt = Date.now();
  const input = { mailbox: argv.mailbox, immutableIds: !argv.mutableIds, destination: String(argv.to), copy };
  const selection = copy ? undefined : readMsGraphCliMailSelection(argv);
  const mode = selection ? msGraphCliMailTargetMode({ hasIds: hasIdsArgument(argv), selection }) : 'ids';

  if (selection && mode !== 'ids') {
    checkMsGraphCliMailSelectionFolders({ command: 'move', folder: selection.folder, to: input.destination });
    const journal = argv.dryRun ? undefined : await openUndoJournal(argv, 'move');
    const output = await runMsGraphCliMailSelectionWrite({
      graphContext,
      command: 'move',
      mode,
      selection,
      mailbox: input.mailbox,
      immutableIds: input.immutableIds,
      to: input.destination,
      dryRun: argv.dryRun,
      startedAt,
      label: 'mail move',
      verb: 'moves',
      writeRequest: (id) => microsoftGraphMoveMessageRequest({ ...input, id }),
      send: (ids, maxRetryAfterSeconds) => moveMessages(graphContext)({ ...input, ids, maxRetryAfterSeconds }),
      progress: progressLine,
      maxRows: writeResultsMaxRows(argv),
      journal
    });
    outputMsGraphCliResult(withUndoOutput(output, journal, argv));
  } else {
    const ids = await readMsGraphCliIdsOption({ ids: argv.ids, idsFile: argv.idsFile, suggestion: copy ? undefined : MSGRAPH_CLI_MAIL_SELECTION_SUGGESTION });

    if (argv.dryRun) {
      outputMsGraphCliResult(
        msGraphCliDryRunOutput(
          ids.map((id) => microsoftGraphMoveMessageRequest({ ...input, id })),
          ids.length > 1 ? 'Sent through $batch, 20 per HTTP call.' : undefined
        )
      );
    } else {
      const journal = copy ? undefined : await openUndoJournal(argv, 'move');
      // an ids run does not know the messages' folders, so mail undo needs --to
      await journal?.begin({ mailbox: input.mailbox, immutableIds: input.immutableIds, source: null, destination: { given: input.destination } });
      const results = await runMsGraphCliMessageWrites({ ids, label: copy ? 'mail copy' : 'mail move', progress: progressLine, send: (group) => moveMessages(graphContext)({ ...input, ids: group }), afterGroup: journal?.append });
      await journal?.finish();
      outputMsGraphCliResult(withUndoOutput(msGraphCliWriteResultsOutput(results, { maxRows: writeResultsMaxRows(argv, copy) }), journal, argv));
    }
  }
}

export const MAIL_MOVE_COMMAND: CommandModule = {
  command: 'move [ids..]',
  describe: `Move messages to a folder: selected by filter in the same call (--folder, default ${DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER}, plus --from/--since/…/--search), or by ids. Many at once through $batch (20 per HTTP call), with a per-id result. Immutable ids stay the same`,
  builder: (yargs: Argv) =>
    undoOptions(idsOrSelectionOptions(yargs))
      .option('to', { type: 'string', demandOption: true, describe: 'The destination folder id or well-known name (inbox, archive, deleteditems, junkemail)' })
      .example([
        ['$0 mail move --folder inbox --from alerts@example.com --to archive', 'Archive every inbox message from one sender in one call (re-run while complete is false; mail undo moves them back)'],
        ['$0 mail move --folder deleteditems --category "msgraph-cli: delete" --to inbox', 'Restore tagged messages from Deleted Items, from any later session'],
        ['$0 mail move --mailbox shared@example.com --folder AAMk... --since 2026-01-01 --to AAMk... --dry-run', 'Count and preview a move between two folders of a shared mailbox'],
        ['$0 mail move AAMk1... AAMk2... --to archive', 'Archive two messages by id']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => moveOrCopyHandler(argv, graphContext, false))
};

export const MAIL_COPY_COMMAND: CommandModule = {
  command: 'copy [ids..]',
  describe: 'Copy messages to a folder ($batch when several); prints each copy as newId. Ids only (a copy never leaves its folder, so a selection would copy again on every re-run)',
  builder: (yargs: Argv) =>
    idsOptions(yargs)
      .option('to', { type: 'string', demandOption: true, describe: 'The destination folder id or well-known name' })
      .example([['$0 mail copy AAMk... --to archive', 'Copy a message to Archive']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => moveOrCopyHandler(argv, graphContext, true))
};

export const MAIL_DELETE_COMMAND: CommandModule = {
  command: 'delete [ids..]',
  describe: `Delete messages: moved to Deleted Items (recoverable), or --hard to delete permanently. Selected by filter in the same call (--folder, default ${DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER}, plus --from/--since/…/--search), or by ids. Many at once through $batch (20 per HTTP call), with a per-id result. Needs --yes`,
  builder: (yargs: Argv) =>
    msGraphCliConfirmOptions(undoOptions(idsOrSelectionOptions(yargs)))
      .option('hard', {
        type: 'boolean',
        default: false,
        describe: "Delete permanently (permanentDelete): skips Deleted Items and you can't recover it (it sits in Recoverable Items › Purges until the retention period ends). With a filter selection: only from --folder deleteditems"
      })
      .example([
        ['$0 mail delete --mailbox billing@example.com --folder inbox --from noreply@vendor.com --yes', 'Delete every inbox message from one sender in one call (hundreds are fine; re-run while complete is false)'],
        ['$0 mail delete --folder inbox --from noreply@vendor.com --dry-run', 'Count the matches and print a sample of the calls, writing nothing'],
        ['$0 mail delete --folder inbox --search "subject:invoice from:ramp.com" --yes', 'Delete the inbox hits of a KQL search'],
        ['$0 mail delete --folder inbox --category "msgraph-cli: delete" --yes', 'Delete exactly the messages mail tag marked (review them first with mail list --category)'],
        ['$0 mail delete AAMk1... AAMk2... --yes', 'Move two messages to Deleted Items by id (mail undo --to inbox moves them back)'],
        ['$0 mail delete --folder deleteditems --from noreply@vendor.com --hard --yes', 'Purge them from Deleted Items (permanent)']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const startedAt = Date.now();
    const input = { mailbox: argv.mailbox, immutableIds: !argv.mutableIds, hard: argv.hard };
    const selection = readMsGraphCliMailSelection(argv);
    const mode = msGraphCliMailTargetMode({ hasIds: hasIdsArgument(argv), selection });
    const action = argv.hard ? 'permanently delete' : 'delete';

    if (mode === 'ids') {
      const ids = await readMsGraphCliIdsOption({ ids: argv.ids, idsFile: argv.idsFile, suggestion: MSGRAPH_CLI_MAIL_SELECTION_SUGGESTION });

      if (argv.dryRun) {
        const requests: MicrosoftGraphRequestInput[] = microsoftGraphDeleteMessagesRequests({ ...input, ids });
        outputMsGraphCliResult(msGraphCliDryRunOutput(requests, ids.length > 1 ? 'Sent through $batch, 20 per HTTP call.' : undefined));
      } else {
        requireMsGraphCliConfirmation({ yes: argv.yes, action: `${action} ${ids.length} message(s)` });
        // a --hard delete cannot be undone, so it writes no journal
        const journal = input.hard ? undefined : await openUndoJournal(argv, 'delete');
        await journal?.begin({ mailbox: input.mailbox, immutableIds: input.immutableIds, source: null, destination: { given: MICROSOFT_GRAPH_DELETED_ITEMS_FOLDER } });
        const results = await runMsGraphCliMessageWrites({ ids, label: 'mail delete', progress: progressLine, send: (group) => deleteMessages(graphContext)({ ...input, ids: group }), afterGroup: journal?.append });
        await journal?.finish();
        outputMsGraphCliResult(withUndoOutput(msGraphCliWriteResultsOutput(results, { maxRows: writeResultsMaxRows(argv) }), journal, argv));
      }
    } else {
      checkMsGraphCliMailSelectionFolders({ command: 'delete', folder: selection.folder, hard: input.hard });

      if (!argv.dryRun) {
        requireMsGraphCliConfirmation({ yes: argv.yes, action: `${action} the selected messages` });
      }

      const journal = argv.dryRun || input.hard ? undefined : await openUndoJournal(argv, 'delete');
      const output = await runMsGraphCliMailSelectionWrite({
        graphContext,
        command: 'delete',
        mode,
        selection,
        mailbox: input.mailbox,
        immutableIds: input.immutableIds,
        hard: input.hard,
        dryRun: argv.dryRun,
        startedAt,
        label: 'mail delete',
        verb: argv.hard ? 'permanently deletes' : 'deletes',
        writeRequest: (id) => microsoftGraphDeleteMessagesRequests({ ...input, ids: [id] })[0],
        send: (ids, maxRetryAfterSeconds) => deleteMessages(graphContext)({ ...input, ids, maxRetryAfterSeconds }),
        progress: progressLine,
        maxRows: writeResultsMaxRows(argv),
        journal
      });
      outputMsGraphCliResult(withUndoOutput(output, journal, argv));
    }
  })
};

// MARK: Undo
export const MAIL_UNDO_COMMAND: CommandModule = {
  command: 'undo [journal]',
  describe: 'Move the messages of a mail move or mail delete (not --hard) back where they came from, using its undo journal (default: the newest one with anything left to undo). Re-run while complete is false',
  builder: (yargs: Argv) =>
    msGraphCliMaxSecondsOption(msGraphCliDryRunOptions(yargs))
      .positional('journal', { type: 'string', describe: "The journal file: the run's undo.file. Default: the newest journal with anything left to undo" })
      .option('mailbox', { type: 'string', describe: "Only this mailbox's journals (the journal's own mailbox is always used; a different one is refused)" })
      .option('to', { type: 'string', describe: 'Move them here instead (folder id or well-known name). Required for a journal of an ids run, whose source folders are unknown' })
      .option('list', { type: 'boolean', default: false, describe: `List the newest ${MSGRAPH_CLI_UNDO_LIST_MAX} journals and exit` })
      .option('all-results', { type: 'boolean', default: false, describe: `Print a row for every id. Default: above ${MSGRAPH_CLI_WRITE_RESULTS_MAX_ROWS} ids only the failed rows` })
      .example([
        ['$0 mail undo', 'Move the last move or delete back'],
        ['$0 mail undo ~/.msgraph-cli/undo/20261119T020301Z-delete-3fa9c2d1.json', "Undo one run (its output's undo.command)"],
        ['$0 mail undo --list', 'List the saved journals'],
        ['$0 mail undo <journal> --to inbox', 'Undo an ids run (its folders are unknown) into the inbox']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const startedAt = Date.now();
    const configDir = msGraphCliPaths().configDir;

    if (argv.list) {
      outputMsGraphCliResult(msGraphCliUndoListRows(await listMsGraphCliUndoJournals(configDir), argv.mailbox));
    } else {
      const maxSeconds = readMsGraphCliWholeNumberOption('max-seconds', argv.maxSeconds, 0);
      const entry = argv.journal ? { file: resolve(String(argv.journal)), journal: await readMsGraphCliUndoJournal(resolve(String(argv.journal))) } : await findMsGraphCliPendingUndoJournal(configDir, argv.mailbox);
      const output = await undoMsGraphCliJournal({
        graphContext,
        ...entry,
        to: argv.to,
        mailbox: argv.mailbox,
        dryRun: argv.dryRun,
        maxSeconds,
        startedAt,
        progress: progressLine,
        maxRows: writeResultsMaxRows(argv)
      });
      outputMsGraphCliResult(output);
    }
  })
};

// MARK: Tag
async function tagHandler(argv: any, graphContext: MicrosoftGraphContext, mode: MsGraphCliMailTagMode): Promise<void> {
  const startedAt = Date.now();
  const name = readMsGraphCliCategoryOption(argv.category) as string;
  // the category is what a tag adds (not a filter), and what an untag always filters by
  const selection = { ...readMsGraphCliMailSelection({ ...argv, category: undefined }) };
  const target = msGraphCliMailTargetMode({ hasIds: hasIdsArgument(argv), selection, command: mode });
  const ids = target === 'ids' ? await readMsGraphCliIdsOption({ ids: argv.ids, idsFile: argv.idsFile, suggestion: mode === 'tag' ? MSGRAPH_CLI_MAIL_SELECTION_SUGGESTION : undefined }) : undefined;

  const output = await runMsGraphCliMailTag({
    graphContext,
    mode,
    name,
    target,
    ids,
    selection,
    mailbox: argv.mailbox,
    immutableIds: !argv.mutableIds,
    dryRun: argv.dryRun,
    startedAt,
    progress: progressLine,
    maxRows: writeResultsMaxRows(argv)
  });

  outputMsGraphCliResult(output);
}

const TAG_CATEGORY_DESCRIBE = 'The Outlook category. Use a dedicated name, e.g. "msgraph-cli: delete", so mail untag removes only what mail tag added';

export const MAIL_TAG_COMMAND: CommandModule = {
  command: 'tag [ids..]',
  describe: `Mark messages with an Outlook --category, to review them (in Outlook, or mail list --category) before acting on exactly them with mail delete / mail move --category. Selected by filter in the same call (--folder, default ${DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER}, plus --from/--since/…/--search) or by ids; skips messages already tagged. Reverse with mail untag`,
  builder: (yargs: Argv) =>
    msGraphCliMailSelectionOptions(idsOptions(yargs, `${IDS_POSITIONAL_DESCRIBE}. Or pass no ids and select by filter in the same call: --folder, --from, --since, --until, --unread, --has-attachments, --search`))
      .option('category', { type: 'string', demandOption: true, describe: TAG_CATEGORY_DESCRIBE })
      .example([
        ['$0 mail tag --mailbox billing@example.com --folder inbox --from noreply@vendor.com --category "msgraph-cli: delete"', 'Mark every inbox message from one sender'],
        ['$0 mail list --mailbox billing@example.com --folder inbox --category "msgraph-cli: delete" --all-pages --pick id,subject,from', 'Review what was marked'],
        ['$0 mail delete --mailbox billing@example.com --folder inbox --category "msgraph-cli: delete" --yes', 'Then delete exactly those']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => tagHandler(argv, graphContext, 'tag'))
};

export const MAIL_UNTAG_COMMAND: CommandModule = {
  command: 'untag [ids..]',
  describe: 'Remove an Outlook --category from messages: every message that carries it, in every folder (or --folder, plus --from/--since/… filters), or by ids. Re-run while complete is false',
  builder: (yargs: Argv) =>
    msGraphCliMailSelectionOptions(idsOptions(yargs, `${IDS_POSITIONAL_DESCRIBE}. Or pass no ids: every message with the category is selected`), 'untag')
      .option('category', { type: 'string', demandOption: true, describe: TAG_CATEGORY_DESCRIBE })
      .example([
        ['$0 mail untag --mailbox billing@example.com --category "msgraph-cli: delete"', 'Drop the tag everywhere, including on deleted or moved messages'],
        ['$0 mail untag --folder inbox --category "msgraph-cli: delete" --dry-run', 'Count the inbox messages that carry it']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => tagHandler(argv, graphContext, 'untag'))
};

/**
 * The mail write subcommands, registered on `mail` next to the read commands.
 */
export const MAIL_WRITE_COMMANDS: readonly CommandModule[] = [MAIL_DRAFT_COMMAND, MAIL_SEND_COMMAND, MAIL_SEND_BULK_COMMAND, MAIL_REPLY_COMMAND, MAIL_FORWARD_COMMAND, MAIL_MOVE_COMMAND, MAIL_COPY_COMMAND, MAIL_DELETE_COMMAND, MAIL_TAG_COMMAND, MAIL_UNTAG_COMMAND, MAIL_UNDO_COMMAND];
