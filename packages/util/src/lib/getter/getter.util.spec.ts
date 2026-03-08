import { randomFromArrayFactory } from './getter.util';

describe('randomFromArrayFactory', () => {
  it('should return values from the input array', () => {
    const values = ['a', 'b', 'c'];
    const factory = randomFromArrayFactory(values);

    for (let i = 0; i < 20; i++) {
      const result = factory();
      expect(values).toContain(result);
    }
  });

  it('should return the only value when array has one element', () => {
    const factory = randomFromArrayFactory([42]);
    expect(factory()).toBe(42);
    expect(factory()).toBe(42);
  });
});
