import { Maybe, TimezoneString } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { IsKnownTimezone } from './timezone.validator';

class TestIsKnownTimezoneModelClass {
  @Expose()
  @IsOptional()
  @IsKnownTimezone()
  timezone!: Maybe<TimezoneString>;
}

describe('IsKnownTimezone', () => {
  it('should validate the UTC timezone', async () => {
    const instance = new TestIsKnownTimezoneModelClass();
    instance.timezone = 'UTC';

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should validate the America/Denver timezone', async () => {
    const instance = new TestIsKnownTimezoneModelClass();
    instance.timezone = 'America/Denver';

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should not validate the NotATimezone timezone', async () => {
    const instance = new TestIsKnownTimezoneModelClass();
    instance.timezone = 'NotATimezone';

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});
