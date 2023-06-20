import { Maybe } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { setMinutes, setHours, startOfDay, addSeconds } from 'date-fns';
import { DateBlock, DateBlockRange, dateBlockTiming, DateBlockTiming } from './date.block';
import { IsValidDateBlockRange, IsValidDateBlockRangeSeries, IsValidDateBlockTiming } from './date.validator';

class TestDateBlockTimingModelClass {
  @Expose()
  @IsOptional()
  @IsValidDateBlockTiming()
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
