import { describe, it, expect } from 'vitest';
import { forgeHiddenField } from './hidden.field';

describe('forgeHiddenField()', () => {
  it('should create a hidden input field', () => {
    const field = forgeHiddenField({ key: 'userId' });
    expect(field.type).toBe('input');
    expect(field.key).toBe('userId');
    expect(field.hidden).toBe(true);
  });

  it('should set empty label', () => {
    const field = forgeHiddenField({ key: 'userId' });
    expect(field.label).toBe('');
  });

  it('should default value to empty string', () => {
    const field = forgeHiddenField({ key: 'userId' });
    expect(field.value).toBe('');
  });

  it('should use defaultValue when provided', () => {
    const field = forgeHiddenField({ key: 'userId', defaultValue: 'abc123' });
    expect(field.value).toBe('abc123');
  });

  it('should accept non-string defaultValue', () => {
    const field = forgeHiddenField({ key: 'count', defaultValue: 42 });
    expect(field.value).toBe(42);
  });

  it('should set required when specified', () => {
    const field = forgeHiddenField({ key: 'userId', required: true });
    expect(field.required).toBe(true);
  });

  it('should not include required when not specified', () => {
    const field = forgeHiddenField({ key: 'userId' });
    expect(field.required).toBeUndefined();
  });
});
