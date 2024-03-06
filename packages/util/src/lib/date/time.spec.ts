import { waitForMs } from '../promise';
import { timePeriodCounter } from './time';

describe('timePeriodCounter()', () => {
  it('should create a new counter.', () => {
    const start = new Date();
    const length = 1000;
    const counter = timePeriodCounter(length, start);

    expect(counter).toBeDefined();
    expect(counter._lastTimePeriodStart).toBeSameSecondAs(start);
    expect(counter._nextTimePeriodEnd).toBeAfter(start);
    expect(counter._timePeriodCount).toBe(-1); // not yet started
    expect(counter._timePeriodLength).toBe(length);
  });

  it('should increment the counter.', () => {
    const length = 1000;
    const counter = timePeriodCounter(length);

    counter(); // 0
    counter(); // 1
    counter(); // 2
    counter(); // 3

    const result = counter();
    expect(result).toBe(4);
  });

  it('should reset the counter when a new period starts.', async () => {
    const start = new Date();
    const length = 10;
    const counter = timePeriodCounter(length, start);

    counter(); // 0
    counter(); // 1

    let result = counter();
    expect(result).toBe(2);

    await waitForMs(length * 2);

    counter(); // 0
    counter(); // 1

    result = counter();
    expect(result).toBe(2);
  });
});
