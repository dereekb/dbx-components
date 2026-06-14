import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveSetupNaming } from './naming.js';
import { applyApiTsconfigEdits, applyFirebaseJsonEdits, applyMcpFirebaseJsonRewrites, applyMcpProxyEdits, applyNxJsonEdits, applyOidcFirebaseJsonRewrites, applyOidcProxyEdits, applyTsconfigBaseEdits, buildProxyTarget, editJsonFile, editJsonFileStatus, ensureMcpServerEntry, type JsonObject } from './json-edit.js';

const NAMING = deriveSetupNaming({ firebaseProjectId: 'gethapierapp', projectName: 'gethapier', codePrefix: 'getHapier', emulatorBasePort: 9300 });

describe('applyNxJsonEdits', () => {
  it('sets workspaceLayout, target defaults, and disables the TUI', () => {
    const result = applyNxJsonEdits({ targetDefaults: { existing: { cache: false } } }, NAMING);
    expect(result.workspaceLayout).toEqual({ appsDir: 'apps', libsDir: 'components' });
    expect(result.tui).toEqual({ enabled: false });
    const targetDefaults = result.targetDefaults as JsonObject;
    expect(targetDefaults['build-base']).toEqual({ cache: true });
    expect(targetDefaults['build']).toEqual({ dependsOn: ['^build'], inputs: ['production', '^production'], cache: true });
    expect(targetDefaults['existing']).toEqual({ cache: false });
    expect((targetDefaults['@nx/vitest:test'] as JsonObject).configurations).toEqual({ ci: { ci: true, codeCoverage: true } });
  });
});

describe('applyFirebaseJsonEdits', () => {
  it('rewrites functions, firestore, and emulators with derived ports', () => {
    const result = applyFirebaseJsonEdits({}, NAMING, '24');
    expect(result.functions).toEqual({ source: 'dist/apps/gethapier-api', runtime: 'nodejs24', engines: { node: '24' }, ignore: ['firebase.json', '**/.*', '**/node_modules/**'] });
    expect(result.firestore).toEqual({ rules: 'firestore.rules', indexes: 'firestore.indexes.json' });
    const emulators = result.emulators as JsonObject;
    expect((emulators.ui as JsonObject).port).toBe(9300);
    expect((emulators.firestore as JsonObject).websocketPort).toBe(9308);
    expect((emulators.storage as JsonObject).port).toBe(9306);
  });
});

describe('applyTsconfigBaseEdits / applyApiTsconfigEdits', () => {
  it('merges the base compiler options', () => {
    const result = applyTsconfigBaseEdits({ compilerOptions: { rootDir: '.' } });
    const opts = result.compilerOptions as JsonObject;
    expect(opts.rootDir).toBe('.');
    expect(opts.strict).toBe(true);
    expect(opts.moduleResolution).toBe('bundler');
  });

  it('disables esModuleInterop for the api tsconfig', () => {
    const result = applyApiTsconfigEdits({ compilerOptions: { strict: true } });
    expect((result.compilerOptions as JsonObject).esModuleInterop).toBe(false);
    expect((result.compilerOptions as JsonObject).strict).toBe(true);
  });
});

describe('editJsonFile', () => {
  it('reads, transforms, and writes a JSON file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dbxc-jsonedit-'));
    const path = join(dir, 'nx.json');
    writeFileSync(path, JSON.stringify({ targetDefaults: {} }));
    editJsonFile(path, (current) => applyNxJsonEdits(current, NAMING));
    const written = JSON.parse(readFileSync(path, 'utf8')) as JsonObject;
    expect(written.tui).toEqual({ enabled: false });
  });

  it('returns undefined for a missing file', () => {
    expect(editJsonFile('/no/such/file.json', (current) => current)).toBeUndefined();
  });
});

const TARGET = buildProxyTarget({ functionsPort: 9302, projectId: 'gethapierapp-staging' });

describe('firebase.json hosting rewrites', () => {
  const baseFirebase: JsonObject = {
    hosting: [
      {
        target: 'staging',
        rewrites: [
          { source: '/api/**', function: 'api' },
          { source: '**', destination: '/index.html' }
        ]
      },
      {
        target: 'prod',
        rewrites: [
          { source: '/api/**', function: 'api' },
          { source: '**', destination: '/index.html' }
        ]
      }
    ]
  };

  it('inserts OIDC rewrites before the catch-all on every target', () => {
    const result = applyOidcFirebaseJsonRewrites(baseFirebase);
    const target0 = (result.hosting as JsonObject[])[0];
    const sources = (target0.rewrites as JsonObject[]).map((rewrite) => rewrite.source);
    expect(sources).toEqual(['/api/**', '/.well-known/**', '/oidc/**', '/interaction/**', '**']);
    // every target gets them
    expect((result.hosting as JsonObject[])[1].rewrites).toHaveLength(5);
  });

  it('adds MCP rewrites and is idempotent', () => {
    const once = applyMcpFirebaseJsonRewrites(applyOidcFirebaseJsonRewrites(baseFirebase));
    const twice = applyMcpFirebaseJsonRewrites(applyOidcFirebaseJsonRewrites(once));
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
    const sources = ((once.hosting as JsonObject[])[0].rewrites as JsonObject[]).map((rewrite) => rewrite.source);
    expect(sources).toContain('/mcp/**');
    expect(sources).toContain('/mcp');
    expect(sources[sources.length - 1]).toBe('**');
  });
});

describe('proxy.conf.dev.json edits', () => {
  const baseProxy: JsonObject = {
    '/api/**': { target: 'http://0.0.0.0:9902/dereekb-components/us-central1/api', secure: false, logLevel: 'debug' },
    '/oidc/**': { target: 'http://0.0.0.0:9902/dereekb-components/us-central1/api', secure: false, logLevel: 'debug' }
  };

  it('rewrites every target origin and ensures OIDC keys', () => {
    const result = applyOidcProxyEdits(baseProxy, TARGET);
    expect((result['/api/**'] as JsonObject).target).toBe(TARGET);
    expect((result['/oidc/**'] as JsonObject).target).toBe(TARGET);
    expect((result['/.well-known/**'] as JsonObject).target).toBe(TARGET);
    expect((result['/reg/**'] as JsonObject).target).toBe(TARGET);
    expect(result['/interaction/**'] as JsonObject).toEqual({ target: TARGET, secure: false, logLevel: 'debug' });
  });

  it('ensures MCP keys idempotently', () => {
    const once = applyMcpProxyEdits(applyOidcProxyEdits(baseProxy, TARGET), TARGET);
    const twice = applyMcpProxyEdits(applyOidcProxyEdits(once, TARGET), TARGET);
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
    expect((once['/mcp'] as JsonObject).target).toBe(TARGET);
    expect((once['/mcp/**'] as JsonObject).target).toBe(TARGET);
  });
});

describe('ensureMcpServerEntry', () => {
  it('adds an http server entry without clobbering existing servers', () => {
    const result = ensureMcpServerEntry({ mcpServers: { existing: { type: 'stdio', command: 'x' } } }, { name: 'gethapier-mcp-dev', url: 'http://0.0.0.0:9302/gethapierapp-staging/us-central1/api/mcp' });
    const servers = result.mcpServers as JsonObject;
    expect(servers.existing).toBeDefined();
    expect(servers['gethapier-mcp-dev']).toEqual({ type: 'http', url: 'http://0.0.0.0:9302/gethapierapp-staging/us-central1/api/mcp' });
  });

  it('creates mcpServers when absent and is idempotent', () => {
    const once = ensureMcpServerEntry({}, { name: 'gethapier-mcp-dev', url: 'http://x/mcp' });
    const twice = ensureMcpServerEntry(once, { name: 'gethapier-mcp-dev', url: 'http://x/mcp' });
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
  });
});

describe('editJsonFileStatus', () => {
  it('reports edited then unchanged on a repeat (idempotency)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dbxc-jsonstatus-'));
    const path = join(dir, 'firebase.json');
    writeFileSync(
      path,
      `${JSON.stringify(
        {
          hosting: [
            {
              target: 'staging',
              rewrites: [
                { source: '/api/**', function: 'api' },
                { source: '**', destination: '/index.html' }
              ]
            }
          ]
        },
        null,
        2
      )}\n`
    );

    const first = editJsonFileStatus(path, applyOidcFirebaseJsonRewrites);
    expect(first.status).toBe('edited');
    const second = editJsonFileStatus(path, applyOidcFirebaseJsonRewrites);
    expect(second.status).toBe('unchanged');
  });

  it('reports file-missing for an absent file', () => {
    expect(editJsonFileStatus('/no/such/file.json', (current) => current).status).toBe('file-missing');
  });
});
