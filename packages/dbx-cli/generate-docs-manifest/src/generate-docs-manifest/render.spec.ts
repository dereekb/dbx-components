import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { countDocsManifestGenerationErrors, formatDocsManifestFinding, renderDocsManifest, scanDocsFolder } from './render';

describe('generate-docs-manifest', () => {
  let baseDir: string;
  let docsDir: string;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'dbx-docs-manifest-'));
    docsDir = join(baseDir, 'docs');
    await mkdir(join(docsDir, 'guides'), { recursive: true });
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  describe('scanDocsFolder()', () => {
    it('should read nested markdown files with POSIX paths', async () => {
      await writeFile(join(docsDir, 'about.md'), '# About');
      await writeFile(join(docsDir, 'guides', 'setup.md'), '# Setup');
      await writeFile(join(docsDir, '.DS_Store'), '');

      const result = await scanDocsFolder(docsDir);
      expect(result.findings).toHaveLength(0);
      expect(result.files.map((x) => x.path)).toEqual(['about.md', 'guides/setup.md']);
    });

    it('should report non-markdown files, dotfiles and escaping symlinks', async () => {
      await writeFile(join(docsDir, 'image.png'), '');
      await writeFile(join(docsDir, '.hidden.md'), '# Hidden');
      await writeFile(join(baseDir, 'outside.md'), '# Outside');
      await symlink(join(baseDir, 'outside.md'), join(docsDir, 'escape.md'));
      await symlink(join(docsDir, 'guides'), join(docsDir, 'inside-link'));

      const result = await scanDocsFolder(docsDir);
      expect(result.findings.map((x) => [x.code, x.path])).toEqual([
        ['DOCS_DOTFILE', '.hidden.md'],
        ['DOCS_SYMLINK_ESCAPE', 'escape.md'],
        ['DOCS_NOT_MARKDOWN', 'image.png']
      ]);
    });
  });

  describe('renderDocsManifest()', () => {
    it('should build the manifest from the folder', async () => {
      await writeFile(join(docsDir, 'guides', 'setup.md'), '---\naudience: [user]\n---\n# Setup\n## Install\n');

      const { manifest, findings } = await renderDocsManifest({ docsDir, app: 'demo-api', audiences: ['admin', 'user'] });
      expect(findings).toHaveLength(0);
      expect(manifest.app).toBe('demo-api');
      expect(manifest.docs.map((x) => x.id)).toEqual(['guides/setup']);
    });

    it('should report an empty folder unless allowEmpty is set', async () => {
      const empty = await renderDocsManifest({ docsDir, app: 'x', audiences: ['admin'] });
      expect(empty.findings.map((x) => x.code)).toEqual(['DOCS_EMPTY']);

      const allowed = await renderDocsManifest({ docsDir, app: 'x', audiences: ['admin'], allowEmpty: true });
      expect(allowed.findings).toHaveLength(0);
      expect(allowed.manifest.docs).toHaveLength(0);
    });
  });

  describe('countDocsManifestGenerationErrors()', () => {
    it('should count errors, and warnings under strict', () => {
      const findings = [
        { code: 'DOCS_TITLE_MISSING', severity: 'warning', message: 'x' },
        { code: 'DOCS_NOT_MARKDOWN', severity: 'error', path: 'a.png', message: 'y' }
      ] as const;

      expect(countDocsManifestGenerationErrors({ findings })).toBe(1);
      expect(countDocsManifestGenerationErrors({ findings, strict: true })).toBe(2);
      expect(formatDocsManifestFinding(findings[1])).toBe('[error] DOCS_NOT_MARKDOWN a.png: y');
    });
  });
});
