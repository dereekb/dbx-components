import { describe, expect, it } from 'vitest';
import { runFormScaffold } from './form-scaffold.tool.js';

function firstText(result: ReturnType<typeof runFormScaffold>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_form_scaffold', () => {
  it('rejects missing fields array via arktype', () => {
    const result = runFormScaffold({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('rejects empty fields array', () => {
    const result = runFormScaffold({ fields: [] });
    expect(result.isError).toBe(true);
  });

  it('reports unknown slugs with actionable message', () => {
    const result = runFormScaffold({ fields: ['text:name', 'not-a-slug:x'] });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/unknown slug "not-a-slug"/);
  });

  it('reports invalid JS identifier keys', () => {
    const result = runFormScaffold({ fields: ['text:1bad'] });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/not a valid JS identifier/);
  });

  it('emits imports, FormConfig, and value interface for a simple field-factory list', () => {
    const text = firstText(runFormScaffold({ fields: ['text:name', 'email:email', 'number:age'] }));
    expect(text).toMatch(/import \{[^}]*dbxForgeTextField[^}]*\} from '@dereekb\/dbx-form';/);
    expect(text).toMatch(/import \{[^}]*dbxForgeEmailField/);
    expect(text).toMatch(/import \{[^}]*dbxForgeNumberField/);
    expect(text).toMatch(/export const formConfig: FormConfig<ScaffoldedFormValue>/);
    expect(text).toMatch(/dbxForgeTextField\(\{ key: 'name' \}\)/);
    expect(text).toMatch(/dbxForgeEmailField\(\{ key: 'email' \}\)/);
    expect(text).toMatch(/dbxForgeNumberField\(\{ key: 'age' \}\)/);
    expect(text).toMatch(/export interface ScaffoldedFormValue \{/);
    expect(text).toMatch(/readonly name\?: string;/);
    expect(text).toMatch(/readonly email\?: string;/);
    expect(text).toMatch(/readonly age\?: number;/);
  });

  it('honors a custom value type name', () => {
    const text = firstText(runFormScaffold({ fields: ['text:name'], valueTypeName: 'ContactValue' }));
    expect(text).toMatch(/FormConfig<ContactValue>/);
    expect(text).toMatch(/export interface ContactValue \{/);
  });

  it('supports composites and primitives that auto-key or take no key', () => {
    const text = firstText(runFormScaffold({ fields: ['address-group', 'date-range-row'] }));
    expect(text).toMatch(/dbxForgeAddressGroup\(\{\}\)/);
    expect(text).toMatch(/dbxForgeDateRangeRow\(\{\}\)/);
    // composites don't add top-level value properties
    expect(text).toMatch(/export interface ScaffoldedFormValue \{\}/);
  });

  it('primitives get a TODO placeholder instead of an empty call', () => {
    const text = firstText(runFormScaffold({ fields: ['row'] }));
    expect(text).toMatch(/dbxForgeRow\(\{ \/\* TODO \*\/ \}\)/);
  });

  it('wrapInSection injects a section wrapper on the first field', () => {
    const text = firstText(runFormScaffold({ fields: ['text:name', 'email:email'], wrapInSection: true }));
    expect(text).toMatch(/dbxForgeSectionWrapper/);
    expect(text).toMatch(/wrappers: \[dbxForgeSectionWrapper/);
  });

  it('reflects array-yielding fields in the inferred value type', () => {
    const text = firstText(runFormScaffold({ fields: ['checklist:flags'] }));
    expect(text).toMatch(/readonly flags\?: T\[\];/);
  });
});
