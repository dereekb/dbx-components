import { bufferHasValidPdfMarkings, isPdfPasswordProtected } from './pdf';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TEST_ASSETS_DIR = resolve(__dirname, '../../../../../apps/demo-api/src/test/assets');
const FULLY_ENCRYPTED_PDF = resolve(TEST_ASSETS_DIR, 'encryptedpdf.pdf');
const WRITE_PROTECTED_R6_PDF = resolve(TEST_ASSETS_DIR, 'passwordprotectedwrite.pdf');

describe('bufferHasValidPdfMarkings', () => {
  it('should return true for a buffer with valid PDF markers', () => {
    const content = '%PDF-1.4 some content %%EOF';
    const buffer = Buffer.from(content);
    expect(bufferHasValidPdfMarkings(buffer)).toBe(true);
  });

  it('should return false when %PDF- header is missing', () => {
    const content = 'some content %%EOF';
    const buffer = Buffer.from(content);
    expect(bufferHasValidPdfMarkings(buffer)).toBe(false);
  });

  it('should return false when %%EOF marker is missing', () => {
    const content = '%PDF-1.4 some content';
    const buffer = Buffer.from(content);
    expect(bufferHasValidPdfMarkings(buffer)).toBe(false);
  });

  it('should return false for an empty buffer', () => {
    const buffer = Buffer.from('');
    expect(bufferHasValidPdfMarkings(buffer)).toBe(false);
  });

  it('should return false when %PDF- is not at the start', () => {
    const content = 'prefix %PDF-1.4 some content %%EOF';
    const buffer = Buffer.from(content);
    expect(bufferHasValidPdfMarkings(buffer)).toBe(false);
  });
});

describe('isPdfPasswordProtected', () => {
  it('should return true for a fully-encrypted PDF', () => {
    const buffer = readFileSync(FULLY_ENCRYPTED_PDF);
    expect(isPdfPasswordProtected(buffer)).toBe(true);
  });

  it('should return true for a write-protected PDF (R=6)', () => {
    const buffer = readFileSync(WRITE_PROTECTED_R6_PDF);
    expect(isPdfPasswordProtected(buffer)).toBe(true);
  });

  it('should return true for a buffer containing /Encrypt', () => {
    const content = '%PDF-1.4 /Encrypt some content %%EOF';
    const buffer = Buffer.from(content);
    expect(isPdfPasswordProtected(buffer)).toBe(true);
  });

  it('should return false for a normal PDF without /Encrypt', () => {
    const content = '%PDF-1.4 some content %%EOF';
    const buffer = Buffer.from(content);
    expect(isPdfPasswordProtected(buffer)).toBe(false);
  });

  it('should return false for an empty buffer', () => {
    const buffer = Buffer.from('');
    expect(isPdfPasswordProtected(buffer)).toBe(false);
  });
});
