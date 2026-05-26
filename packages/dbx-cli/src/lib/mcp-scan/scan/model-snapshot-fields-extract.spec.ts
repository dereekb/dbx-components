import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { extractModelSnapshotFieldEntries, type ExtractedModelSnapshotFieldEntry } from './model-snapshot-fields-extract.js';

function projectWith(files: Record<string, string>): Project {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const [path, contents] of Object.entries(files)) {
    project.createSourceFile(path, contents, { overwrite: true });
  }
  return project;
}

function findEntry(entries: readonly ExtractedModelSnapshotFieldEntry[], slug: string): ExtractedModelSnapshotFieldEntry {
  const entry = entries.find((e) => e.slug === slug);
  if (!entry) {
    throw new Error(`expected entry slug=${slug}, got: ${entries.map((e) => e.slug).join(', ')}`);
  }
  return entry;
}

describe('extractModelSnapshotFieldEntries — opt-in marker', () => {
  it('skips functions without @dbxModelSnapshotField', () => {
    const project = projectWith({
      '/proj/src/lib/snapshot.ts': `
        /** Untagged factory. */
        export function firestoreUntaggedField() {
          return {};
        }
      `
    });
    const result = extractModelSnapshotFieldEntries({ project });
    expect(result.entries).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('skips consts without @dbxModelSnapshotField', () => {
    const project = projectWith({
      '/proj/src/lib/snapshot.ts': `
        /** Untagged const. */
        export const firestoreUntaggedConst = {};
      `
    });
    const result = extractModelSnapshotFieldEntries({ project });
    expect(result.entries).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('extractModelSnapshotFieldEntries — factories', () => {
  it('extracts a tagged factory with category, tags, and example', () => {
    const project = projectWith({
      '/proj/src/lib/date/snapshot.ts': `
        /**
         * Creates a date field mapping.
         * @dbxModelSnapshotField
         * @dbxModelSnapshotFieldCategory date
         * @dbxModelSnapshotFieldTags date, time, factory
         * @dbxModelSnapshotFieldRelated optional-firestore-date
         * @example
         * \`\`\`ts
         * fields: {
         *   createdAt: firestoreDate()
         * }
         * \`\`\`
         */
        export function firestoreDate(config: { default?: Date } = {}) {
          return config;
        }
      `
    });
    const result = extractModelSnapshotFieldEntries({ project });
    expect(result.warnings).toEqual([]);
    expect(result.entries.length).toBe(1);
    const entry = findEntry(result.entries, 'firestore-date');
    expect(entry.name).toBe('firestoreDate');
    expect(entry.kind).toBe('factory');
    expect(entry.category).toBe('date');
    expect(entry.optional).toBe(false);
    expect(entry.tags).toContain('date');
    expect(entry.tags).toContain('factory');
    expect(entry.relatedSlugs).toEqual(['optional-firestore-date']);
    expect(entry.example).toContain('firestoreDate()');
    expect(entry.signature.startsWith('firestoreDate(')).toBe(true);
  });

  it('infers optional=true from optional* name prefix', () => {
    const project = projectWith({
      '/proj/src/lib/date/snapshot.ts': `
        /**
         * Optional date field.
         * @dbxModelSnapshotField
         * @dbxModelSnapshotFieldCategory date
         */
        export function optionalFirestoreDate() {
          return {};
        }
      `
    });
    const result = extractModelSnapshotFieldEntries({ project });
    const entry = findEntry(result.entries, 'optional-firestore-date');
    expect(entry.optional).toBe(true);
  });

  it('respects explicit @dbxModelSnapshotFieldOptional override', () => {
    const project = projectWith({
      '/proj/src/lib/x.ts': `
        /**
         * Required despite name.
         * @dbxModelSnapshotField
         * @dbxModelSnapshotFieldOptional false
         */
        export function optionalLooksOptional() {
          return {};
        }
      `
    });
    const result = extractModelSnapshotFieldEntries({ project });
    const entry = findEntry(result.entries, 'optional-looks-optional');
    expect(entry.optional).toBe(false);
  });
});

describe('extractModelSnapshotFieldEntries — consts', () => {
  it('extracts a tagged const with kind=const', () => {
    const project = projectWith({
      '/proj/src/lib/snapshot.ts': `
        /**
         * Pre-built model key string field.
         * @dbxModelSnapshotField
         * @dbxModelSnapshotFieldCategory model-key
         * @dbxModelSnapshotFieldTags model, key, builtin
         */
        export const firestoreModelKeyString = { from: () => '' };
      `
    });
    const result = extractModelSnapshotFieldEntries({ project });
    expect(result.warnings).toEqual([]);
    const entry = findEntry(result.entries, 'firestore-model-key-string');
    expect(entry.kind).toBe('const');
    expect(entry.category).toBe('model-key');
    expect(entry.optional).toBe(false);
    expect(entry.signature.startsWith('const firestoreModelKeyString:')).toBe(true);
  });
});

describe('extractModelSnapshotFieldEntries — duplicate slug warning', () => {
  it('emits a duplicate-slug warning when two entries share a slug', () => {
    const project = projectWith({
      '/proj/src/lib/a.ts': `
        /**
         * @dbxModelSnapshotField
         * @dbxModelSnapshotFieldSlug shared-slug
         */
        export function firstField() { return {}; }
      `,
      '/proj/src/lib/b.ts': `
        /**
         * @dbxModelSnapshotField
         * @dbxModelSnapshotFieldSlug shared-slug
         */
        export function secondField() { return {}; }
      `
    });
    const result = extractModelSnapshotFieldEntries({ project });
    expect(result.entries.length).toBe(1);
    const dup = result.warnings.find((w) => w.kind === 'duplicate-slug');
    expect(dup).toBeDefined();
  });
});

describe('extractModelSnapshotFieldEntries — invalid kind override', () => {
  it('emits an unsupported-kind-override warning and skips the entry', () => {
    const project = projectWith({
      '/proj/src/lib/x.ts': `
        /**
         * @dbxModelSnapshotField
         * @dbxModelSnapshotFieldKind class
         */
        export function bogusKind() { return {}; }
      `
    });
    const result = extractModelSnapshotFieldEntries({ project });
    expect(result.entries).toEqual([]);
    expect(result.warnings.find((w) => w.kind === 'unsupported-kind-override')).toBeDefined();
  });
});
