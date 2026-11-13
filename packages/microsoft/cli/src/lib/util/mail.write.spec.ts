import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError } from '@dereekb/dbx-cli';
import { microsoftGraphSendMailRequest } from '@dereekb/microsoft';
import {
  appendMsGraphCliSignature,
  appendMsGraphCliSignatureToComment,
  embedMsGraphCliSignatureImages,
  msGraphCliDryRunOutput,
  msGraphCliHtmlToText,
  msGraphCliSignatureAttachments,
  msGraphCliSignatureFileForSender,
  msGraphCliWriteResultsOutput,
  parseMsGraphCliAddressesOption,
  readMsGraphCliSignature,
  requireMsGraphCliConfirmation,
  splitMsGraphCliAttachments
} from './mail.write';

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

  describe('signature per sending address', () => {
    const config = { signatureFile: '/sig/own.html', mailboxSignatureFiles: { 'billing@example.com': '/sig/billing.html' } };

    it('uses your own signature for your own mailbox', () => {
      expect(msGraphCliSignatureFileForSender({ config })).toBe('/sig/own.html');
    });

    it('uses the saved signature of the address sent as, matched without case', () => {
      expect(msGraphCliSignatureFileForSender({ sender: 'Billing@Example.com', config })).toBe('/sig/billing.html');
    });

    it('never falls back to your own signature for another address', () => {
      expect(msGraphCliSignatureFileForSender({ sender: 'support@example.com', config })).toBeUndefined();
    });

    it('reads nothing with --no-signature, and the --mailbox signature otherwise', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'msgraph-cli-sig-'));
      const file = join(dir, 'billing.txt');
      writeFileSync(file, 'Billing team\n');

      expect(await readMsGraphCliSignature({ signature: false, mailbox: 'billing@example.com', config: { mailboxSignatureFiles: { 'billing@example.com': file } } })).toBeUndefined();
      expect(await readMsGraphCliSignature({ mailbox: 'billing@example.com', config: { mailboxSignatureFiles: { 'billing@example.com': file } } })).toEqual({ content: 'Billing team', isHtml: false });
      expect(await readMsGraphCliSignature({ mailbox: 'support@example.com', config: { signatureFile: file } })).toBeUndefined();
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('embedMsGraphCliSignatureImages()', () => {
    it('attaches local images inline once each and points their src at the content id, leaving web images alone', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'msgraph-cli-sig-'));
      mkdirSync(join(dir, 'My Signature_files'));
      writeFileSync(join(dir, 'logo.png'), 'png');
      writeFileSync(join(dir, 'My Signature_files', 'image001.jpg'), 'jpg');
      const html = '<img src="logo.png"><img alt="x" src=\'My%20Signature_files/image001.jpg\'><img src="https://example.com/a.png"><img src="cid:kept"><img src="logo.png" alt="again">';

      const result = await embedMsGraphCliSignatureImages({ html, baseDir: dir });

      expect(result.content).toBe('<img src="cid:signature1-logo.png"><img alt="x" src=\'cid:signature2-image001.jpg\'><img src="https://example.com/a.png"><img src="cid:kept"><img src="cid:signature1-logo.png" alt="again">');
      expect(result.inlineImages?.map((x) => ({ name: x.name, contentType: x.contentType, isInline: x.isInline, contentId: x.contentId }))).toEqual([
        { name: 'logo.png', contentType: 'image/png', isInline: true, contentId: 'signature1-logo.png' },
        { name: 'image001.jpg', contentType: 'image/jpeg', isInline: true, contentId: 'signature2-image001.jpg' }
      ]);
      rmSync(dir, { recursive: true, force: true });
    });

    it('returns no images for a signature with only web images', async () => {
      const result = await embedMsGraphCliSignatureImages({ html: '<p>Ada</p><img src="https://example.com/a.png">', baseDir: tmpdir() });
      expect(result).toEqual({ content: '<p>Ada</p><img src="https://example.com/a.png">', isHtml: true, inlineImages: undefined });
    });

    it('refuses a signature whose image is missing', async () => {
      await expect(embedMsGraphCliSignatureImages({ html: '<img src="missing.png">', baseDir: tmpdir() })).rejects.toThrow(CliError);
    });
  });

  it('attaches the signature images only to an HTML body', () => {
    const image = { name: 'logo.png', bytes: new Uint8Array(1), isInline: true, contentId: 'signature1-logo.png' };
    const signature = { content: '<img src="cid:signature1-logo.png">', isHtml: true, inlineImages: [image] };

    expect(msGraphCliSignatureAttachments({ contentType: 'html', content: 'x' }, signature)).toEqual([image]);
    expect(msGraphCliSignatureAttachments({ contentType: 'text', content: 'x' }, signature)).toEqual([]);
    expect(msGraphCliSignatureAttachments({ contentType: 'html', content: 'x' }, undefined)).toEqual([]);
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
