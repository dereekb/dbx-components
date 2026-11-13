import { type MicrosoftGraphChatMessage, type MicrosoftGraphChatMessageAttachment, microsoftGraphChatMessageHostedContentRefs } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';

/**
 * Options for {@link msGraphCliTeamsHtmlToMarkdown}.
 */
export interface MsGraphCliTeamsHtmlToMarkdownOptions {
  /**
   * Returns the link target of an `<img>`: for an inline image (hosted content) its local file, else undefined to
   * render `[image: not downloaded]`. Called with the hosted content id when the source is a hostedContents
   * `$value` URL, else with undefined. Without it, inline images render as not downloaded and other images link
   * their http(s) source.
   */
  readonly image?: Maybe<(hostedContentId: Maybe<string>, src: string) => Maybe<string>>;
  /**
   * Returns the name of an attachment a body's `<attachment id>` names.
   */
  readonly attachmentName?: Maybe<(id: string) => Maybe<string>>;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  zwj: '‍',
  zwnj: '‌'
};

/**
 * Decodes HTML entities: the common named ones, `&#N;` and `&#xH;`. An unknown or invalid entity is kept as-is.
 *
 * @param text - The text.
 * @returns The decoded text.
 */
export function decodeMsGraphCliHtmlEntities(text: string): string {
  return text.replaceAll(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match: string, entity: string) => {
    let result: Maybe<string>;

    if (entity.startsWith('#')) {
      const code = entity[1] === 'x' || entity[1] === 'X' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      result = Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : undefined;
    } else {
      result = NAMED_ENTITIES[entity.toLowerCase()];
    }

    return result ?? match;
  });
}

function htmlAttribute(attributes: string, name: string): Maybe<string> {
  const match = new RegExp(String.raw`(?:^|\s)${name}\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))`, 'i').exec(attributes);
  const raw = match ? (match[1] ?? match[2] ?? match[3]) : undefined;
  return raw == null ? undefined : decodeMsGraphCliHtmlEntities(raw);
}

function isMsGraphCliSafeLink(href: string, allowMailto: boolean): boolean {
  return /^https?:\/\//i.test(href) || (allowMailto && /^mailto:/i.test(href));
}

// characters that would break out of a Markdown link target
function markdownLinkTarget(target: string): string {
  return target.replaceAll(' ', '%20').replaceAll('(', '%28').replaceAll(')', '%29');
}

const PLACEHOLDER = '\u0000';

/**
 * Converts the HTML Teams writes in chat message bodies to Markdown. It is regex-based and covers the Teams subset, not
 * HTML in general:.
 *
 * - `<br>` → a newline; `p`, `div`, `li`, `h*`, `ul`, `ol` and `tr` → line breaks;
 * - `b`/`strong` → `**`, `i`/`em` → `_`, `s`/`strike`/`del` → `~~`, `code` → `` ` ``, `pre`/`codeblock` → a fenced block,
 *   `blockquote` → `> `, `li` → `- `;
 * - `<a href>` → `[text](href)` for http(s) and mailto links (else the text); `<at>Name</at>` → `@Name`;
 * - `<emoji alt>` → its alt text, `<customemoji alt>` → `:alt:`;
 * - an inline image (hostedContents) → `![image](<local file>)` or `[image: not downloaded]`; another http(s) image →
 *   `![image](src)`;
 * - `<attachment id>` → `[attachment: <name>]`;
 * - every other tag (`<systemEventMessage/>` included) is dropped;
 * - entities are decoded, and runs of blank lines collapse to one.
 *
 * @param html - The body HTML.
 * @param options - How images and attachments resolve.
 * @returns The Markdown, trimmed.
 */
export function msGraphCliTeamsHtmlToMarkdown(html: string, options?: Maybe<MsGraphCliTeamsHtmlToMarkdownOptions>): string {
  const blocks: string[] = [];

  function hold(block: string): string {
    blocks.push(block);
    return `${PLACEHOLDER}${blocks.length - 1}${PLACEHOLDER}`;
  }

  function convertCode(inner: string): string {
    const text = decodeMsGraphCliHtmlEntities(
      inner
        .replaceAll(/<br\s*\/?>/gi, '\n')
        .replaceAll(/<\/(?:p|div)>/gi, '\n')
        .replaceAll(/<[^>]*>/g, '')
    ).replace(/\n+$/, '');
    const fence = text.includes('```') ? '~~~' : '```';
    return hold(`\n${fence}\n${text}\n${fence}\n`);
  }

  function convertImage(attributes: string): string {
    const src = htmlAttribute(attributes, 'src') ?? '';
    const hostedContentId = microsoftGraphChatMessageHostedContentRefs({ body: { contentType: 'html', content: src } })[0]?.hostedContentId;
    let result: string;

    if (hostedContentId == null) {
      const target = options?.image ? options.image(undefined, src) : src;
      result = target && isMsGraphCliSafeLink(target, false) ? `![image](${markdownLinkTarget(target)})` : '[image]';
    } else {
      const local = options?.image?.(hostedContentId, src);
      result = local ? `![image](${markdownLinkTarget(local)})` : '[image: not downloaded]';
    }

    return hold(result);
  }

  function convert(input: string): string {
    let text = input.replaceAll('\r', '');

    // code first, so its whitespace and markup survive
    text = text.replaceAll(/<(pre|codeblock)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m: string, _tag: string, inner: string) => convertCode(inner));
    text = text.replaceAll(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m: string, inner: string) =>
      hold(
        `\n${convert(inner)
          .split('\n')
          .map((line) => (line ? `> ${line}` : '>'))
          .join('\n')}\n`
      )
    );

    // HTML whitespace is not significant
    text = text.replaceAll(/[ \t\n]+/g, ' ');

    text = text.replaceAll(/<img\b([^>]*)>/gi, (_m: string, attributes: string) => convertImage(attributes));
    text = text.replaceAll(/<attachment\b([^>]*)>(?:[\s\S]*?<\/attachment>)?/gi, (_m: string, attributes: string) => {
      const id = htmlAttribute(attributes, 'id');
      const name = id ? options?.attachmentName?.(id) : undefined;
      return hold(name ? `[attachment: ${name}]` : '[attachment]');
    });
    text = text.replaceAll(/<emoji\b([^>]*?)\/?>(?:[\s\S]*?<\/emoji>)?/gi, (_m: string, attributes: string) => hold(htmlAttribute(attributes, 'alt') ?? ''));
    text = text.replaceAll(/<customemoji\b([^>]*?)\/?>(?:[\s\S]*?<\/customemoji>)?/gi, (_m: string, attributes: string) => {
      const alt = htmlAttribute(attributes, 'alt');
      return hold(alt ? `:${alt}:` : '');
    });
    text = text.replaceAll(/<at\b[^>]*>([\s\S]*?)<\/at>/gi, (_m: string, inner: string) => `@${inner.replaceAll(/<[^>]*>/g, '').trim()}`);
    text = text.replaceAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_m: string, attributes: string, inner: string) => {
      const href = htmlAttribute(attributes, 'href');
      const label = inner.replaceAll(/<[^>]*>/g, '').trim();
      let result: string;

      if (href && isMsGraphCliSafeLink(href, true)) {
        result = `[${label || href}](${hold(markdownLinkTarget(href))})`;
      } else {
        result = label;
      }

      return result;
    });

    text = text
      .replaceAll(/<br\s*\/?>/gi, '\n')
      .replaceAll(/<li\b[^>]*>(?:\s*<p\b[^>]*>)?/gi, '\n- ')
      .replaceAll(/<\/li>/gi, '')
      .replaceAll(/<\/?(?:p|div|h[1-6]|ul|ol|tr|table)\b[^>]*>/gi, '\n')
      .replaceAll(/<\/?(?:b|strong)\b[^>]*>/gi, '**')
      .replaceAll(/<\/?(?:i|em)\b[^>]*>/gi, '_')
      .replaceAll(/<\/?(?:s|strike|del)\b[^>]*>/gi, '~~')
      .replaceAll(/<\/?code\b[^>]*>/gi, '`')
      .replaceAll(/<\/?t[dh]\b[^>]*>/gi, ' ')
      // every other tag, <systemEventMessage/> included
      .replaceAll(/<[^>]*>/g, '');

    text = decodeMsGraphCliHtmlEntities(text)
      .split('\n')
      .map((line) => line.replaceAll(/ {2,}/g, ' ').trim())
      .join('\n');

    return text.replaceAll(/\n{3,}/g, '\n\n').trim();
  }

  let result = convert(html);

  // restore held blocks; a block can hold another
  for (let i = 0; i < 4 && result.includes(PLACEHOLDER); i += 1) {
    result = result.replaceAll(new RegExp(String.raw`${PLACEHOLDER}(\d+)${PLACEHOLDER}`, 'g'), (_m: string, index: string) => blocks[Number(index)] ?? '');
  }

  return result.replaceAll(/\n{3,}/g, '\n\n').trim();
}

/**
 * Input to {@link msGraphCliTeamsChatMessageMarkdown}.
 */
export interface MsGraphCliTeamsChatMessageMarkdownInput {
  readonly message: MicrosoftGraphChatMessage;
  /**
   * Local files by hosted content id, relative to the `.md`.
   */
  readonly hostedFiles?: Maybe<ReadonlyMap<string, string>>;
  /**
   * Local files by attachment id, relative to the `.md`.
   */
  readonly attachmentFiles?: Maybe<ReadonlyMap<string, string>>;
  /**
   * Attachment ids whose download failed; listed as `[not downloaded]`.
   */
  readonly notDownloaded?: Maybe<ReadonlySet<string>>;
}

/**
 * Returns the name of a chat message's sender: the user's, else the application's, else the device's display name,
 * else `System`.
 *
 * @param message - The chat message.
 * @returns The name.
 */
export function msGraphCliTeamsChatMessageSender(message: Pick<MicrosoftGraphChatMessage, 'from'>): string {
  const from = message.from;
  return from?.user?.displayName || from?.application?.displayName || from?.device?.displayName || 'System';
}

/**
 * Returns the event name of a system event message, from its `eventDetail` type: `membersAdded` for
 * `#microsoft.graph.membersAddedEventMessageDetail`.
 *
 * @param message - The chat message.
 * @returns The event name, or undefined when the message is not a system event.
 */
export function msGraphCliTeamsSystemEventName(message: Pick<MicrosoftGraphChatMessage, 'messageType' | 'eventDetail'>): Maybe<string> {
  let result: Maybe<string>;

  if (message.messageType === 'systemEventMessage' || message.eventDetail != null) {
    const type = message.eventDetail?.['@odata.type'] ?? '';
    result =
      type
        .replace(/^#?microsoft\.graph\./, '')
        .replace(/EventMessageDetail$/, '')
        .replace(/MessageDetail$/, '') || 'systemEvent';
  }

  return result;
}

function quotedMessageSender(attachment: MicrosoftGraphChatMessageAttachment): Maybe<string> {
  let result: Maybe<string>;

  try {
    const content = JSON.parse(attachment.content ?? '') as { readonly messageSender?: { readonly user?: { readonly displayName?: string }; readonly application?: { readonly displayName?: string } } };
    result = content?.messageSender?.user?.displayName || content?.messageSender?.application?.displayName || undefined;
  } catch {
    result = undefined;
  }

  return result;
}

/**
 * Renders a chat message as Markdown:.
 *
 * - a header, `### <sender> · <createdDateTime>`, with ` (edited <time>)` and ` (deleted <time>)` markers, and a
 *   `Deleted: <time>` line for a deleted message;
 * - the body: HTML through {@link msGraphCliTeamsHtmlToMarkdown}, text as-is, a system event as `_<event>_`;
 * - the attachments: `- Attachment: <name>` (` → <local file>` when downloaded), `- Quoted message` (` from <sender>`),
 *   `- Card: <contentType>`, or `- <contentType>`.
 *
 * @param input - The message and its local files.
 * @returns The Markdown, ending with a newline.
 */
export function msGraphCliTeamsChatMessageMarkdown(input: MsGraphCliTeamsChatMessageMarkdownInput): string {
  const { message, hostedFiles, attachmentFiles, notDownloaded } = input;
  const attachments = message.attachments ?? [];
  const edited = message.lastEditedDateTime ? ` (edited ${message.lastEditedDateTime})` : '';
  const deleted = message.deletedDateTime ? ` (deleted ${message.deletedDateTime})` : '';
  const lines = [`### ${msGraphCliTeamsChatMessageSender(message)} · ${message.createdDateTime ?? ''}${edited}${deleted}`, ''];
  const eventName = msGraphCliTeamsSystemEventName(message);

  if (message.deletedDateTime) {
    lines.push(`Deleted: ${message.deletedDateTime}`, '');
  }

  let body: string;

  if (eventName) {
    body = `_${eventName}_`;
  } else if (message.body?.contentType === 'text') {
    body = message.body.content ?? '';
  } else {
    body = msGraphCliTeamsHtmlToMarkdown(message.body?.content ?? '', {
      image: (hostedContentId, src) => (hostedContentId == null ? src : hostedFiles?.get(hostedContentId)),
      attachmentName: (id) => attachments.find((x) => x.id === id)?.name ?? undefined
    });
  }

  if (body) {
    lines.push(body, '');
  }

  for (const attachment of attachments) {
    const contentType = attachment.contentType ?? 'unknown';
    let line: string;

    if (contentType === 'reference') {
      const local = attachment.id ? attachmentFiles?.get(attachment.id) : undefined;
      const failed = attachment.id != null && notDownloaded?.has(attachment.id);
      const localSuffix = local ? ' → ' + local : '';
      line = `- Attachment: ${attachment.name ?? 'file'}${localSuffix}${failed ? ' [not downloaded]' : ''}`;
    } else if (contentType === 'messageReference') {
      const sender = quotedMessageSender(attachment);
      line = sender ? `- Quoted message from ${sender}` : '- Quoted message';
    } else if (contentType.startsWith('application/vnd.microsoft.card.')) {
      line = `- Card: ${contentType}`;
    } else {
      line = `- ${contentType}`;
    }

    lines.push(line);
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
