import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphChat, type MicrosoftGraphChatMessage, type MicrosoftGraphChatMessageSearchResource, type MicrosoftGraphChatType, type MicrosoftGraphSearchHit, microsoftGraphChatMatches, microsoftGraphSearchSummaryText } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { access, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHAT_FILE,
  MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHAT_MANIFEST_KIND,
  MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHATS_DIR,
  MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE,
  MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_KIND,
  type MsGraphCliTeamsChatDumpChatManifest,
  type MsGraphCliTeamsChatDumpManifest
} from './teams.chat.dump';
import { msGraphCliTeamsChatMessageSender, msGraphCliTeamsHtmlToMarkdown } from './teams.markdown';

/**
 * How many hits `teams chat search --dir` prints by default, newest first.
 */
export const DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_SEARCH_TOP = 50;

/**
 * How many message files are read at once.
 */
const READ_BATCH_SIZE = 64;

/**
 * How many characters of context a snippet keeps before and after the first match.
 */
const SNIPPET_BEFORE = 80;
const SNIPPET_AFTER = 160;

/**
 * One hit of `teams chat search`, from Graph or from a dump on disk.
 */
export interface MsGraphCliTeamsChatSearchHit {
  /**
   * The message id.
   */
  readonly id: string;
  readonly chatId?: Maybe<string>;
  /**
   * The chat's topic, else its members' names. Archive search only.
   */
  readonly chat?: Maybe<string>;
  /**
   * The team and channel of a channel message. Graph search only.
   */
  readonly channelIdentity?: Maybe<{ readonly teamId?: Maybe<string>; readonly channelId?: Maybe<string> }>;
  readonly createdDateTime?: Maybe<string>;
  readonly from?: Maybe<string>;
  /**
   * The text around the first match (archive), or Graph's summary.
   */
  readonly snippet: string;
  readonly webUrl?: Maybe<string>;
  /**
   * The message's Markdown file (or `.json` when the dump wrote no Markdown), relative to the dump directory.
   * Archive search only.
   */
  readonly file?: Maybe<string>;
  /**
   * Set on a message deleted after it was archived; its files hold the last archived text.
   */
  readonly deleted?: Maybe<true>;
}

/**
 * Builds the printed form of a Graph `chatMessage` search hit.
 *
 * @param hit - The hit.
 * @returns The output.
 */
export function msGraphCliTeamsChatSearchHitFromGraph(hit: MicrosoftGraphSearchHit<MicrosoftGraphChatMessageSearchResource>): MsGraphCliTeamsChatSearchHit {
  const resource = hit.resource ?? {};
  const from = resource.from;
  return {
    id: resource.id ?? hit.hitId ?? '',
    chatId: resource.chatId,
    channelIdentity: resource.channelIdentity?.teamId || resource.channelIdentity?.channelId ? resource.channelIdentity : undefined,
    createdDateTime: resource.createdDateTime,
    from: from?.emailAddress?.name || from?.user?.displayName || from?.emailAddress?.address || from?.application?.displayName || undefined,
    snippet: microsoftGraphSearchSummaryText(hit.summary),
    webUrl: resource.webUrl ?? resource.webLink
  };
}

// MARK: Matching
/**
 * Finds where a query first matches a text, or -1.
 */
export type MsGraphCliTeamsChatSearchMatcher = (text: string) => number;

/**
 * Builds the matcher of `teams chat search --dir`. Plain text matches when every word (or `"quoted phrase"`)
 * appears, without case unless `caseSensitive`; `regex` takes the query as a JavaScript regular expression. An empty
 * query matches every message, so the filters alone pick them.
 *
 * @param input - The query and how to read it.
 * @param input.query - The query.
 * @param input.regex - Whether the query is a regular expression.
 * @param input.caseSensitive - Whether case must match.
 * @returns The matcher.
 * @throws {CliError} `INVALID_ARGUMENT` for an invalid regular expression.
 */
export function msGraphCliTeamsChatSearchMatcher(input: { readonly query: string; readonly regex?: Maybe<boolean>; readonly caseSensitive?: Maybe<boolean> }): MsGraphCliTeamsChatSearchMatcher {
  let result: MsGraphCliTeamsChatSearchMatcher;

  if (input.regex) {
    let pattern: RegExp;

    try {
      pattern = new RegExp(input.query, input.caseSensitive ? 'u' : 'iu');
    } catch (e) {
      throw new CliError({ message: `Invalid --regex query: ${(e as Error).message}`, code: 'INVALID_ARGUMENT' });
    }

    result = (text) => text.search(pattern);
  } else {
    const fold = (x: string) => (input.caseSensitive ? x : x.toLowerCase());
    const terms = Array.from(input.query.matchAll(/"([^"]+)"|(\S+)/g), (x) => fold((x[1] ?? x[2]).trim())).filter(Boolean);

    result = (text) => {
      const folded = fold(text);
      const positions = terms.map((x) => folded.indexOf(x));
      let index: number;

      if (positions.includes(-1)) {
        index = -1;
      } else {
        index = positions.length > 0 ? Math.min(...positions) : 0;
      }

      return index;
    };
  }

  return result;
}

/**
 * Returns the searchable text of an archived chat message: its subject, its body as Markdown with image links reduced
 * to `[image]`, and its attachments' names.
 *
 * @param message - The archived message.
 * @returns The text.
 */
export function msGraphCliTeamsChatMessageSearchText(message: Pick<MicrosoftGraphChatMessage, 'subject' | 'body' | 'attachments'>): string {
  const attachments = message.attachments ?? [];
  const content = message.body?.content ?? '';
  const body = message.body?.contentType === 'html' ? msGraphCliTeamsHtmlToMarkdown(content, { attachmentName: (id) => attachments.find((x) => x.id === id)?.name }) : content;
  const names = attachments.map((x) => x.name).filter(Boolean);
  return [message.subject, body.replaceAll(/!\[[^\]]*\]\([^)]*\)/g, '[image]').replaceAll('[image: not downloaded]', '[image]'), ...names].filter(Boolean).join('\n');
}

/**
 * Returns the text around a match, on one line, with `…` where it was cut.
 *
 * @param text - The text.
 * @param index - Where the match starts.
 * @returns The snippet.
 */
export function msGraphCliTeamsChatSearchSnippet(text: string, index: number): string {
  const start = Math.max(0, index - SNIPPET_BEFORE);
  const end = Math.min(text.length, index + SNIPPET_AFTER);
  const middle = text.slice(start, end).replaceAll(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${middle}${end < text.length ? '…' : ''}`;
}

// MARK: Archive search
/**
 * Configuration of {@link searchMsGraphCliTeamsChatDump}.
 */
export interface MsGraphCliTeamsChatDumpSearchConfig {
  /**
   * A `teams chat dump` directory.
   */
  readonly dir: string;
  readonly query: string;
  readonly regex?: Maybe<boolean>;
  readonly caseSensitive?: Maybe<boolean>;
  /**
   * Only this chat.
   */
  readonly chatId?: Maybe<string>;
  /**
   * Only chats whose members include all of these (case-insensitive substring of name or address).
   */
  readonly withNames?: Maybe<readonly string[]>;
  readonly topic?: Maybe<string>;
  readonly chatType?: Maybe<MicrosoftGraphChatType>;
  /**
   * Only messages whose sender's name contains this (case-insensitive).
   */
  readonly from?: Maybe<string>;
  /**
   * Only messages created at or after this.
   */
  readonly since?: Maybe<Date>;
  /**
   * Only messages created before this.
   */
  readonly until?: Maybe<Date>;
  /**
   * Whether messages deleted after they were archived are searched. Defaults to true.
   */
  readonly includeDeleted?: Maybe<boolean>;
  /**
   * The most hits returned, newest first. Defaults to {@link DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_SEARCH_TOP}.
   */
  readonly top?: Maybe<number>;
}

/**
 * The result of {@link searchMsGraphCliTeamsChatDump}.
 */
export interface MsGraphCliTeamsChatDumpSearchResult {
  readonly dir: string;
  /**
   * The chats searched (after the chat filters).
   */
  readonly chats: number;
  /**
   * The message files read (after the date prefilter).
   */
  readonly scanned: number;
  /**
   * Every match, before `top`.
   */
  readonly matches: number;
  /**
   * The newest `top` matches.
   */
  readonly hits: MsGraphCliTeamsChatSearchHit[];
  /**
   * Whether `top` dropped matches.
   */
  readonly truncated: boolean;
}

async function readJsonFile<T>(path: string): Promise<Maybe<T>> {
  let result: Maybe<T>;

  try {
    result = JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    result = undefined;
  }

  return result;
}

/**
 * Reads the creation time a message file's name carries (`<yyyy>-<mm>-<dd>T<hh>-<mm>-<ss>Z_<sha8>`), so a date
 * filter skips files without reading them.
 *
 * @param file - The message's path without extension.
 * @returns The time in ms, or undefined for an undated message.
 */
function messageFileTime(file: string): Maybe<number> {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z/.exec(basename(file));
  return match ? Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`) : undefined;
}

function chatLabel(chat: Maybe<MicrosoftGraphChat>): Maybe<string> {
  return chat?.topic || (chat?.members ?? []).map((x) => x.displayName ?? x.email ?? '?').join(', ') || undefined;
}

/**
 * Searches a `teams chat dump` directory on disk: no Graph call, so it needs no token or scope. Reads each selected
 * chat's manifest, skips message files outside `since` / `until` by their names, reads the rest and matches their
 * subject, body text and attachment names. Hits come newest first.
 *
 * @param config - The directory, query and filters.
 * @returns The hits and counts.
 * @throws {CliError} `INVALID_ARGUMENT` when the directory holds no teams chat dump.
 */
export async function searchMsGraphCliTeamsChatDump(config: MsGraphCliTeamsChatDumpSearchConfig): Promise<MsGraphCliTeamsChatDumpSearchResult> {
  const { dir } = config;
  const manifest = await readJsonFile<MsGraphCliTeamsChatDumpManifest>(join(dir, MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE));

  if (manifest?.kind !== MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_KIND) {
    throw new CliError({ message: `${dir} holds no teams chat dump.`, code: 'INVALID_ARGUMENT', suggestion: 'Pass the --dir of a teams chat dump, or archive chats first: teams chat dump --all-chats --dir <dir>.' });
  }

  const matcher = msGraphCliTeamsChatSearchMatcher(config);
  const sinceMs = config.since?.getTime();
  const untilMs = config.until?.getTime();
  const fromName = config.from?.trim().toLowerCase();
  const chatFilter = { withNames: config.withNames, topic: config.topic, chatType: config.chatType };
  const filtersChats = Boolean(config.chatId || config.topic || config.chatType || (config.withNames ?? []).length > 0);
  const includeDeleted = config.includeDeleted ?? true;
  const top = Math.max(1, config.top ?? DEFAULT_MSGRAPH_CLI_TEAMS_CHAT_DUMP_SEARCH_TOP);
  const hits: MsGraphCliTeamsChatSearchHit[] = [];
  let chats = 0;
  let scanned = 0;

  for (const chatKey of Object.keys(manifest.chats ?? {}).sort((a, b) => a.localeCompare(b))) {
    const chatDir = join(dir, MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHATS_DIR, chatKey);
    const chat = await readJsonFile<MicrosoftGraphChat>(join(chatDir, MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHAT_FILE));
    const chatSelected = !filtersChats || (chat != null && (!config.chatId || chat.id === config.chatId) && microsoftGraphChatMatches(chat, chatFilter));
    const chatManifest = chatSelected ? await readJsonFile<MsGraphCliTeamsChatDumpChatManifest>(join(chatDir, MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE)) : undefined;

    if (chatManifest?.kind === MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHAT_MANIFEST_KIND) {
      chats += 1;
      const label = chatLabel(chat);
      const entries = Object.entries(chatManifest.messages ?? {}).filter(([, entry]) => {
        const time = entry.file ? messageFileTime(entry.file) : undefined;
        const inRange = time == null || ((sinceMs == null || time >= sinceMs) && (untilMs == null || time < untilMs));
        return entry.file && inRange && (includeDeleted || !entry.deletedDateTime);
      });

      for (let i = 0; i < entries.length; i += READ_BATCH_SIZE) {
        const batch = entries.slice(i, i + READ_BATCH_SIZE);
        const messages = await Promise.all(batch.map(([, entry]) => readJsonFile<MicrosoftGraphChatMessage>(join(chatDir, `${entry.file}.json`))));
        const files = await Promise.all(
          batch.map(([, entry]) =>
            access(join(chatDir, `${entry.file}.md`)).then(
              () => `${entry.file}.md`,
              () => `${entry.file}.json`
            )
          )
        );

        batch.forEach(([messageId, entry], j) => {
          const message = messages[j];

          if (message) {
            scanned += 1;
            const created = message.createdDateTime ? Date.parse(message.createdDateTime) : undefined;
            const inRange = created == null || ((sinceMs == null || created >= sinceMs) && (untilMs == null || created < untilMs));
            const sender = msGraphCliTeamsChatMessageSender(message);
            const fromMatches = !fromName || sender.toLowerCase().includes(fromName);
            const text = inRange && fromMatches ? msGraphCliTeamsChatMessageSearchText(message) : '';
            const index = inRange && fromMatches ? matcher(text) : -1;

            if (index >= 0) {
              hits.push({
                id: messageId,
                chatId: chat?.id,
                chat: label,
                createdDateTime: message.createdDateTime,
                from: sender,
                snippet: msGraphCliTeamsChatSearchSnippet(text, index),
                file: join(MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHATS_DIR, chatKey, files[j]),
                ...(entry.deletedDateTime ? { deleted: true as const } : undefined)
              });
            }
          }
        });
      }
    }
  }

  hits.sort((a, b) => (b.createdDateTime ?? '').localeCompare(a.createdDateTime ?? ''));
  return { dir, chats, scanned, matches: hits.length, hits: hits.slice(0, top), truncated: hits.length > top };
}
