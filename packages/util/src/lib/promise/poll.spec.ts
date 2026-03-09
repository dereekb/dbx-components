import { poll } from './poll';

describe('poll()', () => {
  it('should resolve immediately if the check condition is already met', async () => {
    await expect(
      poll({
        check: () => true,
        wait: 10
      })
    ).resolves.toBeUndefined();
  });

  it('should poll until the check condition is met', async () => {
    let count = 0;

    await poll({
      check: () => {
        count += 1;
        return count >= 3;
      },
      wait: 10
    });

    expect(count).toBe(3);
  });

  it('should stop polling after timesToGiveup is reached', async () => {
    let count = 0;

    await poll({
      check: () => {
        count += 1;
        return false; // never resolves
      },
      wait: 10,
      timesToGiveup: 5
    });

    expect(count).toBeLessThanOrEqual(5);
  });
});
