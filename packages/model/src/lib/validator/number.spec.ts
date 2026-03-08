import { Expose } from 'class-transformer';
import { validate } from 'class-validator';
import { IsMinuteOfDay } from './number';

class TestScheduleDto {
  @Expose()
  @IsMinuteOfDay()
  startMinute!: number;
}

describe('IsMinuteOfDay', () => {
  it('should pass for minute 0', async () => {
    const instance = new TestScheduleDto();
    instance.startMinute = 0;

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should pass for minute 1439 (last minute of the day)', async () => {
    const instance = new TestScheduleDto();
    instance.startMinute = 1439;

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should pass for a mid-day minute', async () => {
    const instance = new TestScheduleDto();
    instance.startMinute = 720;

    const result = await validate(instance);
    expect(result.length).toBe(0);
  });

  it('should fail for negative values', async () => {
    const instance = new TestScheduleDto();
    instance.startMinute = -1;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });

  it('should fail for values >= 1440', async () => {
    const instance = new TestScheduleDto();
    instance.startMinute = 1440;

    const result = await validate(instance);
    expect(result.length).toBe(1);
  });
});
