import { type } from 'arktype';
import { iso8601DayStringType } from './date';

describe('iso8601DayStringType', () => {
  it('should pass valid days', () => {
    const result = iso8601DayStringType('1970-01-01');
    expect(result instanceof type.errors).toBe(false);
  });

  it('should fail on invalid days', () => {
    const result = iso8601DayStringType('notadate');
    expect(result instanceof type.errors).toBe(true);
  });
});
