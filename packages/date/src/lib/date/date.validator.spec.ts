import { Maybe } from '@dereekb/util';
import { Expose, plainToInstance, Type } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { setMinutes, setHours, startOfDay, addSeconds } from 'date-fns';
import { DateBlockRange, dateBlockTiming, DateBlockTiming, isValidDateBlockTiming } from './date.block';
import { IsValidDateBlockRange, IsValidDateBlockRangeSeries, IsValidDateBlockTiming } from './date.validator';

class TestDateBlockTimingModelClass {
  @Expose()
  @IsOptional()
  @IsValidDateBlockTiming()
  @Type(() => DateBlockTiming)
  timing!: Maybe<DateBlockTiming>;
}

describe('IsValidDateBlockTiming', () => {
  const startsAt = setMinutes(setHours(new Date(), 12), 0);
  const validTiming = dateBlockTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1);

  it('should pass valid timings.', async () => {
    const instance = new TestDateBlockTimingModelClass();
    instance.timing = validTiming;

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should fail on invalid timings', async () => {
    const instance = new TestDateBlockTimingModelClass();
    const invalidTiming: DateBlockTiming = { ...validTiming, start: addSeconds(validTiming.start, 10) };
    instance.timing = invalidTiming;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });

  describe('scenario', () => {
    it('should serialize the value to a valid timing', async () => {
      const timing = {
        start: new Date('2023-08-15T05:00:00.000Z'),
        end: new Date('2023-12-21T22:30:00.000Z'),
        startsAt: new Date('2023-08-15T13:30:00.000Z'),
        duration: 480
      };

      const json = JSON.stringify(timing);
      const instance = plainToInstance(DateBlockTiming, JSON.parse(json), {
        excludeExtraneousValues: true
      });

      const result = await validate(instance);
      expect(result.length).toBe(0);
    });

    it('should serialize the august timing value as an invalid timing', async () => {
      const timing = {
        duration: 540,
        start: new Date('2023-08-06T04:00:00.000Z'),
        startsAt: new Date('2023-08-07T00:00:00.000Z'), // should be a 24 hour difference (invalid)
        end: new Date('2023-08-21T09:00:00.000Z')
      };

      const json = JSON.stringify({ timing });
      const instance = plainToInstance(TestDateBlockTimingModelClass, JSON.parse(json), {
        excludeExtraneousValues: true
      });

      const result = await validate(instance);
      expect(result.length).toBe(0);
    });

    it('should pass the valid timing', async () => {
      const timing = {
        start: new Date('2023-08-15T05:00:00.000Z'),
        end: new Date('2023-12-21T22:30:00.000Z'),
        startsAt: new Date('2023-08-15T13:30:00.000Z'),
        duration: 480
      };

      const instance = new TestDateBlockTimingModelClass();
      instance.timing = timing;

      const isValid = isValidDateBlockTiming(timing);
      expect(isValid).toBe(true);

      const result = await validate(instance);
      expect(result.length).toBe(0);
    });
  });
});

class TestDateBlockRangeModelClass {
  @Expose()
  @IsOptional()
  @IsValidDateBlockRange()
  range!: Maybe<DateBlockRange>;
}

describe('IsValidDateBlockRange', () => {
  it('should pass valid ranges.', async () => {
    const instance = new TestDateBlockRangeModelClass();
    instance.range = { i: 0 };

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should fail on invalid ranges', async () => {
    const instance = new TestDateBlockRangeModelClass();
    const invalidRange: DateBlockRange = { i: -1 };
    instance.range = invalidRange;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});

class TestDateBlockRangesModelClass {
  @Expose()
  @IsOptional()
  @IsValidDateBlockRangeSeries()
  ranges!: Maybe<DateBlockRange[]>;
}

describe('IsValidDateBlockRangeSeries', () => {
  it('should pass a valid range series.', async () => {
    const instance = new TestDateBlockRangesModelClass();
    instance.ranges = [{ i: 0 }];

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should fail on invalid ranges', async () => {
    const instance = new TestDateBlockRangesModelClass();
    const invalidRange: DateBlockRange[] = [{ i: 0, to: 0 }, { i: 0 }];
    instance.ranges = invalidRange;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});
