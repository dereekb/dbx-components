import { type } from 'arktype';
import { knownTimezoneType } from './timezone.validator';

describe('knownTimezoneType', () => {
  it('should validate the UTC timezone', () => {
    const result = knownTimezoneType('UTC');
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should validate the America/Denver timezone', () => {
    const result = knownTimezoneType('America/Denver');
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it('should not validate the NotATimezone timezone', () => {
    const result = knownTimezoneType('NotATimezone');
    expect(result).toBeInstanceOf(type.errors);
  });

  it('should not validate an empty string', () => {
    const result = knownTimezoneType('');
    expect(result).toBeInstanceOf(type.errors);
  });
});
