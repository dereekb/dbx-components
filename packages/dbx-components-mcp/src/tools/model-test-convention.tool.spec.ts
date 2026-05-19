/**
 * Spec for the `dbx_model_test_convention` tool wrapper.
 *
 * Pure-data tool — no filesystem setup needed. Exercises the input arktype
 * validation, the markdown + JSON output shapes, the bucket / subgroups
 * optional path, and the apiDir placeholder fallback.
 */

import { describe, expect, it } from 'vitest';
import { MODEL_TEST_CONVENTION_TOOL } from './model-test-convention.tool.js';

describe('dbx_model_test_convention', () => {
  it('rejects an invalid arg payload', async () => {
    const result = await MODEL_TEST_CONVENTION_TOOL.run({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('rejects subgroups without a bucket', async () => {
    const result = await MODEL_TEST_CONVENTION_TOOL.run({ group: 'job', subgroups: ['requirement'] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('subgroups');
  });

  it('renders both buckets with the placeholder apiDir by default', async () => {
    const result = await MODEL_TEST_CONVENTION_TOOL.run({ group: 'job' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('# Spec convention for `job`');
    expect(text).toContain('<apiDir>/src/app/function/job/job.crud.spec.ts');
    expect(text).toContain('<apiDir>/src/app/function/job/job.scenario.spec.ts');
    expect(text).toContain('## CRUD bucket');
    expect(text).toContain('## Scenario bucket');
    expect(text).toContain('## Drift rules');
  });

  it('substitutes the supplied apiDir', async () => {
    const result = await MODEL_TEST_CONVENTION_TOOL.run({ group: 'job', apiDir: 'apps/demo-api' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('apps/demo-api/src/app/function/job/job.crud.spec.ts');
    expect(text).not.toContain('<apiDir>');
  });

  it('narrows to a single bucket with subgroups', async () => {
    const result = await MODEL_TEST_CONVENTION_TOOL.run({ group: 'job', apiDir: 'apps/demo-api', bucket: 'scenario', subgroups: ['requirement', 'worker'] });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('apps/demo-api/src/app/function/job/job.scenario.requirement.worker.spec.ts');
    expect(text).not.toContain('## CRUD bucket');
  });

  it('returns parseable JSON when format=json', async () => {
    const result = await MODEL_TEST_CONVENTION_TOOL.run({ group: 'profile', format: 'json' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.group).toBe('profile');
    expect(parsed.apiDir).toBe('<apiDir>');
    expect(parsed.recommendations).toHaveLength(2);
    const crud = parsed.recommendations.find((r: { bucket: string }) => r.bucket === 'crud');
    expect(crud.canonicalFilename).toBe('profile.crud.spec.ts');
    expect(crud.canonicalPath).toBe('<apiDir>/src/app/function/profile/profile.crud.spec.ts');
  });
});
