import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { extractForgeFieldEntries, type ExtractedForgeFieldEntry, type ForgeExtractWarning } from './forge-fields-extract.js';

function projectWith(files: Record<string, string>): Project {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const [path, contents] of Object.entries(files)) {
    project.createSourceFile(path, contents, { overwrite: true });
  }
  return project;
}

function findEntry(entries: readonly ExtractedForgeFieldEntry[], slug: string): ExtractedForgeFieldEntry {
  const entry = entries.find((e) => e.slug === slug);
  if (!entry) {
    throw new Error(`expected entry slug=${slug}, got: ${entries.map((e) => e.slug).join(', ')}`);
  }
  return entry;
}

function findWarning(warnings: readonly ForgeExtractWarning[], kind: ForgeExtractWarning['kind']): ForgeExtractWarning | undefined {
  return warnings.find((w) => w.kind === kind);
}

describe('extractForgeFieldEntries — union config walker', () => {
  it('emits union-config-not-walked when the config alias is a primitive-only union', () => {
    const project = projectWith({
      '/proj/src/primitive-union.ts': `
        /**
         * Primitive-only union config.
         */
        export type DbxForgePrimitiveUnionFieldConfig = 'a' | 'b';

        /**
         * Test factory whose config is a primitive-only union.
         * @dbxFormField
         * @dbxFormSlug primitive-union
         * @dbxFormTier field-factory
         * @dbxFormProduces string
         * @dbxFormArrayOutput no
         * @dbxFormNgFormType input
         * @dbxFormWrapperPattern unwrapped
         */
        export function dbxForgePrimitiveUnionField(config: DbxForgePrimitiveUnionFieldConfig) {
          return config;
        }
      `
    });
    const result = extractForgeFieldEntries({ project });
    const entry = findEntry(result.entries, 'primitive-union');
    expect(entry.properties).toEqual([]);
    const warning = findWarning(result.warnings, 'union-config-not-walked');
    expect(warning).toBeDefined();
  });

  it('skips primitive-literal members and yields object properties marked optional in a mixed union', () => {
    const project = projectWith({
      '/proj/src/mixed-union.ts': `
        /**
         * Object branch of a mixed-union config.
         */
        export interface DbxForgeMixedUnionObjectConfig {
          /** A required label. */
          label: string;
          /** Optional subtitle. */
          subtitle?: string;
        }

        /**
         * Mixed union — accepts a preset string OR a structured config.
         */
        export type DbxForgeMixedUnionFieldConfig = 'preset' | DbxForgeMixedUnionObjectConfig;

        /**
         * @dbxFormField
         * @dbxFormSlug mixed-union
         * @dbxFormTier field-factory
         * @dbxFormProduces string
         * @dbxFormArrayOutput no
         * @dbxFormNgFormType input
         * @dbxFormWrapperPattern unwrapped
         */
        export function dbxForgeMixedUnionField(config: DbxForgeMixedUnionFieldConfig) {
          return config;
        }
      `
    });
    const result = extractForgeFieldEntries({ project });
    const entry = findEntry(result.entries, 'mixed-union');
    const propsByName = new Map(entry.properties.map((p) => [p.name, p]));
    expect(propsByName.get('label')?.required).toBe(false);
    expect(propsByName.get('subtitle')?.required).toBe(false);
    expect(findWarning(result.warnings, 'union-config-not-walked')).toBeUndefined();
  });

  it('merges both branches of an object-only union', () => {
    const project = projectWith({
      '/proj/src/object-union.ts': `
        export interface DbxForgeObjectUnionFieldConfigA {
          /** From branch A. */
          fromA: string;
        }
        export interface DbxForgeObjectUnionFieldConfigB {
          /** From branch B. */
          fromB: number;
        }
        /**
         * Two-branch object union.
         */
        export type DbxForgeObjectUnionFieldConfig = DbxForgeObjectUnionFieldConfigA | DbxForgeObjectUnionFieldConfigB;

        /**
         * @dbxFormField
         * @dbxFormSlug object-union
         * @dbxFormTier field-factory
         * @dbxFormProduces string
         * @dbxFormArrayOutput no
         * @dbxFormNgFormType input
         * @dbxFormWrapperPattern unwrapped
         */
        export function dbxForgeObjectUnionField(config: DbxForgeObjectUnionFieldConfig) {
          return config;
        }
      `
    });
    const result = extractForgeFieldEntries({ project });
    const entry = findEntry(result.entries, 'object-union');
    const names = entry.properties.map((p) => p.name).sort();
    expect(names).toEqual(['fromA', 'fromB']);
    expect(findWarning(result.warnings, 'union-config-not-walked')).toBeUndefined();
  });
});

describe('extractForgeFieldEntries — new tier validation', () => {
  it('field-derivative requires a base slug via @dbxFormComposesFrom', () => {
    const project = projectWith({
      '/proj/src/derivative-no-base.ts': `
        export interface DbxForgeBareDerivativeFieldConfig {
          /** Stub. */
          stub?: string;
        }

        /**
         * Derivative without composesFrom — should warn.
         * @dbxFormField
         * @dbxFormSlug bare-derivative
         * @dbxFormTier field-derivative
         * @dbxFormProduces string
         * @dbxFormArrayOutput no
         */
        export function dbxForgeBareDerivativeField(config?: DbxForgeBareDerivativeFieldConfig) {
          return config;
        }
      `
    });
    const result = extractForgeFieldEntries({ project });
    expect(result.entries.find((e) => e.slug === 'bare-derivative')).toBeUndefined();
    expect(findWarning(result.warnings, 'derivative-missing-base')).toBeDefined();
  });

  it('field-derivative with @dbxFormComposesFrom yields a derivative entry', () => {
    const project = projectWith({
      '/proj/src/email-derivative.ts': `
        export interface DbxForgeEmailDerivativeFieldConfig {
          /** Optional autocomplete override. */
          autocomplete?: string;
        }

        /**
         * Email derivative wrapping the text factory.
         * @dbxFormField
         * @dbxFormSlug email-derivative
         * @dbxFormTier field-derivative
         * @dbxFormProduces string
         * @dbxFormArrayOutput no
         * @dbxFormComposesFrom text
         */
        export function dbxForgeEmailDerivativeField(config?: DbxForgeEmailDerivativeFieldConfig) {
          return config;
        }
      `
    });
    const result = extractForgeFieldEntries({ project });
    const entry = findEntry(result.entries, 'email-derivative');
    expect(entry.tier).toBe('field-derivative');
    expect(entry.composesFromSlugs).toEqual(['text']);
  });

  it('template-builder requires @dbxFormComposesFrom slugs', () => {
    const project = projectWith({
      '/proj/src/template-no-slugs.ts': `
        export interface DbxForgeBareTemplateConfig {
          /** Stub. */
          stub?: string;
        }

        /**
         * Template without slugs — should warn.
         * @dbxFormField
         * @dbxFormSlug bare-template
         * @dbxFormTier template-builder
         * @dbxFormProduces FieldDef[]
         * @dbxFormArrayOutput no
         */
        export function dbxForgeBareTemplate(config?: DbxForgeBareTemplateConfig) {
          return config;
        }
      `
    });
    const result = extractForgeFieldEntries({ project });
    expect(result.entries.find((e) => e.slug === 'bare-template')).toBeUndefined();
    expect(findWarning(result.warnings, 'template-missing-slugs')).toBeDefined();
  });

  it('template-builder with composesFrom yields a template entry carrying the slug list', () => {
    const project = projectWith({
      '/proj/src/login-template.ts': `
        export interface DbxForgeLoginTemplateConfig {
          /** Stub. */
          stub?: string;
        }

        /**
         * Login template returning two related fields.
         * @dbxFormField
         * @dbxFormSlug login-template
         * @dbxFormTier template-builder
         * @dbxFormProduces FieldDef[]
         * @dbxFormArrayOutput no
         * @dbxFormComposesFrom username password
         */
        export function dbxForgeLoginTemplate(config?: DbxForgeLoginTemplateConfig) {
          return config;
        }
      `
    });
    const result = extractForgeFieldEntries({ project });
    const entry = findEntry(result.entries, 'login-template');
    expect(entry.tier).toBe('template-builder');
    expect(entry.composesFromSlugs).toEqual(['username', 'password']);
  });
});
