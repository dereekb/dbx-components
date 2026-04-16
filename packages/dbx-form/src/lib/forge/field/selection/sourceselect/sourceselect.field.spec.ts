import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { forgeSourceSelectField } from './sourceselect.field';
import type { LogicConfig } from '@ng-forge/dynamic-forms';

// MARK: forgeSourceSelectField
describe('forgeSourceSelectField()', () => {
  const stubValueReader = (meta: { id: string }) => meta.id;
  const stubMetaLoader = (_values: string[]) => of([{ id: 'a' }]);
  const stubDisplayForValue = (values: { value: string; meta: { id: string } }[]) => of(values.map((v) => ({ ...v, label: v.value })));

  function minimalConfig() {
    return {
      key: 'source',
      valueReader: stubValueReader,
      metaLoader: stubMetaLoader,
      displayForValue: stubDisplayForValue
    } as Parameters<typeof forgeSourceSelectField>[0];
  }

  // -- Field type and key --

  it('should set the field type to dbx-source-select', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.type).toBe('dbx-source-select');
  });

  it('should set the field key from config', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.key).toBe('source');
  });

  // -- Label and hint --

  it('should set the label when provided', () => {
    const field = forgeSourceSelectField({ ...minimalConfig(), label: 'Source Label' });
    expect(field.label).toBe('Source Label');
  });

  it('should leave label undefined when not provided', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.label).toBeUndefined();
  });

  it('should map description to props.hint', () => {
    const field = forgeSourceSelectField({ ...minimalConfig(), description: 'A helpful hint' });
    expect(field.props?.hint).toBe('A helpful hint');
  });

  it('should not set hint when description is not provided', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.props?.hint).toBeUndefined();
  });

  // -- Required and readonly --

  it('should set required when provided', () => {
    const field = forgeSourceSelectField({ ...minimalConfig(), required: true });
    expect(field.required).toBe(true);
  });

  it('should not set required when not provided', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when provided', () => {
    const field = forgeSourceSelectField({ ...minimalConfig(), readonly: true });
    expect(field.readonly).toBe(true);
  });

  // -- Config propagation --
  // Note: These config properties are spread onto the field def at the top level
  // by dbxForgeFieldFunction, not mapped into props (buildFieldDef is a no-op TODO).

  it('should propagate valueReader on the field', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect((field as any).valueReader).toBe(stubValueReader);
  });

  it('should propagate metaLoader on the field', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect((field as any).metaLoader).toBe(stubMetaLoader);
  });

  it('should propagate displayForValue on the field', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect((field as any).displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate multiple on the field when provided', () => {
    const field = forgeSourceSelectField({ ...minimalConfig(), multiple: true } as any);
    expect((field as any).multiple).toBe(true);
  });

  it('should not set multiple when not provided', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect((field as any).multiple).toBeUndefined();
  });

  it('should propagate filterable on the field when provided', () => {
    const field = forgeSourceSelectField({ ...minimalConfig(), filterable: false } as any);
    expect((field as any).filterable).toBe(false);
  });

  it('should propagate openSource on the field when provided', () => {
    const openSource = () => of({ select: [], options: [] });
    const field = forgeSourceSelectField({ ...minimalConfig(), openSource } as Parameters<typeof forgeSourceSelectField>[0]);
    expect((field as any).openSource).toBe(openSource);
  });

  // -- Logic --

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgeSourceSelectField({ ...minimalConfig(), logic });
    expect((field as any).logic).toEqual(logic);
  });
});
