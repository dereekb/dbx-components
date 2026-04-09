import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { forgeSourceSelectField } from './sourceselect.field';
import type { ForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import type { ForgeSourceSelectFieldDef } from './sourceselect.field.component';

// MARK: Helpers
/**
 * Extracts the inner source-select field from a forge form-field wrapper.
 */
function innerField(wrapper: ForgeFormFieldWrapperFieldDef<ForgeSourceSelectFieldDef>) {
  return wrapper.props!.fields[0] as ForgeSourceSelectFieldDef;
}

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

  // -- Wrapper-level properties --

  it('should set the wrapper type to dbx-forge-form-field', () => {
    const wrapper = forgeSourceSelectField(minimalConfig());
    expect(wrapper.type).toBe('dbx-forge-form-field');
  });

  it('should auto-generate a wrapper key', () => {
    const wrapper = forgeSourceSelectField(minimalConfig());
    expect(wrapper.key).toMatch(/^_formfield_\d+$/);
  });

  it('should set the wrapper label when provided', () => {
    const wrapper = forgeSourceSelectField({ ...minimalConfig(), label: 'Source Label' });
    expect(wrapper.label).toBe('Source Label');
  });

  it('should default wrapper label to empty string when not provided', () => {
    const wrapper = forgeSourceSelectField(minimalConfig());
    expect(wrapper.label).toBe('');
  });

  it('should map description to wrapper props.hint', () => {
    const wrapper = forgeSourceSelectField({ ...minimalConfig(), description: 'A helpful hint' });
    expect(wrapper.props?.hint).toBe('A helpful hint');
  });

  it('should not set wrapper hint when description is not provided', () => {
    const wrapper = forgeSourceSelectField(minimalConfig());
    expect(wrapper.props?.hint).toBeUndefined();
  });

  it('should contain exactly one inner field', () => {
    const wrapper = forgeSourceSelectField(minimalConfig());
    expect(wrapper.props!.fields).toHaveLength(1);
  });

  // -- Inner field properties --

  it('should set the inner field type to dbx-source-select', () => {
    const wrapper = forgeSourceSelectField(minimalConfig());
    expect(innerField(wrapper).type).toBe('dbx-source-select');
  });

  it('should set the inner field key from config', () => {
    const wrapper = forgeSourceSelectField(minimalConfig());
    expect(innerField(wrapper).key).toBe('source');
  });

  it('should set required on the inner field when provided', () => {
    const wrapper = forgeSourceSelectField({ ...minimalConfig(), required: true });
    expect(innerField(wrapper).required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const wrapper = forgeSourceSelectField(minimalConfig());
    expect(innerField(wrapper).required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const wrapper = forgeSourceSelectField({ ...minimalConfig(), readonly: true });
    expect(innerField(wrapper).readonly).toBe(true);
  });

  it('should propagate valueReader through inner field props', () => {
    const wrapper = forgeSourceSelectField(minimalConfig());
    expect(innerField(wrapper).props?.valueReader).toBe(stubValueReader);
  });

  it('should propagate metaLoader through inner field props', () => {
    const wrapper = forgeSourceSelectField(minimalConfig());
    expect(innerField(wrapper).props?.metaLoader).toBe(stubMetaLoader);
  });

  it('should propagate displayForValue through inner field props', () => {
    const wrapper = forgeSourceSelectField(minimalConfig());
    expect(innerField(wrapper).props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate multiple through inner field props when provided', () => {
    const wrapper = forgeSourceSelectField({ ...minimalConfig(), multiple: true });
    expect(innerField(wrapper).props?.multiple).toBe(true);
  });

  it('should not set multiple on the inner field when not provided', () => {
    const wrapper = forgeSourceSelectField(minimalConfig());
    expect(innerField(wrapper).props?.multiple).toBeUndefined();
  });

  it('should propagate filterable through inner field props when provided', () => {
    const wrapper = forgeSourceSelectField({ ...minimalConfig(), filterable: false });
    expect(innerField(wrapper).props?.filterable).toBe(false);
  });

  it('should propagate openSource through inner field props when provided', () => {
    const openSource = () => of({ select: [], options: [] });
    const wrapper = forgeSourceSelectField({ ...minimalConfig(), openSource } as Parameters<typeof forgeSourceSelectField>[0]);
    expect(innerField(wrapper).props?.openSource).toBe(openSource);
  });
});
