import { isISO8601DayString } from '@dereekb/util';

describe('isISO8601DayString()', () => {
  it('should validate day strings', () => {
    expect(isISO8601DayString('1970-01-01'));
    expect(isISO8601DayString('1970-1-1')).toBe(false);
  });
});
