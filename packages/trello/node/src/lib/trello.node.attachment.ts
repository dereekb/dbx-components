import { type TrelloAttachment, type TrelloAttachmentId, type TrelloCardId, type TrelloContext, downloadCardAttachment, listCardAttachments } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sanitizeTrelloFileName } from './trello.node.file';

/**
 * The suffix of a download in progress; renamed onto the final name once complete.
 */
const PARTIAL_SUFFIX = '.partial';

/**
 * Matches the `<attachmentId>__` prefix of a synced attachment file.
 */
const ATTACHMENT_ID_PREFIX_REGEX = /^([a-f0-9]{8,})__/i;

/**
 * One attachment's outcome in {@link syncTrelloCardAttachments}.
 */
export interface TrelloCardAttachmentSyncEntry {
  readonly attachmentId: TrelloAttachmentId;
  readonly name: string;
  /**
   * `downloaded` (fetched now), `cached` (already on disk at the right size), `link` (a url attachment, nothing to
   * download), or `error`.
   */
  readonly status: 'downloaded' | 'cached' | 'link' | 'error';
  /**
   * The source attachment record (its `mimeType`, the api's `bytes`, `previews`, …).
   */
  readonly attachment: TrelloAttachment;
  /**
   * The file name inside the sync directory, for an uploaded attachment.
   */
  readonly file?: Maybe<string>;
  /**
   * The size of the file on disk. The size the api reports is `attachment.bytes`.
   */
  readonly bytes?: Maybe<number>;
  readonly url?: Maybe<string>;
  readonly error?: Maybe<string>;
}

/**
 * The result of {@link syncTrelloCardAttachments}.
 */
export interface TrelloCardAttachmentSync {
  readonly dir: string;
  readonly entries: readonly TrelloCardAttachmentSyncEntry[];
  /**
   * The `<attachmentId>__` files removed from the directory: those of attachments no longer on the card, a renamed
   * attachment's old file, and leftover `.partial` downloads.
   */
  readonly removed: readonly string[];
}

/**
 * Input for {@link syncTrelloCardAttachments}.
 */
export interface SyncTrelloCardAttachmentsInput {
  readonly trelloContext: TrelloContext;
  readonly cardId: TrelloCardId;
  /**
   * The directory to mirror the card's uploaded attachments into. Created when missing.
   */
  readonly dir: string;
  /**
   * The card's attachments, when already loaded.
   */
  readonly attachments?: Maybe<readonly TrelloAttachment[]>;
  /**
   * Vetoes a removal. Called only for a file the sync would otherwise remove; returning true keeps it.
   */
  readonly keepFile?: Maybe<(fileName: string) => boolean>;
}

/**
 * The file name an attachment is mirrored to: `<attachmentId>__<sanitized name>`, so two attachments with the same name
 * never collide.
 *
 * The name is the attachment's `fileName`, else its `name`, else (when `name` is missing, as with a narrow `fields`
 * read) its id, sanitized with {@link sanitizeTrelloFileName}, which gives `attachment` when nothing is left. An upload
 * with an empty `fileName` and `name` is therefore `<id>__attachment`. This matches dbx-claude's local attachment
 * names, so adopting the kit renames and re-downloads nothing.
 *
 * @param attachment - The attachment.
 * @returns The file name.
 */
export function trelloCardAttachmentFileName(attachment: Pick<TrelloAttachment, 'id' | 'name' | 'fileName'>): string {
  // Typed Maybe: `name` can be missing at runtime when the attachments were read with a narrow `fields` list.
  const raw: Maybe<string> = attachment.fileName || attachment.name;
  return `${attachment.id}__${sanitizeTrelloFileName(raw ?? attachment.id)}`;
}

/**
 * Mirrors a card's uploaded attachments into a directory.
 *
 * - a file already there at the attachment's byte size is kept (`cached`);
 * - anything else is downloaded to a `.partial` file and renamed into place, so an interrupted sync never leaves a
 *   truncated file under the final name;
 * - url attachments are reported as `link` and not fetched.
 *
 * One attachment failing to download is reported as `error` and does not stop the others.
 *
 * Cleanup only ever touches files named with an `<attachmentId>__` prefix; anything else in the directory is left
 * alone. Of those it keeps:
 *
 * - the file of every attachment still on the card (see {@link trelloCardAttachmentFileName});
 * - every `<file>.<suffix>` beside one, such as an agent's `<file>.note.md`, for links too (a link has no file, but a
 *   note may sit beside its would-be name);
 * - anything `keepFile` returns true for.
 *
 * and removes the rest: the files (and siblings) of attachments no longer on the card, the old file (and old siblings)
 * of an attachment whose local name changed, and leftover `.partial` downloads.
 *
 * @param input - The context, the card and the directory.
 * @returns What happened to each attachment and which stale files were removed.
 */
export async function syncTrelloCardAttachments(input: SyncTrelloCardAttachmentsInput): Promise<TrelloCardAttachmentSync> {
  const { trelloContext, cardId, dir, keepFile } = input;
  const attachments = input.attachments ?? (await listCardAttachments(trelloContext)({ cardId }));
  const download = downloadCardAttachment(trelloContext);
  const entries: TrelloCardAttachmentSyncEntry[] = [];

  await mkdir(dir, { recursive: true });

  for (const attachment of attachments) {
    const base = { attachmentId: attachment.id, name: attachment.name, attachment };

    if (attachment.isUpload) {
      const file = trelloCardAttachmentFileName(attachment);
      const path = join(dir, file);
      const sizeOnDisk = await stat(path)
        .then((x) => x.size)
        .catch(() => undefined);

      if (sizeOnDisk != null && attachment.bytes != null && sizeOnDisk === attachment.bytes) {
        entries.push({ ...base, status: 'cached', file, bytes: sizeOnDisk });
      } else {
        try {
          const bytes = new Uint8Array(await (await download({ cardId, attachmentId: attachment.id, attachment })).arrayBuffer());
          await writeFile(`${path}${PARTIAL_SUFFIX}`, bytes);
          await rename(`${path}${PARTIAL_SUFFIX}`, path);
          entries.push({ ...base, status: 'downloaded', file, bytes: bytes.length });
        } catch (e) {
          await rm(`${path}${PARTIAL_SUFFIX}`, { force: true });
          entries.push({ ...base, status: 'error', file, error: e instanceof Error ? e.message : String(e) });
        }
      }
    } else {
      entries.push({ ...base, status: 'link', url: attachment.url });
    }
  }

  const current = attachments.map(trelloCardAttachmentFileName);
  const removed: string[] = [];

  for (const file of await readdir(dir)) {
    if (ATTACHMENT_ID_PREFIX_REGEX.test(file)) {
      const isPartial = file.endsWith(PARTIAL_SUFFIX);
      const isCurrent = current.some((x) => file === x || (!isPartial && file.startsWith(`${x}.`)));

      if (!isCurrent && !keepFile?.(file)) {
        await rm(join(dir, file), { force: true });
        removed.push(file);
      }
    }
  }

  return { dir, entries, removed };
}
