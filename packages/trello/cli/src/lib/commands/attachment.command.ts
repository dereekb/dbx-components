import { CliError } from '@dereekb/dbx-cli';
import { addAttachmentToCard, deleteAttachmentFromCard, downloadCardAttachment, getCardAttachment, listCardAttachments } from '@dereekb/trello';
import { sanitizeTrelloFileName } from '@dereekb/trello/node';
import { type Maybe } from '@dereekb/util';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join, sep } from 'node:path';
import type { Argv } from 'yargs';
import { type TrelloCliCommand } from '../context/cli.command';
import { trelloCliDownloadError } from '../util/download';
import { parseTrelloCliCardArg, requireTrelloCliConfirmation, withTrelloCliCardPositional } from '../util/option';

const attachmentPositional = (yargs: Argv) => withTrelloCliCardPositional(yargs).positional('attachmentId', { type: 'string', demandOption: true, describe: 'The attachment id (from attachment list)' });

const listCommand: TrelloCliCommand = {
  command: 'list <card>',
  describe: "List a card's attachments",
  builder: withTrelloCliCardPositional,
  handler: async (argv, ctx) => ctx.output.result(await listCardAttachments(ctx.trelloContext)({ cardId: parseTrelloCliCardArg(argv['card']) }))
};

const addCommand: TrelloCliCommand = {
  command: 'add <card>',
  describe: 'Attach a file (--file) or a link (--url) to a card',
  builder: (yargs: Argv) =>
    withTrelloCliCardPositional(yargs)
      .option('file', { type: 'string', describe: 'Upload this file' })
      .option('url', { type: 'string', describe: 'Attach this link' })
      .option('name', { type: 'string', describe: 'The attachment name (default: the file name or url)' })
      .option('mime-type', { type: 'string', describe: 'The file MIME type (default: application/octet-stream)' })
      .option('set-cover', { type: 'boolean', describe: 'Use the attachment as the card cover' })
      .conflicts('file', 'url')
      .example([
        ['$0 attachment add AbCd1234 --file ./screenshot.png', 'Upload a file'],
        ['$0 attachment add AbCd1234 --url https://example.com/spec --name Spec', 'Attach a link']
      ]),
  handler: async (argv, ctx) => {
    const file = argv['file'] as Maybe<string>;
    const url = argv['url'] as Maybe<string>;

    if (!file && !url) {
      throw new CliError({ message: 'Pass --file <path> or --url <url>.', code: 'INVALID_ARGUMENT' });
    }

    const attachment = await addAttachmentToCard(ctx.trelloContext)({
      cardId: parseTrelloCliCardArg(argv['card']),
      name: (argv['name'] as Maybe<string>) ?? undefined,
      setCover: (argv['set-cover'] as Maybe<boolean>) ?? undefined,
      ...(file ? { file: { content: new Uint8Array(await readFile(file)), fileName: basename(file), mimeType: (argv['mime-type'] as Maybe<string>) ?? undefined } } : { url: url as string })
    });

    ctx.output.result(attachment);
  }
};

const downloadCommand: TrelloCliCommand = {
  command: 'download <card> <attachmentId>',
  describe: 'Download an uploaded attachment to a file (stdout gets the path and byte count, never the bytes)',
  builder: (yargs: Argv) => attachmentPositional(yargs).option('out', { type: 'string', describe: 'The file to write, or a directory to write into: an existing one, or one ending in "/" (created when missing). Default: the current directory' }),
  handler: async (argv, ctx) => {
    const cardId = parseTrelloCliCardArg(argv['card']);
    const attachmentId = String(argv['attachmentId']);
    const attachment = await getCardAttachment(ctx.trelloContext)({ cardId, attachmentId });

    if (!attachment.isUpload) {
      throw new CliError({ message: 'The attachment is a link, not an uploaded file.', code: 'INVALID_ARGUMENT', suggestion: `Open its url instead: ${attachment.url}` });
    }

    const fileName = sanitizeTrelloFileName(attachment.fileName || attachment.name);
    const out = (argv['out'] as Maybe<string>) ?? '.';
    const isDir =
      out.endsWith('/') ||
      out.endsWith(sep) ||
      (await stat(out)
        .then((x) => x.isDirectory())
        .catch(() => false));
    const path = isDir ? join(out, fileName) : out;
    let bytes: Uint8Array;

    try {
      const download = await downloadCardAttachment(ctx.downloadTrelloContext)({ cardId, attachmentId, attachment });
      bytes = new Uint8Array(await download.arrayBuffer());
    } catch (e) {
      throw trelloCliDownloadError(e, ctx);
    }

    await mkdir(isDir ? out : join(path, '..'), { recursive: true });

    await writeFile(path, bytes);
    ctx.output.result({ file: path, bytes: bytes.length, attachmentId, mimeType: attachment.mimeType ?? null });
  }
};

const deleteCommand: TrelloCliCommand = {
  command: 'delete <card> <attachmentId>',
  describe: 'Delete an attachment (needs --yes)',
  builder: (yargs: Argv) => attachmentPositional(yargs).option('yes', { type: 'boolean', default: false, describe: 'Confirm the deletion' }),
  handler: async (argv, ctx) => {
    requireTrelloCliConfirmation(argv, 'Deleting an attachment');
    const cardId = parseTrelloCliCardArg(argv['card']);
    await deleteAttachmentFromCard(ctx.trelloContext)({ cardId, attachmentId: String(argv['attachmentId']) });
    ctx.output.result({ deleted: true, cardId, attachmentId: String(argv['attachmentId']) });
  }
};

/**
 * The `attachment` command.
 */
export const TRELLO_CLI_ATTACHMENT_COMMAND: TrelloCliCommand = {
  command: 'attachment',
  describe: 'Card attachments: list, add, download, delete',
  subcommands: [listCommand, addCommand, downloadCommand, deleteCommand]
};
