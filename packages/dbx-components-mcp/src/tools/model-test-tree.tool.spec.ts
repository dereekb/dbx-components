/**
 * Spec for the `dbx_model_test_tree` tool wrapper.
 *
 * Spins up a temp workspace, writes a synthetic spec file, points the tool
 * at it via `process.chdir`, and verifies the markdown / JSON output.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { modelTestTreeTool } from './model-test-tree.tool.js';

const SPEC_TEXT = `import { hellosubsApiFunctionContextFactory, hellosubsCountryContext, hellosubsJobContext } from '../../../test/fixture';
hellosubsApiFunctionContextFactory((f) => {
  describe('admin', () => {
    hellosubsCountryContext({ f }, (rc) => {
      hellosubsJobContext({ f }, (j) => {
        it('publishes', () => {});
      });
    });
  });
});
`;

describe('dbx_model_test_tree', () => {
  let workspace: string;
  let originalCwd: string;
  const specRel = 'spec.spec.ts';

  beforeEach(async () => {
    originalCwd = process.cwd();
    workspace = await mkdtemp(join(tmpdir(), 'dbx-model-test-tree-'));
    process.chdir(workspace);
    await writeFile(join(workspace, specRel), SPEC_TEXT, 'utf8');
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(workspace, { recursive: true, force: true });
  });

  it('rejects an invalid arg payload', async () => {
    const result = await modelTestTreeTool.run({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('rejects a path outside the cwd', async () => {
    const result = await modelTestTreeTool.run({ specFile: '../escape.spec.ts' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('outside the server cwd');
  });

  it('returns a markdown tree by default', async () => {
    const result = await modelTestTreeTool.run({ specFile: specRel });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('Spec tree');
    expect(text).toContain('admin');
    expect(text).toContain('Country');
    expect(text).toContain('Job');
    expect(text).toContain('publishes');
  });

  it('honours the `view` argument', async () => {
    const result = await modelTestTreeTool.run({ specFile: specRel, view: 'fixtures' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).not.toContain('**describe**');
    expect(text).toContain('Country');
    expect(text).toContain('Job');
  });

  it('returns parseable JSON when format=json', async () => {
    const result = await modelTestTreeTool.run({ specFile: specRel, format: 'json', view: 'its' });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.its).toHaveLength(1);
    expect(parsed.its[0].title).toBe('publishes');
  });
});
