import { Maybe } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { setMinutes, setHours, startOfDay, addSeconds } from 'date-fns';
import { dateBlockTiming, DateBlockTiming } from './date.block';
import { IsValidDateBlockTiming } from './date.validator';

class TestModelClass {
  @Expose()
  @IsOptional()
  @IsValidDateBlockTiming()
  timing!: Maybe<DateBlockTiming>;
}

describe('IsValidDateBlockTiming', () => {
  const startsAt = setMinutes(setHours(new Date(), 12), 0);
  const validTiming = dateBlockTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1);

  it('should pass valid timings.', async () => {
    const instance = new TestModelClass();
    instance.timing = validTiming;

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should fail on invalid timings', async () => {
    const instance = new TestModelClass();
    const invalidTiming: DateBlockTiming = { ...validTiming, start: addSeconds(validTiming.start, 10) };
    instance.timing = invalidTiming;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});
