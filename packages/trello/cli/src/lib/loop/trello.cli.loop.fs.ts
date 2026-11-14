import { type CliJsonStore, createCliJsonStore } from '@dereekb/dbx-cli';
import { type TrelloActionId, type TrelloAttachment, type TrelloAttachmentId, type TrelloBoardId, type TrelloBoardSnapshot, type TrelloCardId, type TrelloContext, downloadCardAttachment, listCardAttachments, mergeTrelloMarkdownPreservedBlocks } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { sanitizeTrelloCliFileName } from '../util/option';

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
   * The file name inside the sync directory, for an uploaded attachment.
   */
  readonly file?: Maybe<string>;
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
   * Files of attachments no longer on the card, removed from the directory.
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
}

/**
 * The file name an attachment is mirrored to: `<attachmentId>__<sanitized file name>`, so two attachments with the same
 * name never collide and a renamed attachment replaces its old file.
 *
 * @param attachment - The attachment.
 * @returns The file name.
 */
export function trelloCardAttachmentFileName(attachment: Pick<TrelloAttachment, 'id' | 'name' | 'fileName'>): string {
  return `${attachment.id}__${sanitizeTrelloCliFileName(attachment.fileName || attachment.name || attachment.id)}`;
}

/**
 * Mirrors a card's uploaded attachments into a directory.
 *
 * - a file already there at the attachment's byte size is kept (`cached`);
 * - anything else is downloaded to a `.partial` file and renamed into place, so an interrupted sync never leaves a
 *   truncated file under the final name;
 * - files of attachments no longer on the card (by their `<id>__` prefix) are removed;
 * - url attachments are reported as `link` and not fetched.
 *
 * One attachment failing to download is reported as `error` and does not stop the others.
 *
 * @param input - The context, the card and the directory.
 * @returns What happened to each attachment and which stale files were removed.
 */
export async function syncTrelloCardAttachments(input: SyncTrelloCardAttachmentsInput): Promise<TrelloCardAttachmentSync> {
  const { trelloContext, cardId, dir } = input;
  const attachments = input.attachments ?? (await listCardAttachments(trelloContext)({ cardId }));
  const download = downloadCardAttachment(trelloContext);
  const entries: TrelloCardAttachmentSyncEntry[] = [];

  await mkdir(dir, { recursive: true });

  for (const attachment of attachments) {
    if (attachment.isUpload) {
      const file = trelloCardAttachmentFileName(attachment);
      const path = join(dir, file);
      const sizeOnDisk = await stat(path)
        .then((x) => x.size)
        .catch(() => undefined);

      if (sizeOnDisk != null && attachment.bytes != null && sizeOnDisk === attachment.bytes) {
        entries.push({ attachmentId: attachment.id, name: attachment.name, status: 'cached', file, bytes: sizeOnDisk });
      } else {
        try {
          const bytes = new Uint8Array(await (await download({ cardId, attachmentId: attachment.id, attachment })).arrayBuffer());
          await writeFile(`${path}${PARTIAL_SUFFIX}`, bytes);
          await rename(`${path}${PARTIAL_SUFFIX}`, path);
          entries.push({ attachmentId: attachment.id, name: attachment.name, status: 'downloaded', file, bytes: bytes.length });
        } catch (e) {
          await rm(`${path}${PARTIAL_SUFFIX}`, { force: true });
          entries.push({ attachmentId: attachment.id, name: attachment.name, status: 'error', file, error: e instanceof Error ? e.message : String(e) });
        }
      }
    } else {
      entries.push({ attachmentId: attachment.id, name: attachment.name, status: 'link', url: attachment.url });
    }
  }

  const keep = new Set(entries.map((x) => x.file).filter((x): x is string => x != null));
  const removed: string[] = [];

  for (const file of await readdir(dir)) {
    const isSynced = ATTACHMENT_ID_PREFIX_REGEX.test(file) || file.endsWith(PARTIAL_SUFFIX);

    if (isSynced && !keep.has(file)) {
      await rm(join(dir, file), { force: true });
      removed.push(file);
    }
  }

  return { dir, entries, removed };
}

/**
 * Input for {@link writeMarkdownPreservingBlocks}.
 */
export interface WriteMarkdownPreservingBlocksInput {
  /**
   * The markdown file to write.
   */
  readonly path: string;
  /**
   * The fresh render.
   */
  readonly markdown: string;
}

/**
 * The result of {@link writeMarkdownPreservingBlocks}.
 */
export interface WriteMarkdownPreservingBlocksResult {
  readonly path: string;
  /**
   * Whether the file's content changed (false when the merged render equals what was on disk).
   */
  readonly changed: boolean;
  /**
   * The content now on disk.
   */
  readonly markdown: string;
}

/**
 * Writes a fresh render over a markdown file, carrying forward the content of its preserved blocks
 * (`<!-- name:begin -->` … `<!-- name:end -->`) from the version on disk, so notes written inside a block survive a
 * re-render. Writes through a temp file and a rename, and only when the content changed.
 *
 * @param input - The path and the fresh render.
 * @returns The path, whether it changed, and the merged content.
 */
export async function writeMarkdownPreservingBlocks(input: WriteMarkdownPreservingBlocksInput): Promise<WriteMarkdownPreservingBlocksResult> {
  const { path } = input;
  const previous = await readFile(path, 'utf8').catch(() => undefined);
  const markdown = mergeTrelloMarkdownPreservedBlocks(input.markdown, previous);
  const changed = markdown !== previous;

  if (changed) {
    await mkdir(dirname(path), { recursive: true });
    const tempPath = `${path}.${process.pid}.tmp`;
    await writeFile(tempPath, markdown);
    await rename(tempPath, path);
  }

  return { path, changed, markdown };
}

/**
 * What trello-cli saves per board for the loop commands.
 */
export interface TrelloCliBoardState {
  /**
   * The snapshot `board changes --save` / `board snapshot --save` stored last.
   */
  readonly snapshot?: Maybe<TrelloBoardSnapshot>;
  /**
   * The newest action id `board activity --save` has read.
   */
  readonly activityWatermark?: Maybe<TrelloActionId | string>;
  /**
   * The newest mention `board mentions --save` has reported.
   */
  readonly mentionWatermark?: Maybe<TrelloActionId>;
}

/**
 * Input for {@link trelloCliBoardStateStore}.
 */
export interface TrelloCliBoardStateStoreInput {
  /**
   * The command's state directory (`ctx.stateDir()`).
   */
  readonly stateDir: string;
  readonly boardId: TrelloBoardId;
}

/**
 * The saved state of one board: `<stateDir>/boards/<board>.json` (mode 0600), written atomically.
 *
 * @param input - The state directory and the board.
 * @returns The store.
 */
export function trelloCliBoardStateStore(input: TrelloCliBoardStateStoreInput): CliJsonStore<TrelloCliBoardState> {
  return createCliJsonStore<TrelloCliBoardState>({ filePath: join(input.stateDir, 'boards', `${sanitizeTrelloCliFileName(input.boardId)}.json`) });
}
