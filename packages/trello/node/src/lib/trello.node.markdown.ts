import { mergeTrelloMarkdownPreservedBlocks } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

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
  /**
   * Only carry these blocks forward from the file on disk. Omit it to carry every well-formed block, including a
   * marker pair that sits inside a description or a comment, which is then frozen across re-renders. Pass the names of
   * the blocks you render.
   */
  readonly names?: Maybe<readonly string[]>;
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
 * @param input - The path, the fresh render and the names of the blocks to carry.
 * @returns The path, whether it changed, and the merged content.
 */
export async function writeMarkdownPreservingBlocks(input: WriteMarkdownPreservingBlocksInput): Promise<WriteMarkdownPreservingBlocksResult> {
  const { path } = input;
  const previous = await readFile(path, 'utf8').catch(() => undefined);
  const markdown = mergeTrelloMarkdownPreservedBlocks(input.markdown, previous, input.names);
  const changed = markdown !== previous;

  if (changed) {
    await mkdir(dirname(path), { recursive: true });
    const tempPath = `${path}.${process.pid}.tmp`;
    await writeFile(tempPath, markdown);
    await rename(tempPath, path);
  }

  return { path, changed, markdown };
}
