import { describe, expect, it } from 'vitest';
import { dbxRotatingButtonAriaLabel, dbxRotatingButtonRotationOrder, dbxRotatingButtonStateIndex, isEqualDbxRotatingButtonValue, nextDbxRotatingButtonState } from './button.rotating';

describe('isEqualDbxRotatingButtonValue()', () => {
  it('should treat null and undefined as equal', () => {
    expect(isEqualDbxRotatingButtonValue(null, undefined)).toBe(true);
    expect(isEqualDbxRotatingButtonValue<boolean>(false, null)).toBe(false);
  });
});

describe('nextDbxRotatingButtonState()', () => {
  const config = { states: [{ value: 'a' }, { value: 'b' }, { value: 'c' }] };

  it('should return the next state and wrap', () => {
    expect(nextDbxRotatingButtonState(config, 'a')?.value).toBe('b');
    expect(nextDbxRotatingButtonState(config, 'c')?.value).toBe('a');
  });

  it('should start at the first state for an unknown value', () => {
    expect(dbxRotatingButtonStateIndex(config, 'z')).toBe(-1);
    expect(nextDbxRotatingButtonState(config, 'z')?.value).toBe('a');
  });

  it('should use a custom isEqual', () => {
    const caseInsensitive = { ...config, isEqual: (a: string | null | undefined, b: string | null | undefined) => a?.toLowerCase() === b?.toLowerCase() };
    expect(nextDbxRotatingButtonState(caseInsensitive, 'B')?.value).toBe('c');
  });

  it('should return undefined when there are no states', () => {
    expect(nextDbxRotatingButtonState({ states: [] }, 'a')).toBeUndefined();
  });

  it('should follow the rotation order', () => {
    expect(nextDbxRotatingButtonState(config, 'a', [0, 2, 1])?.value).toBe('c');
    expect(nextDbxRotatingButtonState(config, 'c', [0, 2, 1])?.value).toBe('b');
    expect(nextDbxRotatingButtonState(config, 'b', [0, 2, 1])?.value).toBe('a');
  });

  it('should start at the first state for an unknown value with a rotation order', () => {
    expect(nextDbxRotatingButtonState(config, 'z', [1, 0, 2])?.value).toBe('a');
  });
});

describe('dbxRotatingButtonRotationOrder()', () => {
  const defaultConfig = {
    states: [{ value: 'default' }, { value: 'a' }, { value: 'b' }, { value: 'c' }],
    defaultState: { value: 'default', equivalentValue: 'a' }
  };

  function rotate(rotationConfig: typeof defaultConfig, start: string, clicks: number): string[] {
    const rotationOrder = dbxRotatingButtonRotationOrder(rotationConfig, start, true);
    const values: string[] = [];
    let value = start;

    for (let i = 0; i < clicks; i += 1) {
      value = nextDbxRotatingButtonState(rotationConfig, value, rotationOrder)?.value as string;
      values.push(value);
    }

    return values;
  }

  it('should skip the equivalent state from the default state and visit it last', () => {
    expect(dbxRotatingButtonRotationOrder(defaultConfig, 'default', true)).toEqual([0, 2, 3, 1]);
    expect(rotate(defaultConfig, 'default', 5)).toEqual(['b', 'c', 'a', 'default', 'b']);
  });

  it('should skip the default state from the equivalent state and visit it last', () => {
    const equivalentLastConfig = { ...defaultConfig, defaultState: { value: 'default', equivalentValue: 'c' } };
    expect(dbxRotatingButtonRotationOrder(equivalentLastConfig, 'c', true)).toEqual([3, 1, 2, 0]);
    expect(rotate(equivalentLastConfig, 'c', 5)).toEqual(['a', 'b', 'default', 'c', 'a']);
  });

  it('should not skip between states that are not the default or its equivalent', () => {
    expect(dbxRotatingButtonRotationOrder(defaultConfig, 'a', true)).toEqual([0, 1, 2, 3]);
    expect(dbxRotatingButtonRotationOrder(defaultConfig, 'c', true)).toEqual([0, 1, 2, 3]);
  });

  it('should not skip when not asked to', () => {
    expect(dbxRotatingButtonRotationOrder(defaultConfig, 'default')).toEqual([0, 1, 2, 3]);
  });

  it('should not skip without a default state', () => {
    expect(dbxRotatingButtonRotationOrder({ states: defaultConfig.states }, 'default', true)).toEqual([0, 1, 2, 3]);
  });

  it('should not skip when there are only two states', () => {
    const twoStateConfig = { states: [{ value: 'default' }, { value: 'a' }], defaultState: { value: 'default', equivalentValue: 'a' } };
    expect(dbxRotatingButtonRotationOrder(twoStateConfig, 'default', true)).toEqual([0, 1]);
  });

  it('should not skip from an unknown value', () => {
    expect(dbxRotatingButtonRotationOrder(defaultConfig, 'z', true)).toEqual([0, 1, 2, 3]);
  });
});

describe('dbxRotatingButtonAriaLabel()', () => {
  it('should join the label and state label', () => {
    expect(dbxRotatingButtonAriaLabel('Email', { value: true, label: 'On' })).toBe('Email: On');
  });

  it('should use whichever label is set', () => {
    expect(dbxRotatingButtonAriaLabel(undefined, { value: true, label: 'On' })).toBe('On');
    expect(dbxRotatingButtonAriaLabel('Email', { value: true })).toBe('Email');
    expect(dbxRotatingButtonAriaLabel(undefined, undefined)).toBeUndefined();
  });
});
