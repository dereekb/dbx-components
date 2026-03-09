import { type DecisionFunction, decisionFunction, invertDecision, asDecisionFunction, isEqualToValueDecisionFunction } from './decision';

describe('decisionFunction()', () => {
  it('should return a function that always returns true', () => {
    const alwaysTrue = decisionFunction(true);
    expect(alwaysTrue('anything')).toBe(true);
  });

  it('should return a function that always returns false', () => {
    const alwaysFalse = decisionFunction(false);
    expect(alwaysFalse('anything')).toBe(false);
  });
});

describe('invertDecision()', () => {
  it('should invert the decision function when invert is true', () => {
    const isPositive: DecisionFunction<number> = (x) => x > 0;
    const isNotPositive = invertDecision(isPositive, true);
    expect(isNotPositive(5)).toBe(false);
    expect(isNotPositive(-1)).toBe(true);
  });

  it('should not invert the decision function when invert is false', () => {
    const isPositive: DecisionFunction<number> = (x) => x > 0;
    const result = invertDecision(isPositive, false);
    expect(result(5)).toBe(true);
  });
});

describe('asDecisionFunction()', () => {
  it('should wrap a boolean true into a constant decision function', () => {
    const fn = asDecisionFunction(true);
    expect(fn('anything')).toBe(true);
  });

  it('should wrap a boolean false into a constant decision function', () => {
    const fn = asDecisionFunction(false);
    expect(fn('anything')).toBe(false);
  });

  it('should return the input function as-is when given a function', () => {
    const original: DecisionFunction<string> = (x) => x === 'yes';
    const fn = asDecisionFunction(original);
    expect(fn).toBe(original);
  });

  it('should default to true when input is undefined', () => {
    const fn = asDecisionFunction(undefined);
    expect(fn('anything')).toBe(true);
  });

  it('should use the provided default when input is undefined', () => {
    const fn2 = asDecisionFunction(undefined, false);
    expect(fn2('anything')).toBe(false);
  });
});

describe('isEqualToValueDecisionFunction()', () => {
  it('should create a decision function that checks strict equality', () => {
    const isThree = isEqualToValueDecisionFunction(3);
    expect(isThree(3)).toBe(true);
    expect(isThree(4)).toBe(false);
  });

  it('should return the input function as-is when given a function', () => {
    const customFn: DecisionFunction<number> = (x) => x > 10;
    const result = isEqualToValueDecisionFunction(customFn);
    expect(result).toBe(customFn);
    expect(result(11)).toBe(true);
    expect(result(5)).toBe(false);
  });

  it('should use strict equality (not loose)', () => {
    const isNull = isEqualToValueDecisionFunction<null | undefined>(null);
    expect(isNull(null)).toBe(true);
    expect(isNull(undefined)).toBe(false);
  });
});
