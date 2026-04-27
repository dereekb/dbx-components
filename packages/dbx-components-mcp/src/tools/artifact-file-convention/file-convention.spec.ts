import { describe, expect, it } from 'vitest';
import { runArtifactFileConvention } from '../artifact-file-convention.tool.js';
import { FILE_CONVENTIONS, formatSpec, getFileConventionSpec, listArtifactKinds } from './index.js';
import type { ArtifactKind } from './types.js';

const EXPECTED_KINDS: readonly ArtifactKind[] = ['firestore-model', 'storagefile-purpose', 'storagefile-upload-handler', 'storagefile-processor', 'storagefile-processor-subtask', 'notification-template', 'notification-task', 'nestjs-model-module', 'nestjs-function-module', 'nestjs-app-module'];

describe('FILE_CONVENTIONS catalog', () => {
  it('exposes one spec per supported artifact kind', () => {
    expect(listArtifactKinds()).toEqual(EXPECTED_KINDS);
    expect(FILE_CONVENTIONS).toHaveLength(EXPECTED_KINDS.length);
  });

  it('every spec has a non-empty title, summary, and at least one step', () => {
    for (const spec of FILE_CONVENTIONS) {
      expect(spec.title.length).toBeGreaterThan(0);
      expect(spec.summary.length).toBeGreaterThan(0);
      expect(spec.steps.length).toBeGreaterThan(0);
      for (const step of spec.steps) {
        expect(step.heading.length).toBeGreaterThan(0);
        expect(step.body.length).toBeGreaterThan(0);
      }
    }
  });

  it('every `seeAlso` reference resolves to a registered artifact', () => {
    const known = new Set(EXPECTED_KINDS);
    for (const spec of FILE_CONVENTIONS) {
      for (const ref of spec.seeAlso ?? []) {
        expect(known, `${spec.artifact} references unknown artifact ${ref}`).toContain(ref);
      }
    }
  });
});

describe('formatSpec — placeholder substitution', () => {
  it('renders placeholders verbatim when no values are supplied', () => {
    const spec = getFileConventionSpec('storagefile-purpose');
    if (!spec) throw new Error('expected spec');
    const md = formatSpec(spec, { componentDir: undefined, apiDir: undefined, name: undefined });
    expect(md).toContain('<componentDir>/src/lib/model/storagefile/storagefile.<name>.ts');
    expect(md).toContain('<NAME>_PURPOSE');
    expect(md).toContain('<camelName>FileGroupIds');
  });

  it('substitutes concrete values and derives all four name variants', () => {
    const spec = getFileConventionSpec('storagefile-purpose');
    if (!spec) throw new Error('expected spec');
    const md = formatSpec(spec, { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api', name: 'user-avatar' });
    expect(md).toContain('components/demo-firebase/src/lib/model/storagefile/storagefile.user-avatar.ts');
    expect(md).toContain('USER_AVATAR_PURPOSE');
    expect(md).toContain('userAvatarFileGroupIds');
    expect(md).toContain('UserAvatarProcessingSubtask');
    expect(md).not.toContain('<NAME>');
    expect(md).not.toContain('<camelName>');
  });

  it('accepts camelCase or PascalCase name input and normalizes to all variants', () => {
    const spec = getFileConventionSpec('notification-task');
    if (!spec) throw new Error('expected spec');
    const md = formatSpec(spec, { componentDir: undefined, apiDir: undefined, name: 'WorkerPaid' });
    expect(md).toContain('WORKER_PAID_NOTIFICATION_TASK_TYPE');
    expect(md).toContain('WorkerPaidNotificationTaskCheckpoint');
    expect(md).toContain('worker-paid');
  });

  it('renders header lines, numbered step headings, and a See also block', () => {
    const spec = getFileConventionSpec('firestore-model');
    if (!spec) throw new Error('expected spec');
    const md = formatSpec(spec, { componentDir: undefined, apiDir: undefined, name: undefined });
    expect(md).toContain('# Firestore model — `firestore-model`');
    expect(md).toMatch(/^## 1\. /m);
    expect(md).toContain('## See also');
    expect(md).toContain('- `nestjs-model-module`');
  });
});

describe('runArtifactFileConvention — MCP handler', () => {
  it('returns isError when artifact kind is missing', () => {
    const result = runArtifactFileConvention({});
    expect(result.isError).toBe(true);
  });

  it('returns isError for an unknown artifact kind', () => {
    const result = runArtifactFileConvention({ artifact: 'unknown-artifact' });
    expect(result.isError).toBe(true);
  });

  it('returns a markdown text block for a valid artifact kind', () => {
    const result = runArtifactFileConvention({ artifact: 'storagefile-processor', componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api', name: 'user-test-file' });
    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({ type: 'text' });
    const text = (result.content[0] as { type: 'text'; text: string }).text;
    expect(text).toContain('# StorageFile processor');
    expect(text).toContain('USER_TEST_FILE_PURPOSE');
    expect(text).toContain('apps/demo-api/src/app/common/model/notification/handlers/storagefile/task.handler.storagefile.user-test-file.ts');
  });
});
