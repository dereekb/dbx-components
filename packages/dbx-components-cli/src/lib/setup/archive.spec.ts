import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { templateArchiveFromDirectory } from './archive.js';

const TEMPLATES_DIR = resolve(__dirname, '../../../templates');

describe('templateArchiveFromDirectory', () => {
  const archive = templateArchiveFromDirectory(TEMPLATES_DIR);

  it('lists every entry under a subtree prefix', () => {
    const entries = archive.listSubtree('components/firebase');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.startsWith('components/firebase/'))).toBe(true);
    expect(entries).toContain('components/firebase/project.template.json');
  });

  it('is path-segment aware (a prefix matches only whole directory segments)', () => {
    const components = archive.listSubtree('components');
    expect(components.some((entry) => entry.startsWith('components/app/'))).toBe(true);
    expect(components.some((entry) => entry.startsWith('components/firebase/'))).toBe(true);
  });

  it('reads an entry as a buffer and returns undefined for a missing entry', () => {
    expect(archive.readEntry('firebase.json')?.toString('utf8')).toContain('"storage"');
    expect(archive.readEntry('does/not/exist.txt')).toBeUndefined();
  });

  it('lists the full tree for an empty prefix, including the add-on subtrees', () => {
    const all = archive.listSubtree('');
    expect(all.length).toBeGreaterThanOrEqual(227);
    expect(all.some((entry) => entry.startsWith('addons/oidc/'))).toBe(true);
    expect(all.some((entry) => entry.startsWith('addons/mcp/'))).toBe(true);
  });
});
