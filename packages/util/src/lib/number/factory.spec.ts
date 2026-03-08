import { incrementingNumberFactory } from './factory';

describe('incrementingNumberFactory()', () => {
  it('should start at 0 by default', () => {
    const factory = incrementingNumberFactory();
    expect(factory()).toBe(0);
  });

  it('should increment by 1 by default', () => {
    const factory = incrementingNumberFactory();
    factory(); // 0
    expect(factory()).toBe(1);
    expect(factory()).toBe(2);
  });

  it('should start at the configured startAt value', () => {
    const factory = incrementingNumberFactory({ startAt: 10 });
    expect(factory()).toBe(10);
    expect(factory()).toBe(11);
  });

  it('should increment by the configured increaseBy value', () => {
    const factory = incrementingNumberFactory({ startAt: 0, increaseBy: 5 });
    expect(factory()).toBe(0);
    expect(factory()).toBe(5);
    expect(factory()).toBe(10);
  });

  it('should run the example successfully', () => {
    const factory = incrementingNumberFactory({ startAt: 10, increaseBy: 5 });
    expect(factory()).toBe(10);
    expect(factory()).toBe(15);
    expect(factory()).toBe(20);
  });
});
