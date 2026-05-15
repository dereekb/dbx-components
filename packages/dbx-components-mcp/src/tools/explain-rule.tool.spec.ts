import { describe, expect, it } from 'vitest';
import { explainRuleTool } from './explain-rule.tool.js';

describe('dbx_explain_rule', () => {
  it('lists the full catalog when code is omitted', async () => {
    const result = (await explainRuleTool.run({})) as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('# Rule catalog');
    expect(text).toMatch(/\d+ entries/);
    expect(text).toMatch(/^## `dbx_/m);
  });

  it('filters list mode by source', async () => {
    const result = (await explainRuleTool.run({ source: 'dbx_model_validate_folder' })) as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('source=`dbx_model_validate_folder`');
    expect(text).toContain('## `dbx_model_validate_folder`');
    expect(text).not.toContain('## `dbx_storagefile_m_validate_app`');
  });

  it('filters list mode by severity', async () => {
    const result = (await explainRuleTool.run({ severity: 'warning' })) as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('severity=`warning`');
    expect(text).toMatch(/\(warning\) —/);
    expect(text).not.toMatch(/\(error\) —/);
  });

  it('returns JSON in list mode when format=json', async () => {
    const result = (await explainRuleTool.run({ source: 'dbx_model_validate_folder', format: 'json' })) as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(parsed.entries.length).toBeGreaterThan(0);
    for (const entry of parsed.entries as { source: string }[]) {
      expect(entry.source).toBe('dbx_model_validate_folder');
    }
  });

  it('returns isError when filters match no rules', async () => {
    const result = (await explainRuleTool.run({ source: 'dbx_bogus_source' })) as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No rules match');
  });

  it('renders a known code as markdown with all sections', async () => {
    const result = (await explainRuleTool.run({ code: 'FOLDER_NOT_FOUND' })) as { content: { text: string }[]; isError?: boolean };
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('# `FOLDER_NOT_FOUND`');
    expect(text).toContain('## What it flags');
    expect(text).toContain('## When it applies');
    expect(text).toContain('## When it does NOT apply');
    expect(text).toContain('## Canonical fix');
  });

  it('returns the code in JSON when format=json', async () => {
    const result = (await explainRuleTool.run({ code: 'FOLDER_NOT_FOUND', format: 'json' })) as { content: { text: string }[]; isError?: boolean };
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.code).toBe('FOLDER_NOT_FOUND');
    expect(parsed.severity).toBe('error');
    expect(parsed.source).toBe('dbx_model_validate_folder');
  });

  it('treats codes case-insensitively', async () => {
    const result = (await explainRuleTool.run({ code: 'folder_not_found' })) as { content: { text: string }[]; isError?: boolean };
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# `FOLDER_NOT_FOUND`');
  });

  it('falls back to candidate suggestions on an unknown code', async () => {
    const result = (await explainRuleTool.run({ code: 'FOLDER_BOGUS' })) as { content: { text: string }[]; isError?: boolean };
    expect(result.isError).toBe(true);
    const text = result.content[0].text;
    expect(text).toContain('No exact match');
    expect(text).toContain('Top');
    expect(text).toMatch(/FOLDER_/);
  });
});
