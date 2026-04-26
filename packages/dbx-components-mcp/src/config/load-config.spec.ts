import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findAndLoadConfig, type ConfigReadFile } from './load-config.js';

function makeReader(files: Record<string, string>): ConfigReadFile {
  return async (path) => {
    const content = files[path];
    if (content === undefined) {
      throw new Error(`fixture: no entry for path ${path}`);
    }
    return content;
  };
}

describe('findAndLoadConfig', () => {
  it('returns null config and no warnings when the file is absent', async () => {
    const result = await findAndLoadConfig({ cwd: '/repo', readFile: makeReader({}) });
    expect(result.config).toBeNull();
    expect(result.configPath).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it('returns parsed config when the file is present and valid', async () => {
    const path = resolve('/repo', 'dbx-mcp.config.json');
    const reader = makeReader({
      [path]: JSON.stringify({ version: 1, semanticTypes: { sources: ['apps/hellosubs/semantic-types.mcp.json'] } })
    });
    const result = await findAndLoadConfig({ cwd: '/repo', readFile: reader });

    expect(result.config).toEqual({ version: 1, semanticTypes: { sources: ['apps/hellosubs/semantic-types.mcp.json'] } });
    expect(result.configPath).toBe(path);
    expect(result.warnings).toEqual([]);
  });

  it('returns null config plus a config-parse-failed warning on bad JSON', async () => {
    const path = resolve('/repo', 'dbx-mcp.config.json');
    const reader = makeReader({ [path]: '{ invalid json' });
    const result = await findAndLoadConfig({ cwd: '/repo', readFile: reader });

    expect(result.config).toBeNull();
    expect(result.configPath).toBe(path);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]?.kind).toBe('config-parse-failed');
  });

  it('returns null config plus a config-schema-failed warning on schema violation', async () => {
    const path = resolve('/repo', 'dbx-mcp.config.json');
    const reader = makeReader({ [path]: JSON.stringify({ version: 2 }) });
    const result = await findAndLoadConfig({ cwd: '/repo', readFile: reader });

    expect(result.config).toBeNull();
    expect(result.configPath).toBe(path);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]?.kind).toBe('config-schema-failed');
  });

  it('does not walk upward — a deep cwd without a config file returns null', async () => {
    const repoConfigPath = resolve('/repo', 'dbx-mcp.config.json');
    const reader = makeReader({ [repoConfigPath]: JSON.stringify({ version: 1 }) });

    // Even though /repo has a config, /repo/apps/hellosubs/src does not — and
    // findAndLoadConfig must not search parent directories.
    const result = await findAndLoadConfig({ cwd: '/repo/apps/hellosubs/src', readFile: reader });

    expect(result.config).toBeNull();
    expect(result.configPath).toBeNull();
    expect(result.warnings).toEqual([]);
  });
});
