import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { DbxMcpConfig } from './config-schema.js';

describe('DbxMcpConfig schema', () => {
  it('accepts a minimal valid config', () => {
    const parsed = DbxMcpConfig({ version: 1 });
    expect(parsed instanceof type.errors).toBe(false);
  });

  it('accepts a config with empty semanticTypes.sources', () => {
    const parsed = DbxMcpConfig({ version: 1, semanticTypes: { sources: [] } });
    expect(parsed instanceof type.errors).toBe(false);
  });

  it('accepts a config with multiple sources', () => {
    const parsed = DbxMcpConfig({
      version: 1,
      semanticTypes: { sources: ['apps/hellosubs/semantic-types.mcp.json', 'apps/foodflip/semantic-types.mcp.json'] }
    });
    expect(parsed instanceof type.errors).toBe(false);
  });

  it('rejects a config with version: 2', () => {
    const parsed = DbxMcpConfig({ version: 2 });
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('rejects a config missing version', () => {
    const parsed = DbxMcpConfig({ semanticTypes: { sources: [] } });
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('rejects non-string entries in sources', () => {
    const parsed = DbxMcpConfig({ version: 1, semanticTypes: { sources: ['ok.json', 42] } });
    expect(parsed instanceof type.errors).toBe(true);
  });
});
