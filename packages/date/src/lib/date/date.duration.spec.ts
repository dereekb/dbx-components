import { plainToInstance } from 'class-transformer';
import { DateBlockTiming, dateBlockTiming } from './date.block';

describe('DateBlockTiming', () => {
  it('should be parsed by class validator.', () => {
    const data = dateBlockTiming({ startsAt: new Date(), duration: 60 }, 10);
    const json: object = JSON.parse(JSON.stringify(data));

    const result = plainToInstance(DateBlockTiming, json, {
      excludeExtraneousValues: true
    });

    expect(result.start).toBeDefined();
    expect(result.end).toBeDefined();
    expect(result.duration).toBe(data.duration);
    expect(result.startsAt).toBeSameSecondAs(data.startsAt);
  });
});
