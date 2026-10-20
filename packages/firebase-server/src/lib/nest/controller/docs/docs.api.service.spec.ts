import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { type FirebaseServerAuthData } from '../auth.context.server';
import { MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '../api.scope';
import { DOCS_AUDIENCE_ANY, docsAudienceReaderForRoles, type DocsApiModuleConfig, type DocsAudienceReader } from './docs.api.config';
import { DOCS_MANIFEST_VERSION, extractDocsMarkdownSections, slugifyDocsHeading, splitDocsMarkdownSections, type DocsManifest, type DocsManifestEntry } from './docs.api.manifest';
import { type DynamicDocsEntry, type DynamicDocsSource } from './docs.api.dynamic';
import { DOCS_NOT_FOUND_ERROR_CODE, DOCS_SECTION_NOT_FOUND_ERROR_CODE, DocsApiService } from './docs.api.service';

const ANY_DOC = '---\naudience: any\n---\n# Welcome\n\nHello everyone.\n\n## Getting Around\n\nUse the menu.\n';
const ADMIN_DOC = '---\naudience: [admin]\n---\n# Admin Runbook\n\nSecret admin steps.\n\n## Rotate Keys\n\nRotate the signing keys.\n\n### Verify\n\nCheck the JWKS.\n\n## Backups\n\nNightly.\n';
const USER_DOC = '---\naudience: [user, admin]\n---\n# User Guide\n\n## Guestbook Entries\n\nWrite a guestbook entry.\n';

const CATALOG_CONTENT = ['# Catalog', '', '## Widgets', '', 'Widget text.', '', '### Gadget Specs', '', 'Specs.', '', '```md', '## Not A Heading', '```', '', '## Widgets', '', 'More widgets.', ''].join('\n');

const DYNAMIC_DOCS: readonly DynamicDocsEntry[] = [
  { id: 'dynamic/catalog', title: 'Catalog', description: 'Built in code.', tags: ['catalog'], audience: ['user'], content: CATALOG_CONTENT },
  { id: 'dynamic/secret', title: 'Secret Catalog', audience: ['admin'], content: '# Secret Catalog\n\n## Hidden Things\n\nShh.\n' },
  { id: 'faq/guestbook', title: 'Guestbook FAQ', audience: ['any'], content: '# Guestbook FAQ\n\n## Answers\n\nYes.\n' }
];

function dynamicSource(docs: readonly DynamicDocsEntry[], name = 'test'): DynamicDocsSource {
  return { name, loadDocs: () => docs };
}

function entryFor(id: string, content: string, input: Pick<DocsManifestEntry, 'title' | 'audience' | 'sections'> & Partial<Pick<DocsManifestEntry, 'description' | 'tags'>>): DocsManifestEntry {
  const bytes = Buffer.from(content, 'utf8');
  return { id, path: `${id}.md`, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.byteLength, ...input };
}

function buildFixture(input?: { readonly extraEntries?: readonly DocsManifestEntry[]; readonly reader?: DocsAudienceReader | null; readonly config?: Partial<DocsApiModuleConfig>; readonly dynamicSources?: readonly DynamicDocsSource[] }) {
  const base = mkdtempSync(path.join(tmpdir(), 'docs-api-'));
  const docsRoot = path.join(base, 'docs');
  mkdirSync(path.join(docsRoot, 'guides'), { recursive: true });
  writeFileSync(path.join(docsRoot, 'welcome.md'), ANY_DOC);
  writeFileSync(path.join(docsRoot, 'admin.md'), ADMIN_DOC);
  writeFileSync(path.join(docsRoot, 'guides', 'user.md'), USER_DOC);

  const docs: DocsManifestEntry[] = [
    entryFor('welcome', ANY_DOC, { title: 'Welcome', description: 'Start here.', tags: ['onboarding'], audience: ['any'], sections: [{ id: 'getting-around', title: 'Getting Around', depth: 2 }] }),
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

  const service = new DocsApiService({ docsRoot, docsManifestPath, ...input?.config }, reader, input?.dynamicSources);
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
      expect(service.listDocs(authWithRoles(['user'])).docs.map((x) => x.id)).toEqual(['guides/user', 'welcome']);
      expect(service.listDocs(authWithRoles(['admin'])).docs.map((x) => x.id)).toEqual(['admin', 'guides/user', 'welcome']);
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
    it('should load docs from the manifest without reading their files', () => {
      const { service, docsRoot } = buildFixture();
      unlinkSync(path.join(docsRoot, 'welcome.md'));

      expect(service.docCount).toBe(3);
      expect(service.listDocs(authWithRoles([])).docs.map((x) => x.id)).toEqual(['welcome']);
      expect(service.searchDocs(authWithRoles([]), { query: 'welcome' }).results[0]).toMatchObject({ id: 'welcome' });
      expect(errorCodeOf(() => service.readDoc(authWithRoles([]), { id: 'welcome' }))).toBe(DOCS_NOT_FOUND_ERROR_CODE);
    });

    it('should refuse to read a doc whose file is a symlink escaping the docs folder', () => {
      const outside = '---\naudience: any\n---\n# Outside\n';
      const { service } = buildFixture({ extraEntries: [entryFor('escape', outside, { title: 'Escape', audience: ['any'], sections: [] })] });
      // the fixture's docsRoot is created inside buildFixture; add the escaping symlink before the lazy load
      const docsRoot = (service as unknown as { _config: DocsApiModuleConfig })._config.docsRoot as string;
      const outsidePath = path.join(path.dirname(docsRoot), 'outside.md');
      writeFileSync(outsidePath, outside);
      symlinkSync(outsidePath, path.join(docsRoot, 'escape.md'));

      expect(errorCodeOf(() => service.readDoc(authWithRoles([]), { id: 'escape' }))).toBe(DOCS_NOT_FOUND_ERROR_CODE);
    });

    it('should read a doc whose content drifted from the manifest when verification is off', () => {
      const { service, docsRoot } = buildFixture({ config: { verifyContentHashes: false } });
      writeFileSync(path.join(docsRoot, 'welcome.md'), `${ANY_DOC}\nchanged`);
      expect(service.readDoc(authWithRoles([]), { id: 'welcome' }).content).toContain('changed');
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

    it('should match tags and return the description on doc hits only', () => {
      const { service } = buildFixture();
      expect(service.searchDocs(authWithRoles([]), { query: 'onboarding' }).results).toEqual([{ id: 'welcome', title: 'Welcome', description: 'Start here.' }]);

      const sectionHit = service.searchDocs(authWithRoles([]), { query: 'getting around' }).results[0];
      expect(sectionHit).toEqual({ id: 'welcome', title: 'Welcome', section: { id: 'getting-around', title: 'Getting Around' } });
    });

    it('should not search doc bodies', () => {
      const { service } = buildFixture();
      expect(service.searchDocs(authWithRoles(['admin']), { query: 'nightly' }).total).toBe(0);
    });

    it('should fall back to matching any word', () => {
      const { service } = buildFixture();
      const result = service.searchDocs(authWithRoles(['user']), { query: 'guestbook zebra' });
      expect(result.results[0]).toMatchObject({ id: 'guides/user', section: { id: 'guestbook-entries' } });
    });

    it('should respect the limit', () => {
      const { service } = buildFixture();
      const result = service.searchDocs(authWithRoles(['admin']), { query: 'admin', limit: 1 });
      expect(result.total).toBeGreaterThan(1);
      expect(result.results).toHaveLength(1);
    });
  });

  describe('dynamic docs', () => {
    function buildDynamicFixture(input?: { readonly config?: Partial<DocsApiModuleConfig> }) {
      return buildFixture({ ...input, dynamicSources: [dynamicSource(DYNAMIC_DOCS)] });
    }

    it('should list file and dynamic docs together, sorted by id', () => {
      const { service } = buildDynamicFixture();
      expect(service.listDocs(authWithRoles([])).docs.map((x) => x.id)).toEqual(['faq/guestbook', 'welcome']);
      expect(service.listDocs(authWithRoles(['user'])).docs.map((x) => x.id)).toEqual(['dynamic/catalog', 'faq/guestbook', 'guides/user', 'welcome']);
      expect(service.listDocs(authWithRoles(['admin'])).docs.map((x) => x.id)).toEqual(['admin', 'dynamic/catalog', 'dynamic/secret', 'faq/guestbook', 'guides/user', 'welcome']);
      expect(service.docCount).toBe(6);
      expect(service.countVisibleDocs(authWithRoles([]))).toBe(2);
      expect(service.countVisibleDocs(authWithRoles(['user']))).toBe(4);
    });

    it('should read a dynamic doc and its sections', () => {
      const { service } = buildDynamicFixture();
      const auth = authWithRoles(['user']);
      const whole = service.readDoc(auth, { id: 'dynamic/catalog' });
      expect(whole.content.startsWith('# Catalog')).toBe(true);
      expect(whole.description).toBe('Built in code.');
      expect(whole.sections?.map((x) => x.id)).toEqual(['widgets', 'gadget-specs', 'widgets-2']);

      const widgets = service.readDoc(auth, { id: 'dynamic/catalog', section: 'widgets' });
      expect(widgets.section).toEqual({ id: 'widgets', title: 'Widgets' });
      expect(widgets.content).toContain('### Gadget Specs');
      expect(widgets.content).toContain('## Not A Heading');
      expect(widgets.content).not.toContain('More widgets');

      expect(service.readDoc(auth, { id: 'dynamic/catalog', section: 'widgets-2' }).content).toBe('## Widgets\n\nMore widgets.');
      expect(errorCodeOf(() => service.readDoc(auth, { id: 'dynamic/catalog', section: 'nope' }))).toBe(DOCS_SECTION_NOT_FOUND_ERROR_CODE);
    });

    it('should return the same 404 for a hidden dynamic doc and a missing one', () => {
      const { service } = buildDynamicFixture();
      expect(errorCodeOf(() => service.readDoc(authWithRoles(['user']), { id: 'dynamic/secret' }))).toBe(DOCS_NOT_FOUND_ERROR_CODE);
      expect(errorCodeOf(() => service.readDoc(authWithRoles(['user']), { id: 'dynamic/nope' }))).toBe(DOCS_NOT_FOUND_ERROR_CODE);
    });

    it('should apply the auth and scope checks to dynamic docs', () => {
      const { service } = buildDynamicFixture({ config: { requiredScope: 'demo' } });
      expect(() => service.listDocs(undefined)).toThrow();
      expect(() => service.searchDocs(undefined, { query: 'catalog' })).toThrow();
      expect(() => service.readDoc(undefined, { id: 'faq/guestbook' })).toThrow();
      expect(service.countVisibleDocs(undefined)).toBe(0);

      const oidcAuth = { uid: 'u1', token: { roles: ['user'] }, oidcValidatedToken: { scope: 'openid' } } as unknown as FirebaseServerAuthData;
      expect(errorCodeOf(() => service.readDoc(oidcAuth, { id: 'dynamic/catalog' }))).toBe(MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE);
    });

    it('should rank file and dynamic docs together', () => {
      const { service } = buildDynamicFixture();
      const user = authWithRoles(['user']);
      expect(service.searchDocs(user, { query: 'guestbook' }).results).toEqual([
        { id: 'faq/guestbook', title: 'Guestbook FAQ' },
        { id: 'guides/user', title: 'User Guide', section: { id: 'guestbook-entries', title: 'Guestbook Entries' } },
        { id: 'faq/guestbook', title: 'Guestbook FAQ', section: { id: 'answers', title: 'Answers' } }
      ]);
      expect(service.searchDocs(user, { query: 'catalog' }).results[0]).toEqual({ id: 'dynamic/catalog', title: 'Catalog', description: 'Built in code.' });
      expect(service.searchDocs(user, { query: 'hidden things' }).total).toBe(0);
      expect(service.searchDocs(authWithRoles(['admin']), { query: 'hidden things' }).results[0]).toMatchObject({ id: 'dynamic/secret', section: { id: 'hidden-things' } });
    });

    it('should call loadDocs once, on first use', () => {
      let calls = 0;
      const source: DynamicDocsSource = {
        name: 'counting',
        loadDocs: () => {
          calls += 1;
          return DYNAMIC_DOCS;
        }
      };

      const { service } = buildFixture({ dynamicSources: [source] });
      expect(calls).toBe(0);

      const auth = authWithRoles(['user']);
      expect(service.docCount).toBe(6);
      service.listDocs(auth);
      service.searchDocs(auth, { query: 'catalog' });
      service.readDoc(auth, { id: 'dynamic/catalog' });
      service.countVisibleDocs(auth);
      expect(calls).toBe(1);
    });

    it('should keep serving the other docs when a source throws', () => {
      const throwing: DynamicDocsSource = {
        name: 'throwing',
        loadDocs: () => {
          throw new Error('boom');
        }
      };

      const { service } = buildFixture({ dynamicSources: [throwing, dynamicSource(DYNAMIC_DOCS, 'good')] });
      expect(service.listDocs(authWithRoles(['admin'])).docs).toHaveLength(6);
      expect(service.readDoc(authWithRoles([]), { id: 'faq/guestbook' }).title).toBe('Guestbook FAQ');
    });

    it('should skip a dynamic doc whose id is already taken', () => {
      const { service } = buildFixture({ dynamicSources: [dynamicSource([{ id: 'welcome', title: 'Dynamic Welcome', audience: ['any'], content: '# Dynamic Welcome\n' }])] });
      expect(service.readDoc(authWithRoles([]), { id: 'welcome' }).title).toBe('Welcome');
      expect(service.docCount).toBe(3);

      const shared = (title: string): DynamicDocsEntry => ({ id: 'shared/doc', title, audience: ['any'], content: `# ${title}\n` });
      const { service: sharedService } = buildFixture({ dynamicSources: [dynamicSource([shared('First')], 'first'), dynamicSource([shared('Second')], 'second')] });
      expect(sharedService.readDoc(authWithRoles([]), { id: 'shared/doc' }).title).toBe('First');
      expect(sharedService.docCount).toBe(4);
    });

    it('should skip a dynamic doc with no id or no audience', () => {
      const { service } = buildFixture({
        dynamicSources: [
          dynamicSource([
            { id: '', title: 'No Id', audience: ['any'], content: '# No Id\n' },
            { id: 'no-audience', title: 'No Audience', audience: [], content: '# No Audience\n' }
          ])
        ]
      });
      expect(service.docCount).toBe(3);
      expect(errorCodeOf(() => service.readDoc(authWithRoles(['admin']), { id: 'no-audience' }))).toBe(DOCS_NOT_FOUND_ERROR_CODE);
    });

    it('should serve dynamic docs without a docs manifest', () => {
      const service = new DocsApiService({}, undefined, [dynamicSource(DYNAMIC_DOCS)]);
      expect(service.docCount).toBe(3);
      expect(service.listDocs(authWithRoles([])).docs.map((x) => x.id)).toEqual(['faq/guestbook']);
      expect(service.readDoc(authWithRoles([]), { id: 'faq/guestbook', section: 'answers' }).content).toBe('## Answers\n\nYes.');
    });

    it('should truncate a dynamic doc past the max read length', () => {
      const { service } = buildDynamicFixture({ config: { maxReadLength: 10 } });
      const result = service.readDoc(authWithRoles(['user']), { id: 'dynamic/catalog' });
      expect(result.content).toHaveLength(10);
      expect(result.truncated).toBe(true);
    });

    it('should drop a leading frontmatter block from dynamic content', () => {
      const { service } = buildFixture({ dynamicSources: [dynamicSource([{ id: 'fm', title: 'Doc', audience: ['any'], content: '---\ntitle: x\n---\n# Doc\n\n## Part\n\nText.\n' }])] });
      const whole = service.readDoc(authWithRoles([]), { id: 'fm' });
      expect(whole.sections?.map((x) => x.id)).toEqual(['part']);
      expect(whole.content).not.toContain('title: x');
      expect(service.readDoc(authWithRoles([]), { id: 'fm', section: 'part' }).content).toBe('## Part\n\nText.');
    });
  });

  describe('splitDocsMarkdownSections()', () => {
    it('should ignore headings inside fenced code', () => {
      const split = splitDocsMarkdownSections('# T\n\nintro\n\n```\n## Not a heading\n```\n\n## Real\n\nbody', [{ id: 'real', title: 'Real', depth: 2 }]);
      expect(split.sections.map((x) => x.content)).toEqual(['## Real\n\nbody']);
    });
  });

  describe('extractDocsMarkdownSections()', () => {
    it('should extract H2/H3 headings, skip fenced code and dedupe ids', () => {
      const body = ['# Title', '## Getting Started', 'text', '```md', '## Not A Heading', '```', '### Step `one`', '## Getting Started', '#### Too deep'].join('\n');
      expect(extractDocsMarkdownSections(body)).toEqual([
        { id: 'getting-started', title: 'Getting Started', depth: 2 },
        { id: 'step-one', title: 'Step `one`', depth: 3 },
        { id: 'getting-started-2', title: 'Getting Started', depth: 2 }
      ]);
    });

    it('should skip a leading frontmatter block', () => {
      expect(extractDocsMarkdownSections('---\ntitle: x\n## not a section\n---\n## Real\n')).toEqual([{ id: 'real', title: 'Real', depth: 2 }]);
    });
  });

  describe('slugifyDocsHeading()', () => {
    it('should slug headings like the docs manifest generator', () => {
      expect(slugifyDocsHeading('Use [the API](https://x.y) & more!')).toBe('use-the-api-more');
      expect(slugifyDocsHeading('!!!')).toBe('section');
      expect(slugifyDocsHeading('snake_case')).toBe('snakecase');
    });
  });
});
