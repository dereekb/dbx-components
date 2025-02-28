import { type Maybe } from '@dereekb/util';
import { Expose, plainToInstance, Type } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { setMinutes, setHours, addSeconds } from 'date-fns';
import { dateCellTiming, DateCellTiming, isValidDateCellTiming } from './date.cell';
import { type DateCellRange } from './date.cell.index';
import { IsValidDateCellRange, IsValidDateCellRangeSeries, IsValidDateCellTiming } from './date.cell.validator';

class TestDateCellTimingModelClass {
  @Expose()
  @IsOptional()
  @IsValidDateCellTiming()
  @Type(() => DateCellTiming)
  timing!: Maybe<DateCellTiming>;
}

describe('IsValidDateCellTiming', () => {
  const startsAt = setMinutes(setHours(new Date(), 12), 0);
  const validTiming = dateCellTiming({ startsAt, duration: 60 }, 1);

  it('should pass valid timings.', async () => {
    const instance = new TestDateCellTimingModelClass();
    instance.timing = validTiming;

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should fail on invalid timings', async () => {
    const instance = new TestDateCellTimingModelClass();
    const invalidTiming: DateCellTiming = { ...validTiming, startsAt: addSeconds(validTiming.start, 10) };
    instance.timing = invalidTiming;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });

  describe('scenario', () => {
    const timezone = 'America/Chicago';

    it('should serialize the value to a valid timing', async () => {
      const timing = {
        timezone,
        start: new Date('2023-08-15T05:00:00.000Z'),
        end: new Date('2023-12-21T22:30:00.000Z'),
        startsAt: new Date('2023-08-15T13:30:00.000Z'),
        duration: 480
      };

      const json = JSON.stringify(timing);
      const instance = plainToInstance(DateCellTiming, JSON.parse(json), {
        excludeExtraneousValues: true
      });

      const result = await validate(instance);
      expect(result.length).toBe(0);
    });

    it('should serialize the august timing value as an invalid timing', async () => {
      const timing: DateCellTiming = {
        timezone,
        duration: 540,
        startsAt: new Date('2023-08-07T00:00:00.000Z'), // should be a 24 hour difference (invalid)
        end: new Date('2023-08-21T09:00:00.000Z')
      };

      const json = JSON.stringify({ timing });
      const instance = plainToInstance(TestDateCellTimingModelClass, JSON.parse(json), {
        excludeExtraneousValues: true
      });

      const result = await validate(instance);
      expect(result.length).toBe(0);
    });

    it('should pass the valid timing', async () => {
      const timing: DateCellTiming = {
        timezone,
        end: new Date('2023-12-21T22:30:00.000Z'),
        startsAt: new Date('2023-08-15T13:30:00.000Z'),
        duration: 480
      };

      const instance = new TestDateCellTimingModelClass();
      instance.timing = timing;

      const isValid = isValidDateCellTiming(timing);
      expect(isValid).toBe(true);

      const result = await validate(instance);
      expect(result.length).toBe(0);
    });
  });
});

class TestDateCellRangeModelClass {
  @Expose()
  @IsOptional()
  @IsValidDateCellRange()
  range!: Maybe<DateCellRange>;
}

describe('IsValidDateCellRange', () => {
  it('should pass valid ranges.', async () => {
    const instance = new TestDateCellRangeModelClass();
    instance.range = { i: 0 };

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should fail on invalid ranges', async () => {
    const instance = new TestDateCellRangeModelClass();
    const invalidRange: DateCellRange = { i: -1 };
    instance.range = invalidRange;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});

class TestDateCellRangesModelClass {
  @Expose()
  @IsOptional()
  @IsValidDateCellRangeSeries()
  ranges!: Maybe<DateCellRange[]>;
}

describe('IsValidDateCellRangeSeries', () => {
  it('should pass a valid range series.', async () => {
    const instance = new TestDateCellRangesModelClass();
    instance.ranges = [{ i: 0 }];

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should fail on invalid ranges', async () => {
    const instance = new TestDateCellRangesModelClass();
    const invalidRange: DateCellRange[] = [{ i: 0, to: 0 }, { i: 0 }];
    instance.ranges = invalidRange;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});
