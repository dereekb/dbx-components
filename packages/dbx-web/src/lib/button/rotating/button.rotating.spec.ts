import { describe, expect, it } from 'vitest';
import { dbxRotatingButtonAriaLabel, dbxRotatingButtonStateIndex, isEqualDbxRotatingButtonValue, nextDbxRotatingButtonState } from './button.rotating';

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

  describe('skipping the default equivalent state', () => {
    const defaultConfig = {
      states: [{ value: 'default' }, { value: 'a' }, { value: 'b' }, { value: 'c' }],
      defaultState: { value: 'default', equivalentValue: 'a' }
    };

    it('should skip the equivalent state from the default state', () => {
      expect(nextDbxRotatingButtonState(defaultConfig, 'default', true)?.value).toBe('b');
    });

    it('should skip the default state from the equivalent state', () => {
      const equivalentLastConfig = { ...defaultConfig, defaultState: { value: 'default', equivalentValue: 'c' } };
      expect(nextDbxRotatingButtonState(equivalentLastConfig, 'c', true)?.value).toBe('a');
    });

    it('should not skip between states that are not the default or its equivalent', () => {
      expect(nextDbxRotatingButtonState(defaultConfig, 'a', true)?.value).toBe('b');
      expect(nextDbxRotatingButtonState(defaultConfig, 'c', true)?.value).toBe('default');
    });

    it('should not skip when not asked to', () => {
      expect(nextDbxRotatingButtonState(defaultConfig, 'default')?.value).toBe('a');
    });

    it('should not skip without a default state', () => {
      expect(nextDbxRotatingButtonState({ states: defaultConfig.states }, 'default', true)?.value).toBe('a');
    });

    it('should return the next state when there are only two states', () => {
      const twoStateConfig = { states: [{ value: 'default' }, { value: 'a' }], defaultState: { value: 'default', equivalentValue: 'a' } };
      expect(nextDbxRotatingButtonState(twoStateConfig, 'default', true)?.value).toBe('a');
    });

    it('should not skip from an unknown value', () => {
      expect(nextDbxRotatingButtonState(defaultConfig, 'z', true)?.value).toBe('default');
    });
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
