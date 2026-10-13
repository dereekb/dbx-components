import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { type FirebaseServerAuthData } from '../auth.context.server';
import { MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '../api.scope';
import { DOCS_AUDIENCE_ANY, docsAudienceReaderForRoles, type DocsApiModuleConfig, type DocsAudienceReader } from './docs.api.config';
import { DOCS_MANIFEST_VERSION, splitDocsMarkdownSections, type DocsManifest, type DocsManifestEntry } from './docs.api.manifest';
import { DOCS_NOT_FOUND_ERROR_CODE, DOCS_SECTION_NOT_FOUND_ERROR_CODE, DocsApiService } from './docs.api.service';

const ANY_DOC = '---\naudience: any\n---\n# Welcome\n\nHello everyone.\n\n## Getting Around\n\nUse the menu.\n';
const ADMIN_DOC = '---\naudience: [admin]\n---\n# Admin Runbook\n\nSecret admin steps.\n\n## Rotate Keys\n\nRotate the signing keys.\n\n### Verify\n\nCheck the JWKS.\n\n## Backups\n\nNightly.\n';
const USER_DOC = '---\naudience: [user, admin]\n---\n# User Guide\n\n## Guestbook Entries\n\nWrite a guestbook entry.\n';

function entryFor(id: string, content: string, input: Pick<DocsManifestEntry, 'title' | 'audience' | 'sections'>): DocsManifestEntry {
  const bytes = Buffer.from(content, 'utf8');
  return { id, path: `${id}.md`, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.byteLength, ...input };
}

function buildFixture(input?: { readonly extraEntries?: readonly DocsManifestEntry[]; readonly reader?: DocsAudienceReader | null; readonly config?: Partial<DocsApiModuleConfig> }) {
  const base = mkdtempSync(path.join(tmpdir(), 'docs-api-'));
  const docsRoot = path.join(base, 'docs');
  mkdirSync(path.join(docsRoot, 'guides'), { recursive: true });
  writeFileSync(path.join(docsRoot, 'welcome.md'), ANY_DOC);
  writeFileSync(path.join(docsRoot, 'admin.md'), ADMIN_DOC);
  writeFileSync(path.join(docsRoot, 'guides', 'user.md'), USER_DOC);

  const docs: DocsManifestEntry[] = [
    entryFor('welcome', ANY_DOC, { title: 'Welcome', audience: ['any'], sections: [{ id: 'getting-around', title: 'Getting Around', depth: 2 }] }),
    entryFor('admin', ADMIN_DOC, {
      title: 'Admin Runbook',
      audience: ['admin'],
      sections: [
        { id: 'rotate-keys', title: 'Rotate Keys', depth: 2 },
        { id: 'verify', title: 'Verify', depth: 3 },
        { id: 'backups', title: 'Backups', depth: 2 }
      ]
    }),
    entryFor('guides/user', USER_DOC, { title: 'User Guide', audience: ['user', 'admin'], sections: [{ id: 'guestbook-entries', title: 'Guestbook Entries', depth: 2 }] }),
    ...(input?.extraEntries ?? [])
  ];

  const manifest: DocsManifest = { version: DOCS_MANIFEST_VERSION, generatedAt: new Date().toISOString(), app: 'test-api', audiences: ['admin', 'user'], docs };
  const docsManifestPath = path.join(base, 'docs.manifest.json');
  writeFileSync(docsManifestPath, JSON.stringify(manifest));

  const reader =
    input?.reader === null
      ? undefined
      : (input?.reader ??
        docsAudienceReaderForRoles({
          roleReader: (auth) => (auth.token['roles'] as string[] | undefined) ?? [],
          audiences: { admin: ['admin'], user: ['user', 'admin'] }
        }));

  const service = new DocsApiService({ docsRoot, docsManifestPath, ...input?.config }, reader);
  return { base, docsRoot, service };
}

function authWithRoles(roles: string[], extra?: Record<string, unknown>): FirebaseServerAuthData {
  return { uid: 'u1', token: { roles, ...extra } } as unknown as FirebaseServerAuthData;
}

function errorCodeOf(fn: () => unknown): unknown {
  let code: unknown;

  try {
    fn();
  } catch (error: any) {
    code = error?.details?.code ?? error?.code;
  }

  return code;
}

describe('DocsApiService', () => {
  describe('listDocs()', () => {
    it('should return only the docs visible to the caller', () => {
      const { service } = buildFixture();
      expect(service.listDocs(authWithRoles([])).docs.map((x) => x.id)).toEqual(['welcome']);
      expect(service.listDocs(authWithRoles(['user'])).docs.map((x) => x.id)).toEqual(['welcome', 'guides/user']);
      expect(service.listDocs(authWithRoles(['admin'])).docs.map((x) => x.id)).toEqual(['welcome', 'admin', 'guides/user']);
    });

    it('should reject an anonymous caller with a 401', () => {
      const { service } = buildFixture();
      expect(() => service.listDocs(undefined)).toThrow();
      expect(service.countVisibleDocs(undefined)).toBe(0);
    });

    it('should enforce the required scope for OIDC callers', () => {
      const { service } = buildFixture({ config: { requiredScope: 'demo' } });
      const oidcAuth = { uid: 'u1', token: { roles: ['admin'] }, oidcValidatedToken: { scope: 'openid' } } as unknown as FirebaseServerAuthData;
      expect(errorCodeOf(() => service.listDocs(oidcAuth))).toBe(MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE);

      const scopedAuth = { uid: 'u1', token: { roles: ['admin'] }, oidcValidatedToken: { scope: 'openid demo' } } as unknown as FirebaseServerAuthData;
      expect(service.listDocs(scopedAuth).docs).toHaveLength(3);
    });
  });

  describe('readDoc()', () => {
    it('should read a whole doc without its frontmatter', () => {
      const { service } = buildFixture();
      const result = service.readDoc(authWithRoles([]), { id: 'welcome' });
      expect(result.content.startsWith('# Welcome')).toBe(true);
      expect(result.sections).toEqual([{ id: 'getting-around', title: 'Getting Around' }]);
    });

    it('should read one section, keeping its H3 subsections', () => {
      const { service } = buildFixture();
      const result = service.readDoc(authWithRoles(['admin']), { id: 'admin', section: 'rotate-keys' });
      expect(result.section).toEqual({ id: 'rotate-keys', title: 'Rotate Keys' });
      expect(result.content).toContain('### Verify');
      expect(result.content).not.toContain('Backups');
    });

    it('should return the same 404 for a hidden doc and a missing doc', () => {
      const { service } = buildFixture();
      const hidden = errorCodeOf(() => service.readDoc(authWithRoles(['user']), { id: 'admin' }));
      const missing = errorCodeOf(() => service.readDoc(authWithRoles(['user']), { id: 'does-not-exist' }));
      expect(hidden).toBe(DOCS_NOT_FOUND_ERROR_CODE);
      expect(missing).toBe(DOCS_NOT_FOUND_ERROR_CODE);
    });

    it('should 404 an unknown section of a visible doc', () => {
      const { service } = buildFixture();
      expect(errorCodeOf(() => service.readDoc(authWithRoles([]), { id: 'welcome', section: 'nope' }))).toBe(DOCS_SECTION_NOT_FOUND_ERROR_CODE);
    });

    it('should refuse a doc whose bytes drifted after load', () => {
      const { service, docsRoot } = buildFixture();
      expect(service.readDoc(authWithRoles([]), { id: 'welcome' }).title).toBe('Welcome');
      writeFileSync(path.join(docsRoot, 'welcome.md'), `${ANY_DOC}\nedited`);
      expect(errorCodeOf(() => service.readDoc(authWithRoles([]), { id: 'welcome' }))).toBe(DOCS_NOT_FOUND_ERROR_CODE);
    });

    it('should truncate content past the max read length', () => {
      const { service } = buildFixture({ config: { maxReadLength: 10 } });
      const result = service.readDoc(authWithRoles([]), { id: 'welcome' });
      expect(result.content).toHaveLength(10);
      expect(result.truncated).toBe(true);
    });
  });

  describe('loading', () => {
    it('should exclude a doc whose file is a symlink escaping the docs folder', () => {
      const outside = '---\naudience: any\n---\n# Outside\n';
      const { service } = buildFixture({ extraEntries: [entryFor('escape', outside, { title: 'Escape', audience: ['any'], sections: [] })] });
      // the fixture's docsRoot is created inside buildFixture; add the escaping symlink before the lazy load
      const docsRoot = (service as unknown as { _config: DocsApiModuleConfig })._config.docsRoot as string;
      const outsidePath = path.join(path.dirname(docsRoot), 'outside.md');
      writeFileSync(outsidePath, outside);
      symlinkSync(outsidePath, path.join(docsRoot, 'escape.md'));

      expect(service.listDocs(authWithRoles([])).docs.map((x) => x.id)).toEqual(['welcome']);
      expect(errorCodeOf(() => service.readDoc(authWithRoles([]), { id: 'escape' }))).toBe(DOCS_NOT_FOUND_ERROR_CODE);
    });

    it('should exclude a doc whose content drifted from the manifest, unless verification is off', () => {
      const drifted = buildFixture();
      writeFileSync(path.join(drifted.docsRoot, 'welcome.md'), `${ANY_DOC}\nchanged`);
      expect(drifted.service.docCount).toBe(2);

      const unverified = buildFixture({ config: { verifyContentHashes: false } });
      writeFileSync(path.join(unverified.docsRoot, 'welcome.md'), `${ANY_DOC}\nchanged`);
      expect(unverified.service.docCount).toBe(3);
    });

    it('should serve no docs without a manifest', () => {
      const service = new DocsApiService({ docsRoot: tmpdir(), docsManifestPath: path.join(tmpdir(), 'no-such-docs.manifest.json') });
      expect(service.docCount).toBe(0);
      expect(service.listDocs(authWithRoles(['admin'])).docs).toHaveLength(0);
    });
  });

  describe('audiences', () => {
    it('should fall back to the "any" audience when the reader throws', () => {
      const { service } = buildFixture({
        reader: () => {
          throw new Error('boom');
        }
      });
      expect(service.listDocs(authWithRoles(['admin'])).docs.map((x) => x.id)).toEqual(['welcome']);
    });

    it('should grant only the "any" audience without a reader', () => {
      const { service } = buildFixture({ reader: null });
      expect(service.countVisibleDocs(authWithRoles(['admin']))).toBe(1);
    });

    it('docsAudienceReaderForRoles() should grant each audience a listed role maps to', () => {
      const reader = docsAudienceReaderForRoles({ roleReader: () => ['worker'], audiences: { admin: ['admin'], worker: ['admin', 'worker'] } });
      expect([...reader(authWithRoles([]))]).toEqual(['worker']);
      expect(DOCS_AUDIENCE_ANY).toBe('any');
    });
  });

  describe('searchDocs()', () => {
    it('should rank section hits and never return hidden docs', () => {
      const { service } = buildFixture();
      const adminResult = service.searchDocs(authWithRoles(['admin']), { query: 'rotate keys' });
      expect(adminResult.results[0]).toMatchObject({ id: 'admin', section: { id: 'rotate-keys' } });

      const userResult = service.searchDocs(authWithRoles(['user']), { query: 'rotate keys' });
      expect(userResult.results.every((x) => x.id !== 'admin')).toBe(true);
    });

    it('should fall back to matching any word', () => {
      const { service } = buildFixture();
      const result = service.searchDocs(authWithRoles(['user']), { query: 'guestbook zebra' });
      expect(result.results[0]).toMatchObject({ id: 'guides/user', section: { id: 'guestbook-entries' } });
    });

    it('should respect the limit', () => {
      const { service } = buildFixture();
      expect(service.searchDocs(authWithRoles(['admin']), { query: 'the', limit: 1 }).results).toHaveLength(1);
    });
  });

  describe('splitDocsMarkdownSections()', () => {
    it('should ignore headings inside fenced code', () => {
      const split = splitDocsMarkdownSections('# T\n\nintro\n\n```\n## Not a heading\n```\n\n## Real\n\nbody', [{ id: 'real', title: 'Real', depth: 2 }]);
      expect(split.intro).toContain('## Not a heading');
      expect(split.sections[0].ownText).toBe('body');
    });
  });
});
