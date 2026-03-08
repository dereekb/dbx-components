import { type } from 'arktype';
import { firestoreModelIdType, firestoreModelKeyType } from './model.validator';

describe('firestoreModelKeyType', () => {
  it('should pass valid keys', () => {
    const result = firestoreModelKeyType('valid/key');
    expect(result).toBe('valid/key');
  });

  it('should fail on invalid keys', () => {
    const result = firestoreModelKeyType('invalid');
    expect(result instanceof type.errors).toBe(true);
  });

  it('should fail on empty string', () => {
    const result = firestoreModelKeyType('');
    expect(result instanceof type.errors).toBe(true);
  });
});

describe('firestoreModelIdType', () => {
  it('should pass valid ids', () => {
    const result = firestoreModelIdType('validid');
    expect(result).toBe('validid');
  });

  it('should fail on invalid ids', () => {
    const result = firestoreModelIdType('invalid/id');
    expect(result instanceof type.errors).toBe(true);
  });

  it('should fail on empty string', () => {
    const result = firestoreModelIdType('');
    expect(result instanceof type.errors).toBe(true);
  });
});
