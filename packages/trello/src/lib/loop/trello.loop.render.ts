import { type Maybe } from '@dereekb/util';
import { type TrelloAction, type TrelloCard, type TrelloCommentCardActionData } from '../trello/trello.api.card.type';

/**
 * One `- **Label**: value` line in the header of a rendered card.
 */
export interface TrelloCardMarkdownHeaderField {
  readonly label: string;
  readonly value: string;
}

/**
 * A named block of the rendered card that the caller owns, kept between `<!-- <name>:begin -->` and
 * `<!-- <name>:end -->` markers so it survives a re-render (see {@link readTrelloMarkdownPreservedBlocks}).
 */
export interface TrelloCardMarkdownPreservedBlock {
  readonly name: string;
  /**
   * The `## ` heading rendered above the block.
   */
  readonly heading: string;
  /**
   * The block's current content. When empty, `placeholder` is rendered instead.
   */
  readonly content?: Maybe<string>;
  /**
   * Text rendered inside the markers when there is no content yet.
   */
  readonly placeholder?: Maybe<string>;
}

/**
 * An extra `## ` section rendered after the preserved blocks and before the description, e.g. an attachment list.
 */
export interface TrelloCardMarkdownSection {
  readonly heading: string;
  readonly lines: readonly string[];
}

/**
 * Input for {@link renderTrelloCardMarkdown}.
 */
export interface RenderTrelloCardMarkdownInput {
  readonly card: Pick<TrelloCard, 'id' | 'name' | 'desc' | 'url' | 'shortUrl' | 'dateLastActivity'>;
  readonly listName?: Maybe<string>;
  readonly labelNames?: Maybe<readonly string[]>;
  /**
   * The card's comment actions, in any order; they are rendered oldest first.
   */
  readonly comments?: Maybe<readonly TrelloAction<Partial<TrelloCommentCardActionData>>[]>;
  /**
   * Extra header lines, rendered after `Last activity`.
   */
  readonly headerFields?: Maybe<readonly TrelloCardMarkdownHeaderField[]>;
  /**
   * The time stamped as `Snapshot at`. Omit it to leave the line out, which keeps the output stable for diffing.
   */
  readonly snapshotAt?: Maybe<Date>;
  readonly preservedBlocks?: Maybe<readonly TrelloCardMarkdownPreservedBlock[]>;
  readonly sections?: Maybe<readonly TrelloCardMarkdownSection[]>;
}

/**
 * The begin marker of a preserved block.
 *
 * @param name - The block name.
 * @returns The marker comment.
 */
export function trelloMarkdownBlockBegin(name: string): string {
  return `<!-- ${name}:begin -->`;
}

/**
 * The end marker of a preserved block.
 *
 * @param name - The block name.
 * @returns The marker comment.
 */
export function trelloMarkdownBlockEnd(name: string): string {
  return `<!-- ${name}:end -->`;
}

/**
 * Renders a card as a self-contained markdown document — header fields, the caller's preserved blocks and sections,
 * the description, and the comment thread oldest first. The output is deterministic for a given input (no clock read
 * unless `snapshotAt` is passed), so it is safe to golden-test and to diff between runs.
 *
 * @param input - The card, its list / label names, comments, and the caller's extra fields, blocks and sections.
 * @returns The markdown, ending in a single newline.
 */
export function renderTrelloCardMarkdown(input: RenderTrelloCardMarkdownInput): string {
  const { card } = input;
  const labelNames = input.labelNames ?? [];
  const lines: string[] = [
    `# ${card.name}`,
    '',
    `- **Card ID**: \`${card.id}\``,
    `- **List**: ${input.listName || '—'}`,
    `- **Labels**: ${labelNames.length > 0 ? labelNames.join(', ') : '—'}`,
    `- **URL**: ${card.url ?? card.shortUrl ?? '—'}`,
    `- **Last activity**: ${card.dateLastActivity ?? '—'}`
  ];

  for (const field of input.headerFields ?? []) {
    lines.push(`- **${field.label}**: ${field.value}`);
  }

  if (input.snapshotAt != null) {
    lines.push(`- **Snapshot at**: ${input.snapshotAt.toISOString()}`);
  }

  lines.push('');

  for (const block of input.preservedBlocks ?? []) {
    const content = block.content?.trim() ? block.content.trim() : (block.placeholder ?? '');
    lines.push(`## ${block.heading}`, '', trelloMarkdownBlockBegin(block.name), content, trelloMarkdownBlockEnd(block.name), '');
  }

  for (const section of input.sections ?? []) {
    lines.push(`## ${section.heading}`, '', ...section.lines, '');
  }

  const desc = (card.desc ?? '').trim();
  lines.push('## Description', '', desc.length > 0 ? desc : '_(no description)_', '', '## Comments', '');

  const comments = [...(input.comments ?? [])].sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());

  if (comments.length === 0) {
    lines.push('_(no comments)_');
  } else {
    for (const comment of comments) {
      const author = comment.memberCreator?.fullName ?? comment.memberCreator?.username ?? 'unknown';
      const text = (comment.data?.text ?? '').trim();
      lines.push(`### ${comment.date ?? '?'} — ${author}`, '', text || '_(empty)_', '');
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Reads the preserved blocks out of a previously rendered card, so a re-render can carry them forward.
 *
 * @param markdown - The previous render.
 * @param names - Only read these blocks. Defaults to every well-formed block found.
 * @returns Block name → its trimmed content. A block with no end marker is skipped.
 */
export function readTrelloMarkdownPreservedBlocks(markdown: string, names?: Maybe<readonly string[]>): Record<string, string> {
  const result: Record<string, string> = {};
  const wanted = names ?? Array.from(markdown.matchAll(/<!-- ([\w.-]+):begin -->/g)).map((match) => match[1]);

  for (const name of wanted) {
    const begin = trelloMarkdownBlockBegin(name);
    const start = markdown.indexOf(begin);
    const end = start < 0 ? -1 : markdown.indexOf(trelloMarkdownBlockEnd(name), start + begin.length);

    if (start >= 0 && end >= 0) {
      result[name] = markdown.slice(start + begin.length, end).trim();
    }
  }

  return result;
}

/**
 * Replaces the preserved blocks of a fresh render with the content they had in the previous one, so text a caller
 * (or an agent) wrote inside a block survives the re-render. Blocks the previous render did not have keep their fresh
 * content.
 *
 * @param fresh - The new render.
 * @param previous - The previous render, or nothing.
 * @returns The fresh render with the previous block contents carried forward.
 */
export function mergeTrelloMarkdownPreservedBlocks(fresh: string, previous: Maybe<string>): string {
  let result = fresh;

  if (previous != null) {
    const kept = readTrelloMarkdownPreservedBlocks(previous);

    for (const [name, content] of Object.entries(kept)) {
      const begin = trelloMarkdownBlockBegin(name);
      const start = result.indexOf(begin);
      const end = start < 0 ? -1 : result.indexOf(trelloMarkdownBlockEnd(name), start + begin.length);

      if (start >= 0 && end >= 0 && content.length > 0) {
        result = `${result.slice(0, start + begin.length)}\n${content}\n${result.slice(end)}`;
      }
    }
  }

  return result;
}
