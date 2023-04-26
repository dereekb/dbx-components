import { isISO8601DateString, isUTCDateString } from '@dereekb/util';
import { parseISO } from 'date-fns';
import { parseJsDateString } from './date';

describe('parseJsDateString()', () => {
  it('should parse an ISO8601DateString to a Date', () => {
    const dateString = '2020-04-30T00:00:00.000';

    expect(isISO8601DateString(dateString)).toBe(true);

    const result = parseJsDateString(dateString);
    expect(result).toBeSameSecondAs(parseISO(dateString));
  });

  it('should parse an UTCDateString to a Date', () => {
    const dateString = 'Sat, 03 Feb 2001 04:05:06 GMT';

    expect(isUTCDateString(dateString)).toBe(true);

    const result = parseJsDateString(dateString);
    expect(result).toBeSameSecondAs(new Date(dateString));
  });
});
