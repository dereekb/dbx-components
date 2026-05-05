import { detectPdfEncryption } from './pdf.encryption';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TEST_ASSETS_DIR = resolve(__dirname, '../../../../../../apps/demo-api/src/test/assets');
const FULLY_ENCRYPTED_PDF = resolve(TEST_ASSETS_DIR, 'encryptedpdf.pdf');
const WRITE_PROTECTED_R6_PDF = resolve(TEST_ASSETS_DIR, 'passwordprotectedwrite.pdf');

describe('detectPdfEncryption', () => {
  it('should return "none" for a buffer without any /Encrypt marker', () => {
    const content = '%PDF-1.4 some content %%EOF';
    const buffer = Buffer.from(content);
    expect(detectPdfEncryption(buffer)).toBe('none');
  });

  it('should return "none" for an empty buffer', () => {
    const buffer = Buffer.from('');
    expect(detectPdfEncryption(buffer)).toBe('none');
  });

  it('should return "fully_encrypted" for a PDF that requires a password to open (R=6, AES-256)', () => {
    const buffer = readFileSync(FULLY_ENCRYPTED_PDF);
    expect(detectPdfEncryption(buffer)).toBe('fully_encrypted');
  });

  it('should return "write_protected_only" for a PDF that opens without a password but restricts editing (R=6, AES-256)', () => {
    const buffer = readFileSync(WRITE_PROTECTED_R6_PDF);
    expect(detectPdfEncryption(buffer)).toBe('write_protected_only');
  });
});
