import { ISO8601DayString } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { IsISO8601DayString } from './date';

class TestModelClass {
  @Expose()
  @IsOptional()
  @IsISO8601DayString()
  day!: ISO8601DayString;
}

describe('IsISO8601DayString', () => {
  it('should pass valid days', async () => {
    const instance = new TestModelClass();
    instance.day = '1970-01-01';

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should fail on invalid days', async () => {
    const instance = new TestModelClass();
    instance.day = 'notadate';

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});
