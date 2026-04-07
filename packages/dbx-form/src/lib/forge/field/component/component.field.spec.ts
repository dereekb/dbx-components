import { describe, it, expect } from 'vitest';
import { forgeComponentField } from './component.field';

class MockComponentA {}
class MockComponentB {}

describe('forgeComponentField()', () => {
  it('should create a field with type dbx-component', () => {
    const field = forgeComponentField({
      componentField: { componentClass: MockComponentA }
    });
    expect(field.type).toBe('dbx-component');
  });

  it('should generate a unique key when not specified', () => {
    const fieldA = forgeComponentField({
      componentField: { componentClass: MockComponentA }
    });
    const fieldB = forgeComponentField({
      componentField: { componentClass: MockComponentA }
    });
    expect(fieldA.key).toMatch(/^_component_\d+$/);
    expect(fieldA.key).not.toBe(fieldB.key);
  });

  it('should use provided key', () => {
    const field = forgeComponentField({
      key: 'custom',
      componentField: { componentClass: MockComponentA }
    });
    expect(field.key).toBe('custom');
  });

  it('should set label when specified', () => {
    const field = forgeComponentField({
      label: 'My Component',
      componentField: { componentClass: MockComponentA }
    });
    expect(field.label).toBe('My Component');
  });

  it('should default label to empty string when not specified', () => {
    const field = forgeComponentField({
      componentField: { componentClass: MockComponentA }
    });
    expect(field.label).toBe('');
  });

  it('should pass componentField through in props', () => {
    const componentField = { componentClass: MockComponentA };
    const field = forgeComponentField({ componentField });
    expect(field.props?.componentField).toBe(componentField);
  });

  it('should pass providers through in componentField props', () => {
    const providers = [{ provide: 'TOKEN', useValue: 'test' }];
    const field = forgeComponentField({
      componentField: { componentClass: MockComponentA, providers }
    });
    expect(field.props?.componentField.providers).toBe(providers);
  });

  it('should pass different component classes', () => {
    const fieldA = forgeComponentField({
      componentField: { componentClass: MockComponentA }
    });
    const fieldB = forgeComponentField({
      componentField: { componentClass: MockComponentB }
    });
    expect(fieldA.props?.componentField.componentClass).toBe(MockComponentA);
    expect(fieldB.props?.componentField.componentClass).toBe(MockComponentB);
  });
});
