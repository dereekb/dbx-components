import { describe, it, expect, expectTypeOf } from 'vitest';
import { of } from 'rxjs';
import { dbxForgeSourceSelectField } from './sourceselect.field';
import type { DbxForgeSourceSelectFieldConfig } from './sourceselect.field';
import type { LogicConfig } from '@ng-forge/dynamic-forms';

// ============================================================================
// DbxForgeSourceSelectFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeSourceSelectFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgeSourceSelectFieldDef>
    | 'key'
    | 'label'
    | 'placeholder'
    | 'value'
    | 'required'
    | 'readonly'
    | 'disabled'
    | 'hidden'
    | 'className'
    | 'meta'
    | 'logic'
    | 'props'
    | 'hint'
    | 'description'
    | 'pattern'
    | 'minLength'
    | 'maxLength'
    | 'min'
    | 'max'
    | 'email'
    | 'validators'
    | 'validationMessages'
    | 'derivation'
    | 'schemas'
    | 'col'
    | 'tabIndex'
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    | 'wrappers'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
    | 'nullable'
    // Phantom brand
    | '__fieldDef';

  type ActualKeys = keyof DbxForgeSourceSelectFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });
});

// MARK: dbxForgeSourceSelectField
describe('dbxForgeSourceSelectField()', () => {
  const stubValueReader = (meta: { id: string }) => meta.id;
  const stubMetaLoader = (_values: string[]) => of([{ id: 'a' }]);
  const stubDisplayForValue = (values: { value: string; meta: { id: string } }[]) => of(values.map((v) => ({ ...v, label: v.value })));

  function minimalConfig() {
    return {
      key: 'source',
      props: {
        valueReader: stubValueReader,
        metaLoader: stubMetaLoader,
        displayForValue: stubDisplayForValue
      }
    } as Parameters<typeof dbxForgeSourceSelectField>[0];
  }

  // -- Field type and key --

  it('should set the field type to dbx-source-select', () => {
    const field = dbxForgeSourceSelectField(minimalConfig());
    expect(field.type).toBe('dbx-source-select');
  });

  it('should set the field key from config', () => {
    const field = dbxForgeSourceSelectField(minimalConfig());
    expect(field.key).toBe('source');
  });

  // -- Label and hint --

  it('should set the label when provided', () => {
    const field = dbxForgeSourceSelectField({ ...minimalConfig(), label: 'Source Label' });
    expect(field.label).toBe('Source Label');
  });

  it('should leave label undefined when not provided', () => {
    const field = dbxForgeSourceSelectField(minimalConfig());
    expect(field.label).toBeUndefined();
  });

  it('should map description to props.hint', () => {
    const field = dbxForgeSourceSelectField({ ...minimalConfig(), description: 'A helpful hint' });
    expect(field.props?.hint).toBe('A helpful hint');
  });

  it('should not set hint when description is not provided', () => {
    const field = dbxForgeSourceSelectField(minimalConfig());
    expect(field.props?.hint).toBeUndefined();
  });

  // -- Required and readonly --

  it('should set required when provided', () => {
    const field = dbxForgeSourceSelectField({ ...minimalConfig(), required: true });
    expect(field.required).toBe(true);
  });

  it('should not set required when not provided', () => {
    const field = dbxForgeSourceSelectField(minimalConfig());
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when provided', () => {
    const field = dbxForgeSourceSelectField({ ...minimalConfig(), readonly: true });
    expect(field.readonly).toBe(true);
  });

  // -- Props propagation --

  it('should propagate valueReader on field.props', () => {
    const field = dbxForgeSourceSelectField(minimalConfig());
    expect(field.props?.valueReader).toBe(stubValueReader);
  });

  it('should propagate metaLoader on field.props', () => {
    const field = dbxForgeSourceSelectField(minimalConfig());
    expect(field.props?.metaLoader).toBe(stubMetaLoader);
  });

  it('should propagate displayForValue on field.props', () => {
    const field = dbxForgeSourceSelectField(minimalConfig());
    expect(field.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate multiple on field.props when provided', () => {
    const base = minimalConfig();
    const field = dbxForgeSourceSelectField({ ...base, props: { ...base.props!, multiple: true } });
    expect(field.props?.multiple).toBe(true);
  });

  it('should not set multiple when not provided', () => {
    const field = dbxForgeSourceSelectField(minimalConfig());
    expect(field.props?.multiple).toBeUndefined();
  });

  it('should propagate filterable on field.props when provided', () => {
    const base = minimalConfig();
    const field = dbxForgeSourceSelectField({ ...base, props: { ...base.props!, filterable: false } });
    expect(field.props?.filterable).toBe(false);
  });

  it('should propagate openSource on field.props when provided', () => {
    const openSource = () => of({ select: [], options: [] });
    const base = minimalConfig();
    const field = dbxForgeSourceSelectField({ ...base, props: { ...base.props!, openSource } });
    expect(field.props?.openSource).toBe(openSource);
  });

  // -- Logic --

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeSourceSelectField({ ...minimalConfig(), logic });
    expect((field as any).logic).toEqual(logic);
  });
});
