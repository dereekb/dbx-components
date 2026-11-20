import { type } from 'arktype';
import { nonBlankStringType, nonEmptyStringWithMaxLength } from './string';

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

describe('nonBlankStringType', () => {
  it('should fail for a blank or empty string', () => {
    expect(nonBlankStringType('   ') instanceof type.errors).toBe(true);
    expect(nonBlankStringType('') instanceof type.errors).toBe(true);
  });

  it('should pass for a string with surrounding whitespace, without trimming it', () => {
    expect(nonBlankStringType(' strong ')).toBe(' strong ');
  });

  it('should fail for a non-string', () => {
    expect(nonBlankStringType(42) instanceof type.errors).toBe(true);
  });

  it('should fail a blank optional field in an object type', () => {
    expect(type({ 'name?': nonBlankStringType })({ name: ' ' }) instanceof type.errors).toBe(true);
  });
});
