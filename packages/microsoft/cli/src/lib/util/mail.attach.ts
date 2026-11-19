import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphContext, type MicrosoftGraphDriveItemRefInput, type MicrosoftGraphFileAttachmentInput, MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_MAX_BYTES, getDriveItem, microsoftGraphDownloadDriveItemRequest } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Argv } from 'yargs';
import { msGraphCliDriveOptions, resolveMsGraphCliDriveId } from '../commands/files.command';
import { msGraphCliContentTypeForFile } from '../commands/request.command';
import { downloadMsGraphCliFile } from './file.download';
import { readMsGraphCliAttachments } from './mail.write';

/**
 * The driveItem fields read before a drive file is attached: its name and size, and whether it is a file at all.
 */
export const MSGRAPH_CLI_DRIVE_ATTACHMENT_SELECT = 'id,name,size,file,folder,package';

/**
 * Adds `--attach`, the local files a reply or forward attaches. A new message gets it from `msGraphCliComposeOptions`.
 *
 * @param yargs - The command's yargs.
 * @returns The yargs, with the option added.
 */
export function msGraphCliAttachFileOptions<T>(yargs: Argv<T>) {
  return yargs.option('attach', { type: 'string', array: true, describe: 'Local files to attach (repeat). Over 3 MB: uploaded to the draft in a session, up to 150 MB' });
}

/**
 * Adds the options that attach OneDrive / SharePoint files (`--attach-item`) and pick the drive they are read from
 * (`--drive`, or `--site` with `--library`).
 *
 * @param yargs - The command's yargs.
 * @returns The yargs, with the options added.
 */
export function msGraphCliAttachItemOptions<T>(yargs: Argv<T>) {
  return msGraphCliDriveOptions(yargs).option('attach-item', {
    type: 'string',
    array: true,
    describe: 'OneDrive / SharePoint files to attach (repeat): a drive item id, or a path from the drive root starting with "/". Read from --drive / --site [--library], default your own OneDrive. The CLI downloads each and attaches it as a file'
  });
}

/**
 * A OneDrive / SharePoint file to attach.
 */
export type MsGraphCliDriveAttachmentRef = Pick<MicrosoftGraphDriveItemRefInput, 'driveId' | 'id' | 'path'>;

/**
 * Turns `--attach-item` values into drive item references: a value starting with `/` is a path from the drive
 * root, anything else an item id.
 *
 * @param values - The `--attach-item` values.
 * @param driveId - The drive they are read from, or undefined for the user's own OneDrive.
 * @returns The references, in order.
 */
export function parseMsGraphCliAttachItemOption(values: Maybe<readonly unknown[]>, driveId?: Maybe<string>): MsGraphCliDriveAttachmentRef[] {
  return (values ?? [])
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0)
    .map((x) => (x.startsWith('/') ? { driveId, path: x } : { driveId, id: x }));
}

/**
 * A drive file's details, read before it is downloaded.
 */
export interface MsGraphCliDriveAttachmentInfo {
  readonly ref: MsGraphCliDriveAttachmentRef;
  readonly name: string;
  readonly size: number;
  readonly contentType: string;
}

/**
 * Reads a drive item's name, size and content type, refusing what cannot be attached.
 *
 * @param graphContext - The Graph context.
 * @param ref - The drive item.
 * @returns The item's details; `ref` carries the resolved item id.
 * @throws {CliError} `INVALID_ARGUMENT` for a folder, a OneNote notebook, or a file over 150 MB.
 */
export async function readMsGraphCliDriveAttachmentInfo(graphContext: MicrosoftGraphContext, ref: MsGraphCliDriveAttachmentRef): Promise<MsGraphCliDriveAttachmentInfo> {
  const item = await getDriveItem(graphContext)({ ...ref, select: MSGRAPH_CLI_DRIVE_ATTACHMENT_SELECT });
  const label = ref.path ?? ref.id;

  if (item.folder != null || item.package != null || item.file == null) {
    throw new CliError({ message: `--attach-item ${label} is not a file (a folder or a OneNote notebook cannot be attached).`, code: 'INVALID_ARGUMENT', suggestion: 'Attach the files inside it one by one; files list <folderId> shows them.' });
  }

  const size = item.size ?? 0;

  if (size > MICROSOFT_GRAPH_MESSAGE_ATTACHMENT_MAX_BYTES) {
    throw new CliError({ message: `--attach-item ${label} is ${size} bytes, over the 150 MB Outlook attachment limit.`, code: 'INVALID_ARGUMENT', suggestion: 'Send a sharing link to the file instead.' });
  }

  return { ref: { driveId: ref.driveId, id: item.id }, name: item.name ?? 'attachment', size, contentType: item.file.mimeType ?? msGraphCliContentTypeForFile(item.name ?? '') };
}

/**
 * Downloads a drive file into memory as an attachment, through Graph's `/contentStream` (no redirect to SharePoint).
 * The bytes stream through a private temporary file (with the download engine's idle timeout and length check),
 * which is removed afterwards.
 *
 * @param graphContext - The Graph context.
 * @param info - The file, from {@link readMsGraphCliDriveAttachmentInfo}.
 * @returns The attachment.
 */
export async function downloadMsGraphCliDriveAttachment(graphContext: MicrosoftGraphContext, info: MsGraphCliDriveAttachmentInfo): Promise<MicrosoftGraphFileAttachmentInput> {
  const dir = await mkdtemp(join(tmpdir(), 'msgraph-cli-attach-'));

  try {
    const out = join(dir, 'item');
    // contentStream: Graph serves the bytes itself, where /content redirects to SharePoint, a host a sandbox may block
    await downloadMsGraphCliFile({ graphContext, request: microsoftGraphDownloadDriveItemRequest({ ...info.ref, contentStream: true }), out });
    return { name: info.name, contentType: info.contentType, bytes: new Uint8Array(await readFile(out)) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * What {@link readMsGraphCliMessageAttachments} reads: the attachments, and the drive files they include.
 */
export interface MsGraphCliMessageAttachments {
  /**
   * Local files, then drive files. Empty in a dry run's drive part: drive files are only described there.
   */
  readonly attachments: MicrosoftGraphFileAttachmentInput[];
  /**
   * The drive files, read and (unless a dry run) downloaded.
   */
  readonly driveFiles: MsGraphCliDriveAttachmentInfo[];
}

/**
 * Reads the attachments the options name: the local `--attach` files, then the `--attach-item` drive files. A dry
 * run reads the drive files' details but downloads nothing.
 *
 * @param input - The parsed options, the Graph context and whether this is a dry run.
 * @param input.argv - The parsed options (`attach`, `attachItem`, `drive`, `site`, `library`).
 * @param input.graphContext - The Graph context, needed only for `--attach-item`.
 * @param input.dryRun - Read the drive files' details only.
 * @returns The attachments and the drive files.
 * @throws {CliError} `INVALID_ARGUMENT` for `--drive` / `--site` without `--attach-item`, or a drive item that cannot be attached.
 */
export async function readMsGraphCliMessageAttachments(input: { readonly argv: any; readonly graphContext?: Maybe<MicrosoftGraphContext>; readonly dryRun?: Maybe<boolean> }): Promise<MsGraphCliMessageAttachments> {
  const { argv, graphContext, dryRun } = input;
  const attachments = await readMsGraphCliAttachments(argv.attach);
  const hasItems = (argv.attachItem ?? []).length > 0;
  const driveFiles: MsGraphCliDriveAttachmentInfo[] = [];

  if (!hasItems && (argv.drive || argv.site || argv.library)) {
    throw new CliError({ message: '--drive / --site / --library only pick the drive --attach-item reads from.', code: 'INVALID_ARGUMENT', suggestion: 'Add --attach-item <id or /path>, or drop the drive option.' });
  }

  if (hasItems) {
    if (!graphContext) {
      throw new CliError({ message: '--attach-item needs a Graph token.', code: 'INVALID_ARGUMENT' });
    }

    const driveId = await resolveMsGraphCliDriveId(graphContext, argv);

    for (const ref of parseMsGraphCliAttachItemOption(argv.attachItem, driveId)) {
      const info = await readMsGraphCliDriveAttachmentInfo(graphContext, ref);
      driveFiles.push(info);

      if (!dryRun) {
        attachments.push(await downloadMsGraphCliDriveAttachment(graphContext, info));
      }
    }
  }

  return { attachments, driveFiles };
}

/**
 * Describes the drive files a dry run would download and attach, for its note.
 *
 * @param driveFiles - The drive files.
 * @returns The note, or undefined when there are none.
 */
export function msGraphCliDriveAttachmentsNote(driveFiles: readonly MsGraphCliDriveAttachmentInfo[]): Maybe<string> {
  const files = driveFiles.map((x) => x.name + ' (' + String(x.size) + ' bytes)').join(', ');
  return driveFiles.length > 0 ? `Then ${driveFiles.length} OneDrive / SharePoint file(s) are downloaded (GET …/contentStream) and attached: ${files}.` : undefined;
}
