import { type } from 'arktype';
import { nonEmptyStringWithMaxLength } from './string';

describe('nonEmptyStringWithMaxLength()', () => {
  const maxLength = 5;
  const stringType = type(nonEmptyStringWithMaxLength(maxLength));

  it('should pass for a string within the max length', () => {
    const result = stringType('abc');
    expect(result instanceof type.errors).toBe(false);
  });

  it('should pass for a string exactly at the max length', () => {
    const result = stringType('abcde');
    expect(result instanceof type.errors).toBe(false);
  });

  it('should fail for an empty string', () => {
    const result = stringType('');
    expect(result instanceof type.errors).toBe(true);
  });

  it('should fail for a string longer than the max length', () => {
    const result = stringType('abcdef');
    expect(result instanceof type.errors).toBe(true);
  });
});
