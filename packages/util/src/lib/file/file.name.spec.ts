import { fileNameWithSuffix, sanitizeFileName } from './file.name';

describe('sanitizeFileName()', () => {
  describe('strict', () => {
    // ported from msgraph-cli sanitizeMsGraphCliFileName: mail attachment names on disk depend on these staying identical
    it('removes path traversal', () => {
      expect(sanitizeFileName('../../etc/passwd')).toBe('etc_passwd');
    });

    it('drops leading dots', () => {
      expect(sanitizeFileName('...hidden.txt')).toBe('hidden.txt');
    });

    it('returns the fallback when nothing is left', () => {
      expect(sanitizeFileName('', { fallback: 'attachment' })).toBe('attachment');
      expect(sanitizeFileName(undefined)).toBe('file');
      expect(sanitizeFileName('...')).toBe('file');
    });

    it('caps a long name, keeping its extension', () => {
      expect(sanitizeFileName(`${'a'.repeat(200)}.pdf`, { maxLength: 20 })).toBe(`${'a'.repeat(16)}.pdf`);
      expect(sanitizeFileName(`${'a'.repeat(200)}.pdf`)).toHaveLength(80);
    });

    it('replaces non-ASCII characters and collapses underscores', () => {
      expect(sanitizeFileName('Résumé 2026.pdf')).toBe('R_sum_ 2026.pdf');
      expect(sanitizeFileName(String.raw`a//b\\c.txt`)).toBe('a_b_c.txt');
    });

    it('replaces a .. inside a name', () => {
      expect(sanitizeFileName('a..b.txt')).toBe('a_b.txt');
    });
  });

  describe('portable', () => {
    const portable = (name: string, maxLength?: number) => sanitizeFileName(name, { mode: 'portable', maxLength });

    it('keeps Unicode, spaces and leading dots', () => {
      expect(portable('Résumé — 2026 (final).pdf')).toBe('Résumé — 2026 (final).pdf');
      expect(portable('.gitignore')).toBe('.gitignore');
      expect(portable('日本語のファイル.docx')).toBe('日本語のファイル.docx');
    });

    it('NFC-normalizes the name', () => {
      const decomposed = 'Résumé.pdf';
      expect(portable(decomposed)).toBe('Résumé.pdf');
    });

    it('replaces what a file system rejects', () => {
      expect(portable(String.raw`a/b\c<d>e:f"g|h?i*j.txt`)).toBe('a_b_c_d_e_f_g_h_i_j.txt');
      expect(portable('tab\there\u0000nul\u007fdel')).toBe('tab_here_nul_del');
    });

    it('trims trailing dots and spaces', () => {
      expect(portable('notes. . ')).toBe('notes');
    });

    it('maps . and .. and empty names to the fallback', () => {
      expect(portable('.')).toBe('file');
      expect(portable('..')).toBe('file');
      expect(portable('')).toBe('file');
      expect(portable('   ')).toBe('file');
    });

    it('prefixes Windows device names, with or without an extension', () => {
      expect(portable('CON')).toBe('_CON');
      expect(portable('nul.txt')).toBe('_nul.txt');
      expect(portable('com1.tar.gz')).toBe('_com1.tar.gz');
      expect(portable('LPT9')).toBe('_LPT9');
      expect(portable('CONSOLE.txt')).toBe('CONSOLE.txt');
      expect(portable('COM0')).toBe('COM0');
    });

    it('caps a long name in UTF-8 bytes, keeping the extension and never splitting a code point', () => {
      const name = `${'é'.repeat(200)}.pdf`; // 400 bytes of stem
      const result = portable(name);
      expect(new TextEncoder().encode(result).length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.pdf')).toBe(true);
      expect(result).toBe(`${'é'.repeat(125)}.pdf`);
    });

    it('caps a name with a multi-byte character at the cut without splitting it', () => {
      expect(portable('ab😀cd', 5)).toBe('ab');
      expect(portable('ab😀cd', 6)).toBe('ab😀');
    });

    it('re-trims trailing dots and spaces after a cut without an extension', () => {
      expect(portable('abc. def', 4)).toBe('abc');
    });
  });
});

describe('fileNameWithSuffix()', () => {
  it('inserts the suffix before the extension', () => {
    expect(fileNameWithSuffix('report.pdf', ' (1a2b3c4d)')).toBe('report (1a2b3c4d).pdf');
    expect(fileNameWithSuffix('archive.tar.gz', ' (1)')).toBe('archive.tar (1).gz');
  });

  it('appends the suffix when there is no extension', () => {
    expect(fileNameWithSuffix('README', ' (1)')).toBe('README (1)');
    expect(fileNameWithSuffix('.bashrc', ' (1)')).toBe('.bashrc (1)');
  });
});
