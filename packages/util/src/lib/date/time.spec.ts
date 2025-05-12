import { waitForMs } from '../promise';
import { timePeriodCounter, makeTimer, TimerCancelledError, toggleTimerRunning, approximateTimerEndDate } from './time';

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

describe('makeTimer()', () => {
  const timerDuration = 50;

  it('should create a timer that starts immediately by default', async () => {
    const timer = makeTimer(timerDuration);
    expect(timer.state).toBe('running');
  });

  it('should create a timer that does not start immediately if specified', async () => {
    const timer = makeTimer(timerDuration, false);
    expect(timer.state).toBe('paused');
    await waitForMs(timerDuration + 10); // wait longer than duration
    expect(timer.state).toBe('paused'); // still paused
    timer.start();
    expect(timer.state).toBe('running');
  });

  it('should allow starting and stopping the timer', async () => {
    const timer = makeTimer(timerDuration, false);
    expect(timer.state).toBe('paused');
    timer.start();
    expect(timer.state).toBe('running');
    await waitForMs(timerDuration / 2);
    timer.stop();
    expect(timer.state).toBe('paused');
    expect(timer.durationRemaining).toBeNull(); // Paused means remaining is null
    await waitForMs(timerDuration); // wait longer than original duration
    expect(timer.state).toBe('paused'); // still paused
    timer.start();
    expect(timer.state).toBe('running');
  });

  it('should allow resetting the timer', async () => {
    const timer = makeTimer(timerDuration, true);
    expect(timer.state).toBe('running');
    await waitForMs(timerDuration / 2);
    timer.reset();
    expect(timer.state).toBe('running');
    expect(timer.durationRemaining).toBeGreaterThan(timerDuration / 2); // Remaining should be close to full duration
  });

  it('should complete when duration elapses', (done) => {
    const timer = makeTimer(timerDuration);

    setTimeout(() => {
      expect(timer.state).toBe('complete');
      expect(timer.durationRemaining).toBe(0);
      done();
    }, timerDuration + 5);
  });

  it('should throw TimerCancelledError if destroyed while running', async () => {
    const timer = makeTimer(timerDuration * 2, true);
    expect(timer.state).toBe('running');
    await waitForMs(timerDuration / 2);
    timer.destroy();
    await expect(timer.promise).rejects.toThrow(TimerCancelledError);
    expect(timer.state).toBe('cancelled');
  });

  it('should throw error if destroyed while paused', async () => {
    const timer = makeTimer(timerDuration, false);
    expect(timer.state).toBe('paused');
    timer.destroy();
    expect(timer.state).toBe('cancelled');
    await expect(timer.promise).rejects.toThrow(TimerCancelledError);
  });

  it('setDuration() should update the duration', async () => {
    const timer = makeTimer(timerDuration * 4, true);
    expect(timer.duration).toBe(timerDuration * 4);
    timer.setDuration(timerDuration);
    expect(timer.duration).toBe(timerDuration);
  });

  it('should have a durationRemaining that decreases', async () => {
    const timer = makeTimer(timerDuration, true);
    expect(timer.durationRemaining).toBeLessThanOrEqual(timerDuration);
    await waitForMs(timerDuration / 2 + 1);
    expect(timer.durationRemaining).toBeLessThanOrEqual(timerDuration / 2);
    await timer.promise;
    expect(timer.durationRemaining).toBe(0);
  });
});

describe('toggleTimerRunning()', () => {
  const timerDuration = 20;

  it('should start a paused timer', () => {
    const timer = makeTimer(timerDuration, false);
    expect(timer.state).toBe('paused');
    toggleTimerRunning(timer, true);
    expect(timer.state).toBe('running');

    // cleanup
    timer.completeNow();
    timer.destroy();
  });

  it('should stop a running timer', () => {
    const timer = makeTimer(timerDuration, true);
    expect(timer.state).toBe('running');
    toggleTimerRunning(timer, false);
    expect(timer.state).toBe('paused');

    // cleanup
    timer.completeNow();
    timer.destroy();
  });

  it('should toggle a paused timer to running if no explicit toggleRun given', () => {
    const timer = makeTimer(timerDuration, false);
    expect(timer.state).toBe('paused');
    toggleTimerRunning(timer);
    expect(timer.state).toBe('running');

    // cleanup
    timer.completeNow();
    timer.destroy();
  });

  it('should toggle a running timer to paused if no explicit toggleRun given', () => {
    const timer = makeTimer(timerDuration, true);
    expect(timer.state).toBe('running');
    toggleTimerRunning(timer);
    expect(timer.state).toBe('paused');

    // cleanup
    timer.completeNow();
    timer.destroy();
  });
});

describe('approximateTimerEndDate()', () => {
  const timerDuration = 100;

  it('should return a date in the future for a running timer', async () => {
    const timer = makeTimer(timerDuration, true);
    const endDate = approximateTimerEndDate(timer);
    expect(endDate).toBeInstanceOf(Date);
    expect(endDate!.getTime()).toBeGreaterThan(Date.now());
    await timer.promise; // allow timer to complete
  });

  it('should return null for a paused timer', () => {
    const timer = makeTimer(timerDuration, false);
    expect(timer.state).toBe('paused');
    const endDate = approximateTimerEndDate(timer);
    expect(endDate).toBeNull();
  });

  it('should return a date equivalent to now for a completed timer', async () => {
    const timer = makeTimer(10); // short timer
    await timer.promise; // wait for completion
    expect(timer.state).toBe('complete');
    const endDate = approximateTimerEndDate(timer);
    expect(endDate).toBeInstanceOf(Date);
    // Due to minor timing differences, check if it's very close to Date.now()
    expect(Math.abs(endDate!.getTime() - Date.now())).toBeLessThanOrEqual(50); // Allow 50ms diff
  });
});
