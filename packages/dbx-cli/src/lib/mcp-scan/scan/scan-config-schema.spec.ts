import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SCAN_OUT_PATH, SCAN_CONFIG_FILENAME, SemanticTypeScanConfig } from './scan-config-schema.js';

const minimal = {
  version: 1,
  source: '@dereekb/util',
  topicNamespace: 'dereekb-util',
  include: ['src/lib/**/*.ts']
};

describe('SemanticTypeScanConfig schema', () => {
  it('accepts a minimal valid config', () => {
    const parsed = SemanticTypeScanConfig(minimal);
    expect(parsed instanceof type.errors).toBe(false);
  });

  it('accepts a config with every optional field', () => {
    const parsed = SemanticTypeScanConfig({
      ...minimal,
      exclude: ['**/*.spec.ts'],
      out: 'dist/semantic-types.mcp.generated.json',
      declaredTopics: ['duration', 'ranges']
    });
    expect(parsed instanceof type.errors).toBe(false);
  });

  it('rejects a config with version: 2', () => {
    const parsed = SemanticTypeScanConfig({ ...minimal, version: 2 });
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('rejects a config with no include patterns', () => {
    const parsed = SemanticTypeScanConfig({ ...minimal, include: [] });
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('rejects a config missing source', () => {
    const { source: _omit, ...rest } = minimal;
    const parsed = SemanticTypeScanConfig(rest);
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('rejects a config missing topicNamespace', () => {
    const { topicNamespace: _omit, ...rest } = minimal;
    const parsed = SemanticTypeScanConfig(rest);
    expect(parsed instanceof type.errors).toBe(true);
  });
});

describe('scan-config constants', () => {
  it('exposes the canonical filename', () => {
    expect(SCAN_CONFIG_FILENAME).toBe('dbx-mcp.scan.json');
  });

  it('exposes the default out path', () => {
    expect(DEFAULT_SCAN_OUT_PATH).toBe('semantic-types.mcp.generated.json');
  });
});
