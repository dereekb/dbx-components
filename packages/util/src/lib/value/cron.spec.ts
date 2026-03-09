import { cronExpressionRepeatingEveryNMinutes } from './cron';

describe('cronExpressionRepeatingEveryNMinutes()', () => {
  it('should create a cron expression for every 5 minutes', () => {
    const every5 = cronExpressionRepeatingEveryNMinutes(5);
    expect(every5).toBe('*/5 * * * *');
  });

  it('should create a cron expression for every 1 minute', () => {
    const result = cronExpressionRepeatingEveryNMinutes(1);
    expect(result).toBe('*/1 * * * *');
  });

  it('should create a cron expression for every 30 minutes', () => {
    const result = cronExpressionRepeatingEveryNMinutes(30);
    expect(result).toBe('*/30 * * * *');
  });

  it('should create an hourly expression for 60 minutes', () => {
    const result = cronExpressionRepeatingEveryNMinutes(60);
    expect(result).toBe('0 */1 * * *');
  });

  it('should create an expression for 90 minutes (every 1 hour at minute 30)', () => {
    const every90 = cronExpressionRepeatingEveryNMinutes(90);
    expect(every90).toBe('30 */1 * * *');
  });

  it('should create an expression for 120 minutes (every 2 hours at minute 0)', () => {
    const result = cronExpressionRepeatingEveryNMinutes(120);
    expect(result).toBe('0 */2 * * *');
  });
});
