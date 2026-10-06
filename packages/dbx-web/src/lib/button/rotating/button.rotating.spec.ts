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

  describe('skipping equivalent states', () => {
    const equivalentConfig = {
      states: [
        { value: 'a', equivalentValue: 1 },
        { value: 'b', equivalentValue: 1 },
        { value: 'c', equivalentValue: 2 }
      ]
    };

    it('should skip states equivalent to the current state', () => {
      expect(nextDbxRotatingButtonState(equivalentConfig, 'a', true)?.value).toBe('c');
    });

    it('should not skip when not asked to', () => {
      expect(nextDbxRotatingButtonState(equivalentConfig, 'a')?.value).toBe('b');
    });

    it('should compare against the state value when no equivalent value is set', () => {
      const mixedConfig = { states: [{ value: 1 }, { value: 2, equivalentValue: 1 }, { value: 3 }] };
      expect(nextDbxRotatingButtonState(mixedConfig, 1, true)?.value).toBe(3);
    });

    it('should return the next state when every other state is equivalent', () => {
      const allEquivalentConfig = {
        states: [
          { value: 'a', equivalentValue: 1 },
          { value: 'b', equivalentValue: 1 }
        ]
      };
      expect(nextDbxRotatingButtonState(allEquivalentConfig, 'a', true)?.value).toBe('b');
    });

    it('should not skip from an unknown value', () => {
      expect(nextDbxRotatingButtonState(equivalentConfig, 'z', true)?.value).toBe('a');
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
