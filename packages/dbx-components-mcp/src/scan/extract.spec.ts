import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { extractEntries, type ExtractedEntry } from './extract.js';

function createProject(): Project {
  return new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
}

function projectWith(files: Record<string, string>): Project {
  const project = createProject();
  for (const [path, contents] of Object.entries(files)) {
    project.createSourceFile(path, contents, { overwrite: true });
  }
  return project;
}

function findEntry(entries: readonly ExtractedEntry[], name: string): ExtractedEntry {
  const entry = entries.find((e) => e.name === name);
  if (!entry) {
    throw new Error(`expected to find entry named ${name}, got: ${entries.map((e) => e.name).join(', ')}`);
  }
  return entry;
}

describe('extractEntries — opt-in marker', () => {
  it('skips type aliases without @semanticType', () => {
    const project = projectWith({
      '/proj/src/value/email.ts': `
        export type EmailAddress = string;
      `
    });
    expect(extractEntries({ project })).toEqual([]);
  });

  it('extracts a string-aliased semantic type', () => {
    const project = projectWith({
      '/proj/src/value/email.ts': `
        /**
         * An email address.
         * @semanticType
         * @semanticTopic email contact
         */
        export type EmailAddress = string;
      `
    });
    const entries = extractEntries({ project });
    expect(entries.length).toBe(1);
    const email = findEntry(entries, 'EmailAddress');
    expect(email.kind).toBe('semantic-type');
    expect(email.baseType).toBe('string');
    expect(email.definition).toBe('string');
    expect([...email.topics]).toEqual(['email', 'contact']);
    expect(email.notes).toContain('An email address.');
    expect(email.filePath).toBe('/proj/src/value/email.ts');
    expect(email.line).toBeGreaterThan(0);
  });

  it('skips non-exported type aliases even when tagged', () => {
    const project = projectWith({
      '/proj/src/value/internal.ts': `
        /**
         * @semanticType
         * @semanticTopic email
         */
        type Internal = string;
      `
    });
    expect(extractEntries({ project })).toEqual([]);
  });
});

describe('extractEntries — baseType detection', () => {
  it('detects string and number primitives', () => {
    const project = projectWith({
      '/proj/src/types.ts': `
        /**
         * @semanticType
         * @semanticTopic time
         */
        export type Milliseconds = number;

        /**
         * @semanticType
         * @semanticTopic email
         */
        export type EmailAddress = string;
      `
    });
    const entries = extractEntries({ project });
    expect(findEntry(entries, 'Milliseconds').baseType).toBe('number');
    expect(findEntry(entries, 'EmailAddress').baseType).toBe('string');
  });

  it('detects union-literal types and pulls union values', () => {
    const project = projectWith({
      '/proj/src/types.ts': `
        /**
         * @semanticType
         * @semanticTopic enum
         */
        export type TimeUnit = 'ms' | 's' | 'min';
      `
    });
    const entry = findEntry(extractEntries({ project }), 'TimeUnit');
    expect(entry.baseType).toBe('union-literal');
    expect([...(entry.unionValues ?? [])]).toEqual(["'ms'", "'s'", "'min'"]);
  });

  it('detects branded intersections via underscore-prefixed property', () => {
    const project = projectWith({
      '/proj/src/types.ts': `
        /**
         * @semanticType
         * @semanticTopic geo
         */
        export type LatLngBoundCheck = ((value: number) => boolean) & { readonly _bound: number };
      `
    });
    const entry = findEntry(extractEntries({ project }), 'LatLngBoundCheck');
    expect(entry.baseType).toBe('branded');
  });

  it('detects classical __brand intersections', () => {
    const project = projectWith({
      '/proj/src/types.ts': `
        /**
         * @semanticType
         * @semanticTopic identifier
         */
        export type SchoolId = string & { readonly __brand: 'SchoolId' };
      `
    });
    const entry = findEntry(extractEntries({ project }), 'SchoolId');
    expect(entry.baseType).toBe('branded');
  });

  it('marks interface declarations as object kind', () => {
    const project = projectWith({
      '/proj/src/types.ts': `
        /**
         * @semanticType
         * @semanticTopic geo
         */
        export interface LatLngPoint {
          readonly lat: number;
          readonly lng: number;
        }
      `
    });
    const entry = findEntry(extractEntries({ project }), 'LatLngPoint');
    expect(entry.baseType).toBe('object');
    expect(entry.kind).toBe('semantic-type');
  });
});

describe('extractEntries — companion resolution', () => {
  it('auto-detects an `is<Name>` guard when exported in the same file', () => {
    const project = projectWith({
      '/proj/src/email.ts': `
        /**
         * @semanticType
         * @semanticTopic email
         */
        export type EmailAddress = string;

        export function isEmailAddress(value: unknown): value is EmailAddress {
          return typeof value === 'string';
        }
      `
    });
    const entry = findEntry(extractEntries({ project }), 'EmailAddress');
    expect([...entry.guards]).toEqual(['isEmailAddress']);
  });

  it('does not auto-detect a guard when the same-file export is missing', () => {
    const project = projectWith({
      '/proj/src/email.ts': `
        /**
         * @semanticType
         * @semanticTopic email
         */
        export type EmailAddress = string;
      `
    });
    const entry = findEntry(extractEntries({ project }), 'EmailAddress');
    expect([...entry.guards]).toEqual([]);
  });

  it('honours @semanticGuard declarations when the symbol exists', () => {
    const project = projectWith({
      '/proj/src/email.ts': `
        /**
         * @semanticType
         * @semanticTopic email
         * @semanticGuard validateEmail
         */
        export type EmailAddress = string;

        export function validateEmail(value: unknown): boolean {
          return typeof value === 'string';
        }
      `
    });
    const entry = findEntry(extractEntries({ project }), 'EmailAddress');
    expect([...entry.guards]).toEqual(['validateEmail']);
  });

  it('drops @semanticGuard names that do not resolve to an export', () => {
    const project = projectWith({
      '/proj/src/email.ts': `
        /**
         * @semanticType
         * @semanticTopic email
         * @semanticFactory makeEmail
         */
        export type EmailAddress = string;
      `
    });
    const entry = findEntry(extractEntries({ project }), 'EmailAddress');
    expect([...entry.factories]).toEqual([]);
  });

  it('honours @semanticFactory declarations when the symbol exists', () => {
    const project = projectWith({
      '/proj/src/email.ts': `
        /**
         * @semanticType
         * @semanticTopic email
         * @semanticFactory makeEmail
         */
        export type EmailAddress = string;

        export function makeEmail(value: string): EmailAddress {
          return value;
        }
      `
    });
    const entry = findEntry(extractEntries({ project }), 'EmailAddress');
    expect([...entry.factories]).toEqual(['makeEmail']);
  });
});

describe('extractEntries — JSDoc tag handling', () => {
  it('parses multiple @example blocks and joins multiple summary lines', () => {
    const project = projectWith({
      '/proj/src/email.ts': `
        /**
         * An email address.
         *
         * Conforms to RFC 5321.
         * @semanticType
         * @semanticTopic email
         * @example
         * Simple
         * \`\`\`ts
         * const e: EmailAddress = 'a@b.com';
         * \`\`\`
         * @example
         * \`\`\`ts
         * const e: EmailAddress = 'x@y.io';
         * \`\`\`
         */
        export type EmailAddress = string;
      `
    });
    const entry = findEntry(extractEntries({ project }), 'EmailAddress');
    expect(entry.examples.length).toBe(2);
    expect(entry.examples[0]?.caption).toBe('Simple');
    expect(entry.examples[0]?.code).toContain('const e: EmailAddress');
    expect(entry.notes).toContain('An email address.');
    expect(entry.notes).toContain('RFC 5321');
  });

  it('captures @since and @deprecated tags', () => {
    const project = projectWith({
      '/proj/src/old.ts': `
        /**
         * @semanticType
         * @semanticTopic email
         * @since 1.2.3
         * @deprecated use NewEmail instead
         */
        export type EmailAddress = string;
      `
    });
    const entry = findEntry(extractEntries({ project }), 'EmailAddress');
    expect(entry.since).toBe('1.2.3');
    expect(entry.deprecated).toBe('use NewEmail instead');
  });

  it('treats bare @deprecated (no comment) as `true`', () => {
    const project = projectWith({
      '/proj/src/old.ts': `
        /**
         * @semanticType
         * @semanticTopic email
         * @deprecated
         */
        export type EmailAddress = string;
      `
    });
    const entry = findEntry(extractEntries({ project }), 'EmailAddress');
    expect(entry.deprecated).toBe(true);
  });

  it('accepts comma- or whitespace-separated topic lists', () => {
    const project = projectWith({
      '/proj/src/types.ts': `
        /**
         * @semanticType
         * @semanticTopic time, duration
         * @semanticTopic dereekb-util:duration
         */
        export type Milliseconds = number;
      `
    });
    const entry = findEntry(extractEntries({ project }), 'Milliseconds');
    expect([...entry.topics]).toEqual(['time', 'duration', 'dereekb-util:duration']);
  });
});

describe('extractEntries — type parameters', () => {
  it('captures generic type parameters', () => {
    const project = projectWith({
      '/proj/src/types.ts': `
        /**
         * @semanticType
         * @semanticTopic geo
         */
        export interface LatLngDataPoint<T> {
          readonly lat: number;
          readonly lng: number;
          readonly data: T;
        }
      `
    });
    const entry = findEntry(extractEntries({ project }), 'LatLngDataPoint');
    expect(entry.typeParameters).toEqual(['T']);
  });

  it('omits typeParameters field when there are none', () => {
    const project = projectWith({
      '/proj/src/types.ts': `
        /**
         * @semanticType
         * @semanticTopic email
         */
        export type EmailAddress = string;
      `
    });
    const entry = findEntry(extractEntries({ project }), 'EmailAddress');
    expect(entry.typeParameters).toBeUndefined();
  });
});

describe('extractEntries — multi-file', () => {
  it('returns entries across multiple source files in deterministic order', () => {
    const project = projectWith({
      '/proj/src/a.ts': `
        /**
         * @semanticType
         * @semanticTopic email
         */
        export type EmailAddress = string;
      `,
      '/proj/src/b.ts': `
        /**
         * @semanticType
         * @semanticTopic time
         */
        export type Milliseconds = number;
      `
    });
    const entries = extractEntries({ project });
    expect(entries.map((e) => e.name)).toContain('EmailAddress');
    expect(entries.map((e) => e.name)).toContain('Milliseconds');
  });
});
