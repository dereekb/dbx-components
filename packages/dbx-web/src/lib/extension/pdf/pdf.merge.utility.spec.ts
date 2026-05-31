import { describe, expect, it } from 'vitest';
import { type PdfMergeEntry } from './pdf.merge';
import { buildPdfMergeEntry, buildPdfMergeEntrySync, classifyPdfMergeFile, formatPdfMergeEntrySize, mergePdfMergeEntries, validatePdfMergeEntry } from './pdf.merge.utility';

function makeFile(name: string, type: string, contents = 'placeholder'): File {
  return new File([contents], name, { type });
}

function makePdfFile(name: string, body: string): File {
  return new File([`%PDF-1.4\n${body}\n%%EOF\n`], name, { type: 'application/pdf' });
}

function readyEntry(overrides: Partial<PdfMergeEntry>): PdfMergeEntry {
  const file = overrides.file ?? new File(['placeholder'], 'a.pdf', { type: 'application/pdf' });
  return {
    id: 'id',
    file,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    kind: 'pdf',
    status: 'ready',
    original: { name: file.name, mimeType: file.type, size: file.size },
    compression: 'unchanged',
    encrypted: false,
    validation: Promise.resolve({ ok: true }),
    ...overrides
  };
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

describe('buildPdfMergeEntrySync()', () => {
  it('builds a validating entry for a supported file', () => {
    let counter = 0;
    const entry = buildPdfMergeEntrySync(makeFile('a.pdf', 'application/pdf'), { idFactory: () => `id-${++counter}` });
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe('id-1');
    expect(entry!.kind).toBe('pdf');
    expect(entry!.status).toBe('validating');
    expect(entry!.name).toBe('a.pdf');
    expect(entry!.compression).toBe('unchanged');
    expect(entry!.encrypted).toBe(false);
    expect(entry!.original.name).toBe('a.pdf');
    expect(entry!.original.size).toBe(entry!.size);
  });

  it('returns null for an unsupported file', () => {
    expect(buildPdfMergeEntrySync(makeFile('archive.zip', 'application/zip'))).toBeNull();
  });
});

describe('buildPdfMergeEntry()', () => {
  it('returns the same entry shape as the sync builder when no compression config is provided', async () => {
    const entry = await buildPdfMergeEntry(makeFile('a.pdf', 'application/pdf'), { idFactory: () => 'id-1' });
    expect(entry).not.toBeNull();
    expect(entry!.kind).toBe('pdf');
    expect(entry!.compression).toBe('unchanged');
    expect(entry!.original.name).toBe('a.pdf');
    expect(entry!.original.size).toBe(entry!.size);
  });

  it('skips compression for PDFs even when imageCompression is configured', async () => {
    const entry = await buildPdfMergeEntry(makeFile('a.pdf', 'application/pdf'), { imageCompression: { maxDimension: 256 } });
    expect(entry).not.toBeNull();
    expect(entry!.compression).toBe('unchanged');
  });

  it('returns null for an unsupported file', async () => {
    expect(await buildPdfMergeEntry(makeFile('archive.zip', 'application/zip'))).toBeNull();
  });
});

describe('formatPdfMergeEntrySize()', () => {
  it('formats bytes', () => {
    expect(formatPdfMergeEntrySize(900)).toBe('900 B');
  });

  it('formats kilobytes', () => {
    expect(formatPdfMergeEntrySize(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatPdfMergeEntrySize(2 * 1024 * 1024)).toBe('2.0 MB');
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
      status: 'validating',
      original: { name: file.name, mimeType: file.type, size: file.size },
      compression: 'unchanged',
      encrypted: false
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
      status: 'validating',
      original: { name: file.name, mimeType: file.type, size: file.size },
      compression: 'unchanged',
      encrypted: false
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

  it('marks an encrypted PDF as ready with encrypted=true', async () => {
    const result = await validatePdfMergeEntry(pdfEntry(makePdfFile('locked.pdf', '/Encrypt 1 0 R')));
    expect(result.ok).toBe(true);
    expect(result.encrypted).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  it('does not flag a non-encrypted PDF as encrypted', async () => {
    const result = await validatePdfMergeEntry(pdfEntry(makePdfFile('plain.pdf', 'body')));
    expect(result.ok).toBe(true);
    expect(result.encrypted).toBeUndefined();
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

describe('mergePdfMergeEntries()', () => {
  it('throws when no ready entries are provided', async () => {
    await expect(mergePdfMergeEntries([])).rejects.toThrow('No ready entries');
  });

  it('returns the original file bytes when the only ready entry is a single encrypted PDF', async () => {
    const file = new File(['ENCRYPTED-BYTES'], 'locked.pdf', { type: 'application/pdf' });
    const entry = readyEntry({ file, encrypted: true });
    const blob = await mergePdfMergeEntries([entry]);
    const text = await blob.text();

    expect(blob.type).toBe('application/pdf');
    expect(text).toBe('ENCRYPTED-BYTES');
    expect(blob.size).toBe(file.size);
  });

  it('throws when an encrypted entry is mixed with other ready entries', async () => {
    const encrypted = readyEntry({ file: new File(['x'], 'enc.pdf', { type: 'application/pdf' }), encrypted: true });
    const plain = readyEntry({ id: 'other', file: new File(['y'], 'plain.pdf', { type: 'application/pdf' }) });
    await expect(mergePdfMergeEntries([encrypted, plain])).rejects.toThrow('Encrypted PDFs cannot be merged with other files.');
  });
});
