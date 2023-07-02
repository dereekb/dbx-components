import { addHours, endOfDay, startOfDay } from 'date-fns';
import { LimitDateTimeInstance } from './date.time.limit';

describe('LimitDateTimeInstance', () => {
  it('should have no min if min is not configured.', () => {
    const result: LimitDateTimeInstance = new LimitDateTimeInstance({
      limits: {}
    });

    const min = result.min;
    expect(min).toBeUndefined();
  });

  it('should have no max if max is not configured.', () => {
    const result: LimitDateTimeInstance = new LimitDateTimeInstance({
      limits: {}
    });

    const max = result.max;
    expect(max).toBeUndefined();
  });

  describe('clamp', () => {
    it('should clamp the date range to the min and max.', () => {
      const min = startOfDay(new Date());
      const max = endOfDay(new Date());

      const result: LimitDateTimeInstance = new LimitDateTimeInstance({
        limits: {
          min,
          max
        }
      });

      const past = addHours(new Date(), -25);
      expect(result.clamp(past)).toEqual(min);
    });

    it('should not clamp the date range if no min/max is provided.', () => {
      const result: LimitDateTimeInstance = new LimitDateTimeInstance({
        limits: {}
      });

      const past = addHours(new Date(), -25);
      expect(result.clamp(past)).toEqual(past);
    });

    it('should not clamp the date range min if no min is provided.', () => {
      const result: LimitDateTimeInstance = new LimitDateTimeInstance({
        limits: {}
      });

      const past = addHours(new Date(), -25);
      expect(result.clamp(past)).toEqual(past);
    });

    it('should not clamp the date range max if no max is provided.', () => {
      const result: LimitDateTimeInstance = new LimitDateTimeInstance({
        limits: {}
      });

      const future = addHours(new Date(), 25);
      expect(result.clamp(future)).toEqual(future);
    });
  });
});
