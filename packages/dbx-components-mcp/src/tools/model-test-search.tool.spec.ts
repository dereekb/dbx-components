/**
 * Spec for the `dbx_model_test_search` tool wrapper.
 *
 * Spins up a temp workspace, writes a synthetic spec file, points the tool
 * at it via `process.chdir`, and verifies that each query mode returns
 * sensible hits.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { modelTestSearchTool } from './model-test-search.tool.js';

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

describe('dbx_model_test_search', () => {
  let workspace: string;
  let originalCwd: string;
  const specRel = 'spec.spec.ts';

  beforeEach(async () => {
    originalCwd = process.cwd();
    workspace = await mkdtemp(join(tmpdir(), 'dbx-model-test-search-'));
    process.chdir(workspace);
    await writeFile(join(workspace, specRel), SPEC_TEXT, 'utf8');
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(workspace, { recursive: true, force: true });
  });

  it('rejects when no query field is supplied', async () => {
    const result = await modelTestSearchTool.run({ specFile: specRel });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('exactly one of');
  });

  it('rejects when more than one query field is supplied', async () => {
    const result = await modelTestSearchTool.run({ specFile: specRel, model: 'Job', describe: 'admin' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('exactly one query field');
  });

  it('finds fixture hits by model', async () => {
    const result = await modelTestSearchTool.run({ specFile: specRel, model: 'Job' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('hellosubsJobContext');
    expect(text).toContain('Job');
  });

  it('finds describe hits by substring', async () => {
    const result = await modelTestSearchTool.run({ specFile: specRel, describe: 'admin' });
    const text = result.content[0].text;
    expect(text).toContain('admin');
  });

  it('returns parseable JSON when format=json', async () => {
    const result = await modelTestSearchTool.run({ specFile: specRel, it: 'publishes', format: 'json' });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.hits).toHaveLength(1);
    expect(parsed.hits[0].fixtureChain).toEqual(['Country', 'Job']);
  });
});
