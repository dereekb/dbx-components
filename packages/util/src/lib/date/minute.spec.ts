import { MS_IN_SECOND } from './date';
import { millisecondsToMinutesAndSeconds, secondsToMinutesAndSeconds } from './minute';

describe('millisecondsToMinutesAndSeconds()', () => {
  it('should convert milliseconds to minutes and seconds', () => {
    const result = millisecondsToMinutesAndSeconds(123 * MS_IN_SECOND);
    expect(result).toEqual({ minute: 2, second: 3 });
  });
});

describe('secondsToMinutesAndSeconds()', () => {
  it('should convert seconds to minutes and seconds', () => {
    const result = secondsToMinutesAndSeconds(123);
    expect(result).toEqual({ minute: 2, second: 3 });
  });
});
