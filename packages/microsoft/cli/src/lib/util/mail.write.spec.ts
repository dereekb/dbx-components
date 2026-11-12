import { describe, expect, it } from 'vitest';
import { CliError } from '@dereekb/dbx-cli';
import { microsoftGraphSendMailRequest } from '@dereekb/microsoft';
import { appendMsGraphCliSignature, appendMsGraphCliSignatureToComment, msGraphCliDryRunOutput, msGraphCliHtmlToText, msGraphCliWriteResultsOutput, parseMsGraphCliAddressesOption, requireMsGraphCliConfirmation, splitMsGraphCliAttachments } from './mail.write';

describe('mail write helpers', () => {
  it('refuses without --yes and passes with it', () => {
    expect(() => requireMsGraphCliConfirmation({ yes: false, action: 'send 1 message' })).toThrow(CliError);
    expect(() => requireMsGraphCliConfirmation({ yes: true, action: 'send 1 message' })).not.toThrow();
  });

  it('prints dry-run calls with recipients redacted to counts and attachment bytes to sizes', () => {
    const request = microsoftGraphSendMailRequest({
      message: { subject: 'Hi', to: ['ada@example.com', 'bob@example.com'], cc: ['c@example.com'], from: 'shared@example.com', attachments: [{ name: 'a.txt', bytes: new TextEncoder().encode('hello') }] }
    });
    const output = msGraphCliDryRunOutput([request]);
    const text = JSON.stringify(output);

    expect(text).not.toContain('@example.com');
    expect(output.requests[0]).toEqual({
      method: 'POST',
      url: '/me/sendMail',
      body: {
        message: { subject: 'Hi', toRecipients: '[2 recipients]', ccRecipients: '[1 recipient]', from: '[1 address]', attachments: [{ '@odata.type': '#microsoft.graph.fileAttachment', name: 'a.txt', contentType: 'application/octet-stream', contentBytes: '[8 base64 chars]' }] },
        saveToSentItems: true
      }
    });
  });

  it('parses repeated and comma-separated addresses and rejects a non-address', () => {
    expect(parseMsGraphCliAddressesOption('to', ['ada@example.com, bob@example.com', 'c@example.com;'])).toEqual(['ada@example.com', 'bob@example.com', 'c@example.com']);
    expect(parseMsGraphCliAddressesOption('to', undefined)).toBeUndefined();
    expect(() => parseMsGraphCliAddressesOption('to', ['ada'])).toThrow(CliError);
  });

  it('appends an HTML signature to HTML and text bodies, and a text one escaped to HTML', () => {
    const html = { content: '<p>Ada Lovelace</p><p>Analyst &amp; Co</p>', isHtml: true };
    expect(appendMsGraphCliSignature({ contentType: 'html', content: '<p>Hi</p>' }, html)).toEqual({ contentType: 'html', content: '<p>Hi</p><br><br><p>Ada Lovelace</p><p>Analyst &amp; Co</p>' });
    expect(appendMsGraphCliSignature({ contentType: 'text', content: 'Hi' }, html)).toEqual({ contentType: 'text', content: 'Hi\n\nAda Lovelace\nAnalyst & Co' });

    const text = { content: 'Ada <ada@example.com>\nAnalyst', isHtml: false };
    expect(appendMsGraphCliSignature({ contentType: 'html', content: 'Hi' }, text)?.content).toBe('Hi<br><br>Ada &lt;ada@example.com&gt;<br>Analyst');
    expect(appendMsGraphCliSignature(undefined, text)).toEqual({ contentType: 'text', content: text.content });
    expect(appendMsGraphCliSignature({ contentType: 'text', content: 'Hi' }, undefined)).toEqual({ contentType: 'text', content: 'Hi' });
    expect(appendMsGraphCliSignatureToComment('Thanks', text)).toBe('Thanks<br><br>Ada &lt;ada@example.com&gt;<br>Analyst');
    expect(msGraphCliHtmlToText('a<br/>b&nbsp;c<div>d</div>')).toBe('a\nb cd');
  });

  it('keeps inline attachments under 3 MB together', () => {
    const mb = 1024 * 1024;
    const { inline, large } = splitMsGraphCliAttachments([
      { name: 'a', bytes: new Uint8Array(2 * mb) },
      { name: 'b', bytes: new Uint8Array(2 * mb) },
      { name: 'c', bytes: new Uint8Array(10) }
    ]);
    expect(inline.map((x) => x.name)).toEqual(['a', 'c']);
    expect(large.map((x) => x.name)).toEqual(['b']);
  });

  it('builds the per-id result table', () => {
    const output = msGraphCliWriteResultsOutput([
      { id: 'a', status: 201, message: { id: 'a2' } },
      { id: 'b', status: 404, error: { code: 'ErrorItemNotFound', message: 'Not found.' } }
    ]);
    expect(output).toEqual({
      total: 2,
      ok: 1,
      failed: 1,
      results: [
        { id: 'a', ok: true, status: 201, newId: 'a2' },
        { id: 'b', ok: false, status: 404, code: 'ErrorItemNotFound', message: 'Not found.' }
      ]
    });
  });
});
