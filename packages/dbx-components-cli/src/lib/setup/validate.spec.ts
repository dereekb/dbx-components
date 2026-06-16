import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatValidationMarkdown, validateExpectedFiles, validationHasMissing } from './validate.js';

function touch(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '');
}

describe('validateExpectedFiles', () => {
  it('splits expected files into present and missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dbxc-validate-'));
    const present = join(dir, 'src/index.ts');
    const missing = join(dir, 'src/gone.ts');
    touch(present);

    const result = validateExpectedFiles({ moduleId: 'api', expectedFiles: [present, missing], validationRoot: dir });
    expect(result.present).toEqual(['src/index.ts']);
    expect(result.missing).toEqual(['src/gone.ts']);
  });

  it('reports missing across modules and renders markdown', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dbxc-validate-md-'));
    const ok = validateExpectedFiles({ moduleId: 'a', expectedFiles: [], validationRoot: dir });
    const bad = validateExpectedFiles({ moduleId: 'b', expectedFiles: [join(dir, 'missing.ts')], validationRoot: dir });
    expect(validationHasMissing([ok, bad])).toBe(true);
    expect(validationHasMissing([ok])).toBe(false);

    const markdown = formatValidationMarkdown([ok, bad]);
    expect(markdown).toContain('✅ a');
    expect(markdown).toContain('❌ b');
    expect(markdown).toContain('- missing.ts');
  });
});
