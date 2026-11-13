import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError } from '@dereekb/dbx-cli';
import { msGraphCliConfigExport, msGraphCliConfigSetUpdate, msGraphCliConfigSettings, msGraphCliConfigUnsetUpdate } from './config.command';

describe('msgraph-cli config', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'msgraph-cli-config-'));
    file = join(dir, 'signature.html');
    writeFileSync(file, '<p>Ada</p>');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('msGraphCliConfigSetUpdate()', () => {
    it('saves your own signature without --mailbox', async () => {
      expect(await msGraphCliConfigSetUpdate('signature-file', file)).toEqual({ signatureFile: file });
    });

    it('saves a mailbox signature under its lowercased address, keeping the other mailboxes', async () => {
      const current = { mailboxSignatureFiles: { 'billing@example.com': '/sig/billing.html' } };
      expect(await msGraphCliConfigSetUpdate('signature-file', file, { mailbox: 'Support@Example.com', current })).toEqual({ mailboxSignatureFiles: { 'billing@example.com': '/sig/billing.html', 'support@example.com': file } });
    });

    it('refuses --mailbox with a setting other than signature-file, or with more than one address', async () => {
      await expect(msGraphCliConfigSetUpdate('mailboxes', 'a@example.com', { mailbox: 'support@example.com' })).rejects.toThrow(CliError);
      await expect(msGraphCliConfigSetUpdate('signature-file', file, { mailbox: 'a@example.com,b@example.com' })).rejects.toThrow(CliError);
    });

    it('refuses a signature file that does not exist', async () => {
      await expect(msGraphCliConfigSetUpdate('signature-file', join(dir, 'missing.html'), { mailbox: 'support@example.com' })).rejects.toThrow(CliError);
    });
  });

  describe('msGraphCliConfigUnsetUpdate()', () => {
    const current = { signatureFile: '/sig/own.html', mailboxSignatureFiles: { 'billing@example.com': '/sig/billing.html', 'support@example.com': '/sig/support.html' } };

    it('removes only that mailbox signature with --mailbox', () => {
      expect(msGraphCliConfigUnsetUpdate('signature-file', { mailbox: 'SUPPORT@example.com', current })).toEqual({ mailboxSignatureFiles: { 'billing@example.com': '/sig/billing.html' } });
    });

    it('clears the mailbox signatures when the last one is removed', () => {
      expect(msGraphCliConfigUnsetUpdate('signature-file', { mailbox: 'billing@example.com', current: { mailboxSignatureFiles: { 'billing@example.com': '/sig/billing.html' } } })).toEqual({ mailboxSignatureFiles: undefined });
    });

    it('removes your own signature without --mailbox', () => {
      expect(msGraphCliConfigUnsetUpdate('signature-file', { current })).toEqual({ signatureFile: undefined });
    });
  });

  it('prints the mailbox signatures with the other settings', () => {
    expect(msGraphCliConfigSettings({ signatureFile: '/sig/own.html', mailboxSignatureFiles: { 'billing@example.com': '/sig/billing.html' } })).toEqual({ 'signature-file': '/sig/own.html', 'mailbox-signature-files': { 'billing@example.com': '/sig/billing.html' }, mailboxes: undefined });
  });
  describe('msGraphCliConfigExport()', () => {
    it('prints the local signatures as connection settings, raw and trimmed', async () => {
      const text = join(dir, 'billing.txt');
      writeFileSync(text, '  Billing team\n');
      writeFileSync(file, '<p>Ada</p><img src="https://example.com/logo.png">\n');

      expect(await msGraphCliConfigExport({ signatureFile: file, mailboxSignatureFiles: { 'Billing@Example.com': text } })).toEqual({ mail_signature: { me: { html: '<p>Ada</p><img src="https://example.com/logo.png">' }, 'billing@example.com': { text: 'Billing team' } } });
    });

    it('prints nothing without saved signatures', async () => {
      expect(await msGraphCliConfigExport({})).toEqual({});
    });

    it('refuses a signature that shows a local image', async () => {
      writeFileSync(file, '<p>Ada</p><img src="logo.png">');
      await expect(msGraphCliConfigExport({ signatureFile: file })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    });

    it('refuses a missing file with its address', async () => {
      const error = await msGraphCliConfigExport({ mailboxSignatureFiles: { 'billing@example.com': join(dir, 'missing.html') } }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('billing@example.com');
      expect((error as CliError).message).toContain('ENOENT');
    });
  });
});
