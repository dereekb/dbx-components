import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { UTIL_ESLINT_PLUGIN } from './plugin';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-util': UTIL_ESLINT_PLUGIN as any },
      rules: { 'dereekb-util/require-dbx-form-field-companion-tags': 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-dbx-form-field-companion-tags');
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-dbx-form-field-companion-tags rule', () => {
  it('passes on canonical field-factory tier', () => {
    const errors = lintCode(`
/**
 * @dbxFormField
 * @dbxFormTier field-factory
 * @dbxFormSlug text-field
 * @dbxFormProduces FieldDef
 * @dbxFormArrayOutput no
 * @dbxFormWrapperPattern unwrapped
 * @dbxFormNgFormType FormControl
 */
export function textField() {}
`);
    expect(errors).toHaveLength(0);
  });

  it('passes on canonical composite-builder tier', () => {
    const errors = lintCode(`
/**
 * @dbxFormField
 * @dbxFormTier composite-builder
 * @dbxFormSlug section-row
 * @dbxFormProduces FieldDef
 * @dbxFormArrayOutput no
 * @dbxFormSuffix Row
 */
export function sectionRow() {}
`);
    expect(errors).toHaveLength(0);
  });

  it('passes on derivative marker', () => {
    const errors = lintCode(`
/**
 * @dbxFormFieldDerivative text-field
 * @dbxFormSlug shouted-text-field
 * @dbxFormProduces FieldDef
 * @dbxFormArrayOutput no
 */
export function shoutedTextField() {}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags missing tier for @dbxFormField', () => {
    const errors = lintCode(`
/**
 * @dbxFormField
 * @dbxFormSlug foo
 * @dbxFormProduces FieldDef
 * @dbxFormArrayOutput no
 */
export function foo() {}
`);
    expect(messagesById(errors).missingTier).toBe(1);
  });

  it('flags template builder missing composesFrom', () => {
    const errors = lintCode(`
/**
 * @dbxFormFieldTemplate
 * @dbxFormSlug foo-template
 * @dbxFormProduces FieldDef
 * @dbxFormArrayOutput no
 */
export function fooTemplate() {}
`);
    expect(messagesById(errors).missingComposesFrom).toBe(1);
  });

  it('flags field-factory missing wrapper pattern', () => {
    const errors = lintCode(`
/**
 * @dbxFormField
 * @dbxFormTier field-factory
 * @dbxFormSlug foo
 * @dbxFormProduces FieldDef
 * @dbxFormArrayOutput no
 * @dbxFormNgFormType FormControl
 */
export function foo() {}
`);
    expect(messagesById(errors).missingWrapperPattern).toBe(1);
  });

  it('flags composite-builder missing suffix', () => {
    const errors = lintCode(`
/**
 * @dbxFormField
 * @dbxFormTier composite-builder
 * @dbxFormSlug foo
 * @dbxFormProduces FieldDef
 * @dbxFormArrayOutput no
 */
export function foo() {}
`);
    expect(messagesById(errors).missingSuffix).toBe(1);
  });

  it('flags invalid array output', () => {
    const errors = lintCode(`
/**
 * @dbxFormField
 * @dbxFormTier primitive
 * @dbxFormSlug foo
 * @dbxFormProduces FieldDef
 * @dbxFormArrayOutput maybe
 */
export function foo() {}
`);
    expect(messagesById(errors).invalidArrayOutput).toBe(1);
  });

  it('flags mutually-exclusive markers', () => {
    const errors = lintCode(`
/**
 * @dbxFormField
 * @dbxFormFieldDerivative something
 * @dbxFormSlug foo
 * @dbxFormProduces FieldDef
 * @dbxFormArrayOutput no
 */
export function foo() {}
`);
    expect(messagesById(errors).duplicateMarker).toBe(1);
  });

  it('flags unknown companion typo', () => {
    const errors = lintCode(`
/**
 * @dbxFormField
 * @dbxFormTier primitive
 * @dbxFormSlug foo
 * @dbxFormProduces FieldDef
 * @dbxFormArrayOutput no
 * @dbxFormKategory misc
 */
export function foo() {}
`);
    expect(messagesById(errors).unknownDbxFormTag).toBe(1);
  });
});
