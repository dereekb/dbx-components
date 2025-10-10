import { stringFromDateFactory, stringFromTimeFactory } from './factory';

describe('stringFromDateFactory', () => {
  const testDate = new Date('2024-01-15T12:30:45.123Z');

  describe('with dateToString', () => {
    it('should return the full string from dateToString when no transformations are applied.', () => {
      const factory = stringFromDateFactory({
        dateToString: (date) => date.toISOString()
      });
      expect(factory(testDate)).toBe(testDate.toISOString());
    });

    it('should use current date when no input is provided.', () => {
      const factory = stringFromDateFactory({
        dateToString: (date) => date.getTime().toString()
      });
      const beforeTime = Date.now();
      const result = factory();
      const afterTime = Date.now();
      const resultTime = parseInt(result, 10);
      expect(resultTime).toBeGreaterThanOrEqual(beforeTime);
      expect(resultTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('with takeFromEnd', () => {
    it('should take the specified number of digits from the end.', () => {
      const factory = stringFromDateFactory({
        takeFromEnd: 5,
        dateToString: (date) => date.getTime().toString()
      });
      const fullString = testDate.getTime().toString();
      expect(factory(testDate)).toBe(fullString.slice(-5));
    });

    it('should return full string when takeFromEnd is 0.', () => {
      const factory = stringFromDateFactory({
        takeFromEnd: 0,
        dateToString: (date) => date.getTime().toString()
      });
      expect(factory(testDate)).toBe(testDate.getTime().toString());
    });

    it('should return full string when takeFromEnd is undefined.', () => {
      const factory = stringFromDateFactory({
        dateToString: (date) => date.getTime().toString()
      });
      expect(factory(testDate)).toBe(testDate.getTime().toString());
    });
  });

  describe('with transformStringConfig', () => {
    it('should apply trim transformation.', () => {
      const factory = stringFromDateFactory({
        dateToString: (date) => `  ${date.getTime()}  `,
        transformStringConfig: { trim: true }
      });
      expect(factory(testDate)).toBe(testDate.getTime().toString());
    });

    it('should apply uppercase transformation.', () => {
      const factory = stringFromDateFactory({
        dateToString: (date) => date.toISOString(),
        transformStringConfig: { toUppercase: true }
      });
      expect(factory(testDate)).toBe(testDate.toISOString().toUpperCase());
    });

    it('should apply lowercase transformation.', () => {
      const factory = stringFromDateFactory({
        dateToString: (date) => date.toISOString(),
        transformStringConfig: { toLowercase: true }
      });
      expect(factory(testDate)).toBe(testDate.toISOString().toLowerCase());
    });

    it('should apply custom transform function.', () => {
      const factory = stringFromDateFactory({
        dateToString: (date) => date.getTime().toString(),
        transformStringConfig: { transform: (s) => `prefix-${s}` }
      });
      expect(factory(testDate)).toBe(`prefix-${testDate.getTime()}`);
    });

    it('should apply slice from transformStringConfig.', () => {
      const factory = stringFromDateFactory({
        dateToString: (date) => date.getTime().toString(),
        transformStringConfig: { slice: { fromStart: 2, fromEnd: 3 } }
      });
      const fullString = testDate.getTime().toString();
      expect(factory(testDate)).toBe(fullString.slice(0, 2) + fullString.slice(-3));
    });

    it('should prioritize transformStringConfig.slice over takeFromEnd.', () => {
      const factory = stringFromDateFactory({
        takeFromEnd: 5,
        dateToString: (date) => date.getTime().toString(),
        transformStringConfig: { slice: { fromStart: 2 } }
      });
      const fullString = testDate.getTime().toString();
      expect(factory(testDate)).toBe(fullString.slice(0, 2));
    });

    it('should apply multiple transformations in order.', () => {
      const factory = stringFromDateFactory({
        dateToString: (date) => `  ${date.getTime()}  `,
        transformStringConfig: {
          trim: true,
          slice: { fromEnd: 3 },
          toUppercase: true
        }
      });
      const fullString = testDate.getTime().toString();
      expect(factory(testDate)).toBe(fullString.slice(-3).toUpperCase());
    });
  });

  describe('with takeFromEnd and transformStringConfig', () => {
    it('should apply takeFromEnd as slice when transformStringConfig has no slice.', () => {
      const factory = stringFromDateFactory({
        takeFromEnd: 4,
        dateToString: (date) => date.getTime().toString(),
        transformStringConfig: { toUppercase: true }
      });
      const fullString = testDate.getTime().toString();
      expect(factory(testDate)).toBe(fullString.slice(-4).toUpperCase());
    });

    it('should combine takeFromEnd with trim.', () => {
      const factory = stringFromDateFactory({
        takeFromEnd: 3,
        dateToString: (date) => `  ${date.getTime()}  `,
        transformStringConfig: { trim: true }
      });
      const fullString = testDate.getTime().toString();
      expect(factory(testDate)).toBe(fullString.slice(-3));
    });
  });
});

describe('stringFromTimeFactory', () => {
  const testDate = new Date('2024-01-15T12:30:45.123Z');

  it('should return the last 7 digits of the timestamp by default.', () => {
    const factory = stringFromTimeFactory();
    const fullTimestamp = testDate.getTime().toString();
    expect(factory(testDate)).toBe(fullTimestamp.slice(-7));
  });

  it('should return the specified number of digits from the end.', () => {
    const factory = stringFromTimeFactory(5);
    const fullTimestamp = testDate.getTime().toString();
    expect(factory(testDate)).toBe(fullTimestamp.slice(-5));
  });

  it('should return full timestamp when digitsFromEnd is 0.', () => {
    const factory = stringFromTimeFactory(0);
    expect(factory(testDate)).toBe(testDate.getTime().toString());
  });

  it('should handle different digit lengths.', () => {
    const factory10 = stringFromTimeFactory(10);
    const factory3 = stringFromTimeFactory(3);

    const fullTimestamp = testDate.getTime().toString();
    expect(factory10(testDate)).toBe(fullTimestamp.slice(-10));
    expect(factory3(testDate)).toBe(fullTimestamp.slice(-3));
  });
});
