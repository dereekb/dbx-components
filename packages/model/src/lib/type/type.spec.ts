import { type } from 'arktype';
import { clearable } from './type';

describe('clearable()', () => {
  describe('with a simple type (number)', () => {
    const clearableNumber = type({
      value: clearable('number')
    });

    it('should accept a valid value', () => {
      const result = clearableNumber({ value: 42 });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: number | null }).value).toBe(42);
    });

    it('should accept null', () => {
      const result = clearableNumber({ value: null });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: number | null }).value).toBe(null);
    });

    it('should reject undefined', () => {
      const result = clearableNumber({ value: undefined });
      expect(result instanceof type.errors).toBe(true);
    });

    it('should reject a string', () => {
      const result = clearableNumber({ value: 'hello' });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('with string', () => {
    const clearableString = type({
      value: clearable('string')
    });

    it('should accept a valid string', () => {
      const result = clearableString({ value: 'hello' });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: string | null }).value).toBe('hello');
    });

    it('should accept null', () => {
      const result = clearableString({ value: null });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: string | null }).value).toBe(null);
    });

    it('should reject a number', () => {
      const result = clearableString({ value: 123 });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('with boolean', () => {
    const clearableBoolean = type({
      value: clearable('boolean')
    });

    it('should accept true', () => {
      const result = clearableBoolean({ value: true });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should accept false', () => {
      const result = clearableBoolean({ value: false });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should accept null', () => {
      const result = clearableBoolean({ value: null });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: boolean | null }).value).toBe(null);
    });

    it('should reject a string', () => {
      const result = clearableBoolean({ value: 'true' });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('with clearable boolean (true | false | null | undefined)', () => {
    const schema = type({
      'flag?': clearable('boolean')
    });

    it('should accept true', () => {
      const result = schema({ flag: true });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { flag?: boolean | null }).flag).toBe(true);
    });

    it('should accept false', () => {
      const result = schema({ flag: false });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { flag?: boolean | null }).flag).toBe(false);
    });

    it('should accept null', () => {
      const result = schema({ flag: null });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { flag?: boolean | null }).flag).toBe(null);
    });

    it('should accept undefined (omitted)', () => {
      const result = schema({});
      expect(result instanceof type.errors).toBe(false);
      expect((result as { flag?: boolean | null }).flag).toBeUndefined();
    });

    it('should reject a string', () => {
      const result = schema({ flag: 'true' });
      expect(result instanceof type.errors).toBe(true);
    });

    it('should reject a number', () => {
      const result = schema({ flag: 0 });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('with union definition (true | false | null | undefined)', () => {
    const schema = type({
      value: clearable('true | false | null | undefined')
    });

    it('should accept true', () => {
      const result = schema({ value: true });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should accept false', () => {
      const result = schema({ value: false });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should accept null (from clearable)', () => {
      const result = schema({ value: null });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should accept undefined', () => {
      const result = schema({ value: undefined });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should reject a string', () => {
      const result = schema({ value: 'true' });
      expect(result instanceof type.errors).toBe(true);
    });

    it('should reject a number', () => {
      const result = schema({ value: 1 });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('with string.date.parse (morph)', () => {
    const clearableDateSchema = type({
      value: clearable('string.date.parse')
    });

    it('should parse a valid ISO date string to a Date', () => {
      const result = clearableDateSchema({ value: '2024-01-01T00:00:00.000Z' });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: Date | null }).value).toBeInstanceOf(Date);
    });

    it('should accept null without parsing', () => {
      const result = clearableDateSchema({ value: null });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: Date | null }).value).toBe(null);
    });

    it('should reject a number', () => {
      const result = clearableDateSchema({ value: 123 });
      expect(result instanceof type.errors).toBe(true);
    });

    it('should reject a boolean', () => {
      const result = clearableDateSchema({ value: true });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('with constrained type (string >= 1)', () => {
    const clearableNonEmptyString = type({
      value: clearable('string >= 1')
    });

    it('should accept a non-empty string', () => {
      const result = clearableNonEmptyString({ value: 'hello' });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should accept null', () => {
      const result = clearableNonEmptyString({ value: null });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should reject an empty string', () => {
      const result = clearableNonEmptyString({ value: '' });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('as optional property in an object schema', () => {
    const schema = type({
      name: 'string',
      'bio?': clearable('string')
    });

    it('should accept the field with a value', () => {
      const result = schema({ name: 'Alice', bio: 'Hello' });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should accept the field as null', () => {
      const result = schema({ name: 'Alice', bio: null });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should accept the field omitted entirely', () => {
      const result = schema({ name: 'Alice' });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should reject the field with an invalid type', () => {
      const result = schema({ name: 'Alice', bio: 123 });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('multiple clearable fields in one schema', () => {
    const schema = type({
      'startDate?': clearable('string.date.parse'),
      'endDate?': clearable('string.date.parse'),
      'label?': clearable('string')
    });

    it('should accept all fields with values', () => {
      const result = schema({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T00:00:00.000Z',
        label: 'Test'
      });
      expect(result instanceof type.errors).toBe(false);

      const out = result as { startDate: Date | null; endDate: Date | null; label: string | null };
      expect(out.startDate).toBeInstanceOf(Date);
      expect(out.endDate).toBeInstanceOf(Date);
      expect(out.label).toBe('Test');
    });

    it('should accept a mix of values and nulls', () => {
      const result = schema({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: null,
        label: null
      });
      expect(result instanceof type.errors).toBe(false);

      const out = result as { startDate: Date | null; endDate: Date | null; label: string | null };
      expect(out.startDate).toBeInstanceOf(Date);
      expect(out.endDate).toBe(null);
      expect(out.label).toBe(null);
    });

    it('should accept all fields as null', () => {
      const result = schema({
        startDate: null,
        endDate: null,
        label: null
      });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should accept all fields omitted', () => {
      const result = schema({});
      expect(result instanceof type.errors).toBe(false);
    });
  });

  describe('with string.email', () => {
    const clearableEmail = type({
      'email?': clearable('string.email')
    });

    it('should accept a valid email', () => {
      const result = clearableEmail({ email: 'user@example.com' });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should accept null', () => {
      const result = clearableEmail({ email: null });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should reject an invalid email', () => {
      const result = clearableEmail({ email: 'not-an-email' });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('with string.numeric.parse (string → number morph)', () => {
    const schema = type({
      value: clearable('string.numeric.parse')
    });

    it('should parse a numeric string to a number', () => {
      const result = schema({ value: '42.5' });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: number | null }).value).toBe(42.5);
    });

    it('should accept null', () => {
      const result = schema({ value: null });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: number | null }).value).toBe(null);
    });

    it('should reject a non-numeric string', () => {
      const result = schema({ value: 'abc' });
      expect(result instanceof type.errors).toBe(true);
    });

    it('should reject a raw number (input must be string)', () => {
      const result = schema({ value: 42 });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('with string.integer.parse (string → integer morph)', () => {
    const schema = type({
      value: clearable('string.integer.parse')
    });

    it('should parse an integer string to a number', () => {
      const result = schema({ value: '100' });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: number | null }).value).toBe(100);
    });

    it('should accept null', () => {
      const result = schema({ value: null });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: number | null }).value).toBe(null);
    });

    it('should reject a decimal string', () => {
      const result = schema({ value: '42.5' });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('with string.date.iso.parse (ISO string → Date morph)', () => {
    const schema = type({
      value: clearable('string.date.iso.parse')
    });

    it('should parse an ISO date string to a Date', () => {
      const result = schema({ value: '2024-06-15T12:00:00.000Z' });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: Date | null }).value).toBeInstanceOf(Date);
    });

    it('should accept null', () => {
      const result = schema({ value: null });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: Date | null }).value).toBe(null);
    });

    it('should reject a non-ISO date string', () => {
      const result = schema({ value: 'June 15, 2024' });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('with string.json.parse (string → object morph)', () => {
    const schema = type({
      value: clearable('string.json.parse')
    });

    it('should parse a JSON string to an object', () => {
      const result = schema({ value: '{"key":"val"}' });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: object | null }).value).toEqual({ key: 'val' });
    });

    it('should accept null', () => {
      const result = schema({ value: null });
      expect(result instanceof type.errors).toBe(false);
      expect((result as { value: object | null }).value).toBe(null);
    });

    it('should reject invalid JSON', () => {
      const result = schema({ value: '{bad json' });
      expect(result instanceof type.errors).toBe(true);
    });
  });

  describe('morph output is not corrupted by null union', () => {
    const schema = type({
      date: clearable('string.date.parse'),
      num: clearable('string.numeric.parse')
    });

    it('should correctly morph both fields when both have values', () => {
      const result = schema({ date: '2024-01-01T00:00:00.000Z', num: '99' });
      expect(result instanceof type.errors).toBe(false);

      const out = result as { date: Date | null; num: number | null };
      expect(out.date).toBeInstanceOf(Date);
      expect(out.date!.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(out.num).toBe(99);
    });

    it('should morph one and pass null through the other', () => {
      const result = schema({ date: null, num: '42' });
      expect(result instanceof type.errors).toBe(false);

      const out = result as { date: Date | null; num: number | null };
      expect(out.date).toBe(null);
      expect(out.num).toBe(42);
    });

    it('should not morph null through the parse pipeline', () => {
      const result = schema({ date: null, num: null });
      expect(result instanceof type.errors).toBe(false);

      const out = result as { date: Date | null; num: number | null };
      expect(out.date).toBe(null);
      expect(out.num).toBe(null);
    });
  });
});
