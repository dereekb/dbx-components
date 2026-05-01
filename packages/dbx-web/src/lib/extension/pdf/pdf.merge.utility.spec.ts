import { describe, expect, it } from 'vitest';
import { type PdfMergeEntry } from './pdf.merge';
import { buildPdfMergeEntry, classifyPdfMergeFile, validatePdfMergeEntry } from './pdf.merge.utility';

function makeFile(name: string, type: string, contents = 'placeholder'): File {
  return new File([contents], name, { type });
}

function makePdfFile(name: string, body: string): File {
  return new File([`%PDF-1.4\n${body}\n%%EOF\n`], name, { type: 'application/pdf' });
}

describe('classifyPdfMergeFile()', () => {
  it('classifies a PDF mime type as pdf', () => {
    expect(classifyPdfMergeFile(makeFile('a.pdf', 'application/pdf'))).toBe('pdf');
  });

  it('classifies PNG and JPEG mime types as image', () => {
    expect(classifyPdfMergeFile(makeFile('a.png', 'image/png'))).toBe('image');
    expect(classifyPdfMergeFile(makeFile('a.jpg', 'image/jpeg'))).toBe('image');
  });

  it('falls back to file extension when no mime type is provided', () => {
    expect(classifyPdfMergeFile(makeFile('doc.pdf', ''))).toBe('pdf');
    expect(classifyPdfMergeFile(makeFile('photo.png', ''))).toBe('image');
    expect(classifyPdfMergeFile(makeFile('photo.jpeg', ''))).toBe('image');
  });

  it('returns null for unsupported types', () => {
    expect(classifyPdfMergeFile(makeFile('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBeNull();
    expect(classifyPdfMergeFile(makeFile('archive.zip', 'application/zip'))).toBeNull();
  });
});

describe('buildPdfMergeEntry()', () => {
  it('builds a validating entry for a supported file', () => {
    let counter = 0;
    const entry = buildPdfMergeEntry(makeFile('a.pdf', 'application/pdf'), () => `id-${++counter}`);
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe('id-1');
    expect(entry!.kind).toBe('pdf');
    expect(entry!.status).toBe('validating');
    expect(entry!.name).toBe('a.pdf');
  });

  it('returns null for an unsupported file', () => {
    expect(buildPdfMergeEntry(makeFile('archive.zip', 'application/zip'))).toBeNull();
  });
});

describe('validatePdfMergeEntry()', () => {
  type ValidatableEntry = Omit<PdfMergeEntry, 'validation'>;

  function pdfEntry(file: File): ValidatableEntry {
    return {
      id: 'id',
      file,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      kind: 'pdf',
      status: 'validating'
    };
  }

  function imageEntry(file: File): ValidatableEntry {
    return {
      id: 'id',
      file,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      kind: 'image',
      status: 'validating'
    };
  }

  it('marks a valid PDF as ready', async () => {
    const result = await validatePdfMergeEntry(pdfEntry(makePdfFile('valid.pdf', 'body')));
    expect(result.ok).toBe(true);
  });

  it('marks a corrupt PDF (no header) as error', async () => {
    const result = await validatePdfMergeEntry(pdfEntry(makeFile('corrupt.pdf', 'application/pdf', 'not a pdf')));
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain('valid PDF');
  });

  it('marks an encrypted PDF as error', async () => {
    const result = await validatePdfMergeEntry(pdfEntry(makePdfFile('locked.pdf', '/Encrypt 1 0 R')));
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain('Password-protected');
  });

  it('marks an empty image as error', async () => {
    const result = await validatePdfMergeEntry(imageEntry(new File([], 'empty.png', { type: 'image/png' })));
    expect(result.ok).toBe(false);
  });

  it('marks a non-empty image as ready', async () => {
    const result = await validatePdfMergeEntry(imageEntry(makeFile('a.png', 'image/png', 'imgdata')));
    expect(result.ok).toBe(true);
  });
});
