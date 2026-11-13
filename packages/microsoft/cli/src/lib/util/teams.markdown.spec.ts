import { describe, expect, it } from 'vitest';
import { type MicrosoftGraphChatMessage } from '@dereekb/microsoft';
import { decodeMsGraphCliHtmlEntities, msGraphCliTeamsChatMessageMarkdown, msGraphCliTeamsHtmlToMarkdown, msGraphCliTeamsSystemEventName } from './teams.markdown';

const HOSTED_SRC = 'https://graph.microsoft.com/v1.0/chats/19:c@thread.v2/messages/1700000000000/hostedContents/aWQ9eA==/$value';

describe('msGraphCliTeamsHtmlToMarkdown()', () => {
  it('turns breaks and blocks into lines', () => {
    expect(msGraphCliTeamsHtmlToMarkdown('<p>one</p><p>two<br>three</p><div>four</div><h2>five</h2>')).toBe('one\n\ntwo\nthree\n\nfour\n\nfive');
  });

  it('renders inline formatting', () => {
    expect(msGraphCliTeamsHtmlToMarkdown('<b>b</b> <strong>s</strong> <i>i</i> <em>e</em> <s>x</s> <strike>y</strike> <del>z</del> <code>c</code>')).toBe('**b** **s** _i_ _e_ ~~x~~ ~~y~~ ~~z~~ `c`');
  });

  it('fences pre and codeblock content, keeping its whitespace', () => {
    // models: TC12 — Teams code snippets arrive as <codeblock><code>…</code></codeblock>
    expect(msGraphCliTeamsHtmlToMarkdown('<p>see</p><codeblock class="Typescript"><code>const a = 1;<br>  if (a &lt; 2) {}</code></codeblock>')).toBe('see\n\n```\nconst a = 1;\n  if (a < 2) {}\n```');
    expect(msGraphCliTeamsHtmlToMarkdown('<pre>x  y</pre>')).toBe('```\nx  y\n```');
  });

  it('quotes blockquotes and lists items', () => {
    expect(msGraphCliTeamsHtmlToMarkdown('<blockquote><p>quoted</p><p>more</p></blockquote><ul><li>a</li><li><p>b</p></li></ul>')).toBe('> quoted\n>\n> more\n\n- a\n- b');
  });

  it('links http(s) and mailto only', () => {
    expect(msGraphCliTeamsHtmlToMarkdown('<a href="https://example.com/a?x=1&amp;y=2">site</a>')).toBe('[site](https://example.com/a?x=1&y=2)');
    expect(msGraphCliTeamsHtmlToMarkdown('<a href="mailto:ada@example.com">mail</a>')).toBe('[mail](mailto:ada@example.com)');
    expect(msGraphCliTeamsHtmlToMarkdown('<a href="javascript:alert(1)">bad</a>')).toBe('bad');
  });

  it('renders mentions and emoji', () => {
    expect(msGraphCliTeamsHtmlToMarkdown('<at id="0">Ada Lovelace</at> hi <emoji id="smile" alt="🙂" title="Smile"></emoji> <customemoji id="x" alt="party"></customemoji>')).toBe('@Ada Lovelace hi 🙂 :party:');
  });

  it('links a downloaded inline image, marks one not downloaded, and links other http(s) images', () => {
    // models: TC13 — inline images are hostedContents $value URLs in the body
    const image = (id: unknown) => (id === 'aWQ9eA==' ? 'stem/hosted/ab12cd34.png' : undefined);
    expect(msGraphCliTeamsHtmlToMarkdown(`<p><img src="${HOSTED_SRC}" alt="image"></p>`, { image })).toBe('![image](stem/hosted/ab12cd34.png)');
    expect(msGraphCliTeamsHtmlToMarkdown(`<img src="${HOSTED_SRC}">`)).toBe('[image: not downloaded]');
    expect(msGraphCliTeamsHtmlToMarkdown('<img src="https://example.com/a.png">')).toBe('![image](https://example.com/a.png)');
    expect(msGraphCliTeamsHtmlToMarkdown('<img src="data:image/png;base64,AAAA">')).toBe('[image]');
  });

  it('names an <attachment id> by its attachment', () => {
    expect(msGraphCliTeamsHtmlToMarkdown('<attachment id="a1"></attachment>', { attachmentName: (id) => (id === 'a1' ? 'report.pdf' : undefined) })).toBe('[attachment: report.pdf]');
    expect(msGraphCliTeamsHtmlToMarkdown('<attachment id="a2"></attachment>')).toBe('[attachment]');
  });

  it('strips unknown tags and the system event tag', () => {
    expect(msGraphCliTeamsHtmlToMarkdown('<span style="x"><font>kept</font></span><systemEventMessage/>')).toBe('kept');
  });

  it('decodes entities and collapses runs of blank lines to one', () => {
    expect(decodeMsGraphCliHtmlEntities('&lt;b&gt; &amp; &quot;q&quot; &#39; &#x1F600; &nbsp;&unknown;')).toBe('<b> & "q" \' 😀  &unknown;');
    expect(msGraphCliTeamsHtmlToMarkdown('&lt;b&gt;not bold&lt;/b&gt;')).toBe('<b>not bold</b>');
    expect(msGraphCliTeamsHtmlToMarkdown('a<br><br><br><br><br><br>b')).toBe('a\n\nb');
  });
});

describe('msGraphCliTeamsChatMessageMarkdown()', () => {
  const base: MicrosoftGraphChatMessage = { id: '1700000000000', messageType: 'message', createdDateTime: '2026-11-02T10:00:00.000Z', from: { user: { displayName: 'Ada' } }, body: { contentType: 'html', content: '<p>hello</p>' } };

  it('renders the header for user, application and system senders', () => {
    expect(msGraphCliTeamsChatMessageMarkdown({ message: base })).toBe('### Ada · 2026-11-02T10:00:00.000Z\n\nhello\n');
    expect(msGraphCliTeamsChatMessageMarkdown({ message: { ...base, from: { application: { displayName: 'Bot' } } } })).toContain('### Bot · ');
    expect(msGraphCliTeamsChatMessageMarkdown({ message: { ...base, from: undefined } })).toContain('### System · ');
  });

  it('marks edited and deleted messages', () => {
    const md = msGraphCliTeamsChatMessageMarkdown({ message: { ...base, lastEditedDateTime: '2026-11-02T10:05:00.000Z', deletedDateTime: '2026-11-03T00:00:00.000Z' } });
    expect(md).toContain('(edited 2026-11-02T10:05:00.000Z) (deleted 2026-11-03T00:00:00.000Z)');
    expect(md).toContain('\nDeleted: 2026-11-03T00:00:00.000Z\n');
  });

  it('writes a text body as-is', () => {
    expect(msGraphCliTeamsChatMessageMarkdown({ message: { ...base, body: { contentType: 'text', content: '<b>raw</b>' } } })).toContain('\n<b>raw</b>\n');
  });

  it('renders a system event as _<event>_', () => {
    // models: TC10 — with Prefer: include-unknown-enum-members, system events carry eventDetail
    const message: MicrosoftGraphChatMessage = { ...base, messageType: 'systemEventMessage', from: undefined, body: { contentType: 'html', content: '<systemEventMessage/>' }, eventDetail: { '@odata.type': '#microsoft.graph.membersAddedEventMessageDetail' } };
    expect(msGraphCliTeamsSystemEventName(message)).toBe('membersAdded');
    expect(msGraphCliTeamsChatMessageMarkdown({ message })).toContain('\n_membersAdded_\n');
    expect(msGraphCliTeamsSystemEventName(base)).toBeUndefined();
  });

  it('lists attachments with their local files', () => {
    // models: TC11/TC12 — reference files, quoted replies (messageReference) and adaptive cards
    const message: MicrosoftGraphChatMessage = {
      ...base,
      body: { contentType: 'html', content: `<p><img src="${HOSTED_SRC}"></p><attachment id="f1"></attachment>` },
      attachments: [
        { id: 'f1', contentType: 'reference', contentUrl: 'https://contoso-my.sharepoint.com/personal/ada/Documents/report.pdf', name: 'report.pdf' },
        { id: 'f2', contentType: 'reference', contentUrl: 'https://contoso-my.sharepoint.com/personal/ada/Documents/b.pdf', name: 'b.pdf' },
        { id: 'q1', contentType: 'messageReference', content: JSON.stringify({ messageId: '1', messageSender: { user: { displayName: 'Grace' } } }) },
        { id: 'c1', contentType: 'application/vnd.microsoft.card.adaptive', content: '{}' },
        { id: 'm1', contentType: 'meetingReference' }
      ]
    };
    const md = msGraphCliTeamsChatMessageMarkdown({ message, hostedFiles: new Map([['aWQ9eA==', 'stem/hosted/ab.png']]), attachmentFiles: new Map([['f1', 'stem/attachments/x_report.pdf']]), notDownloaded: new Set(['f2']) });

    expect(md).toContain('![image](stem/hosted/ab.png)');
    expect(md).toContain('[attachment: report.pdf]');
    expect(md).toContain('- Attachment: report.pdf → stem/attachments/x_report.pdf');
    expect(md).toContain('- Attachment: b.pdf [not downloaded]');
    expect(md).toContain('- Quoted message from Grace');
    expect(md).toContain('- Card: application/vnd.microsoft.card.adaptive');
    expect(md).toContain('- meetingReference');
  });
});
