import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { forgeSourceSelectField } from './sourceselect.field';

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

  it('should set the correct type', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.type).toBe('dbx-source-select');
  });

  it('should set the key', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.key).toBe('source');
  });

  it('should set the label when provided', () => {
    const field = forgeSourceSelectField({ ...minimalConfig(), label: 'Source Label' });
    expect(field.label).toBe('Source Label');
  });

  it('should default label to empty string when not provided', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.label).toBe('');
  });

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

  it('should map description to props.hint', () => {
    const field = forgeSourceSelectField({ ...minimalConfig(), description: 'A helpful hint' });
    expect(field.props?.hint).toBe('A helpful hint');
  });

  it('should not set hint when description is not provided', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.props?.hint).toBeUndefined();
  });

  it('should propagate valueReader through props', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.props?.valueReader).toBe(stubValueReader);
  });

  it('should propagate metaLoader through props', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.props?.metaLoader).toBe(stubMetaLoader);
  });

  it('should propagate displayForValue through props', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate multiple through props when provided', () => {
    const field = forgeSourceSelectField({ ...minimalConfig(), multiple: true });
    expect(field.props?.multiple).toBe(true);
  });

  it('should not set multiple when not provided', () => {
    const field = forgeSourceSelectField(minimalConfig());
    expect(field.props?.multiple).toBeUndefined();
  });

  it('should propagate filterable through props when provided', () => {
    const field = forgeSourceSelectField({ ...minimalConfig(), filterable: false });
    expect(field.props?.filterable).toBe(false);
  });

  it('should propagate openSource through props when provided', () => {
    const openSource = () => of({ select: [], options: [] });
    const field = forgeSourceSelectField({ ...minimalConfig(), openSource } as Parameters<typeof forgeSourceSelectField>[0]);
    expect(field.props?.openSource).toBe(openSource);
  });
});
