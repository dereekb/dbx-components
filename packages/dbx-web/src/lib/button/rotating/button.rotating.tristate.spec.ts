import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DBX_TRISTATE_OFF_COLOR,
  DEFAULT_DBX_TRISTATE_OFF_ICON,
  DEFAULT_DBX_TRISTATE_ON_COLOR,
  DEFAULT_DBX_TRISTATE_ON_ICON,
  DEFAULT_DBX_TRISTATE_UNKNOWN_DEFAULT_ICON,
  DBX_TRISTATE_CYCLE,
  dbxTristateEffectiveValue,
  dbxTristateRotatingButtonConfig,
  dbxTristateState,
  dbxTristateStateLabel
} from './button.rotating.tristate';
import { dbxRotatingButtonRotationOrder, nextDbxRotatingButtonState } from './button.rotating';

describe('dbxTristateState()', () => {
  it('should map true to on, false to off, and null/undefined to default', () => {
    expect(dbxTristateState(true)).toBe('on');
    expect(dbxTristateState(false)).toBe('off');
    expect(dbxTristateState(null)).toBe('default');
    expect(dbxTristateState(undefined)).toBe('default');
  });
});

describe('dbxTristateEffectiveValue()', () => {
  it('should prefer the explicit value over the default', () => {
    expect(dbxTristateEffectiveValue(false, true)).toBe(false);
    expect(dbxTristateEffectiveValue(null, true)).toBe(true);
  });
});

describe('DBX_TRISTATE_CYCLE', () => {
  it('should go default, then on, then off', () => {
    expect(DBX_TRISTATE_CYCLE).toEqual([null, true, false]);
  });
});

describe('dbxTristateStateLabel()', () => {
  it('should label explicit values On and Off', () => {
    expect(dbxTristateStateLabel({ value: true })).toBe('On');
    expect(dbxTristateStateLabel({ value: false })).toBe('Off');
  });

  it('should include the resolved default in the default label', () => {
    expect(dbxTristateStateLabel({ value: null, defaultValue: false })).toBe('Default (Off)');
    expect(dbxTristateStateLabel({ value: undefined, defaultValue: true })).toBe('Default (On)');
    expect(dbxTristateStateLabel({ value: null })).toBe('Default');
  });

  it('should use the configured state labels', () => {
    expect(dbxTristateStateLabel({ value: null, defaultValue: false, off: { label: 'Disabled' }, default: { label: 'Inherit' } })).toBe('Inherit (Disabled)');
  });
});

describe('dbxTristateRotatingButtonConfig()', () => {
  describe('default off', () => {
    const config = dbxTristateRotatingButtonConfig({ label: 'Text', defaultValue: false });

    it('should order the states Default -> On -> Off', () => {
      expect(config.states.map((x) => x.value)).toEqual([null, true, false]);
    });

    it('should rotate Default -> On -> Off -> Default', () => {
      expect(nextDbxRotatingButtonState(config, undefined)?.value).toBe(true);
      expect(nextDbxRotatingButtonState(config, true)?.value).toBe(false);
      expect(nextDbxRotatingButtonState(config, false)?.value).toBeNull();
    });

    it('should show the resolved off icon without a color for the default state', () => {
      const defaultState = config.states[0];
      expect(defaultState.label).toBe('Default (Off)');
      expect(defaultState.display?.icon).toBe(DEFAULT_DBX_TRISTATE_OFF_ICON);
      expect(defaultState.style?.color).toBeUndefined();
    });

    it('should color the explicit states', () => {
      expect(config.states[1].display?.icon).toBe(DEFAULT_DBX_TRISTATE_ON_ICON);
      expect(config.states[1].style?.color).toBe(DEFAULT_DBX_TRISTATE_ON_COLOR);
      expect(config.states[2].style?.color).toBe(DEFAULT_DBX_TRISTATE_OFF_COLOR);
    });

    it('should carry the label', () => {
      expect(config.label).toBe('Text');
    });
  });

  it('should use the configured icons and colors', () => {
    const config = dbxTristateRotatingButtonConfig({ defaultValue: true, on: { icon: 'notifications_active', color: 'success' }, off: { icon: 'notifications_off' }, default: { color: 'grey' } });
    const [defaultState, onState, offState] = config.states;

    expect(defaultState.display?.icon).toBe('notifications_active');
    expect(defaultState.style?.color).toBe('grey');
    expect(offState.display?.icon).toBe('notifications_off');
    expect(onState.style?.color).toBe('success');
  });

  describe('first click', () => {
    const config = dbxTristateRotatingButtonConfig({ label: 'Email', defaultValue: true });

    it('should set the default state to the value it resolves to', () => {
      expect(config.defaultState).toEqual({ value: null, equivalentValue: true });
      expect(config.skipDefaultEquivalentOnFirstClick).toBe(true);
    });

    it('should skip On from a default that resolves to on and visit it last', () => {
      const rotationOrder = dbxRotatingButtonRotationOrder(config, null, true);
      expect(nextDbxRotatingButtonState(config, null, rotationOrder)?.value).toBe(false);
      expect(nextDbxRotatingButtonState(config, false, rotationOrder)?.value).toBe(true);
      expect(nextDbxRotatingButtonState(config, true, rotationOrder)?.value).toBeNull();
    });

    it('should skip Default from Off when the default resolves to off and visit it last', () => {
      const offDefaultConfig = dbxTristateRotatingButtonConfig({ defaultValue: false });
      const rotationOrder = dbxRotatingButtonRotationOrder(offDefaultConfig, false, true);
      expect(nextDbxRotatingButtonState(offDefaultConfig, false, rotationOrder)?.value).toBe(true);
      expect(nextDbxRotatingButtonState(offDefaultConfig, true, rotationOrder)?.value).toBeNull();
      expect(nextDbxRotatingButtonState(offDefaultConfig, null, rotationOrder)?.value).toBe(false);
    });

    it('should not skip Default from Off when the default resolves to on', () => {
      expect(dbxRotatingButtonRotationOrder(config, false, true)).toEqual([0, 1, 2]);
    });

    it('should not skip when turned off', () => {
      const noSkipConfig = dbxTristateRotatingButtonConfig({ defaultValue: true, skipDefaultEquivalentOnFirstClick: false });
      expect(noSkipConfig.skipDefaultEquivalentOnFirstClick).toBe(false);
    });

    it('should have no default state when the default is unknown', () => {
      const unknownConfig = dbxTristateRotatingButtonConfig({});
      expect(unknownConfig.defaultState).toBeUndefined();
      expect(dbxRotatingButtonRotationOrder(unknownConfig, null, true)).toEqual([0, 1, 2]);
    });
  });

  it('should use a neutral icon when the default is unknown', () => {
    const config = dbxTristateRotatingButtonConfig({});
    expect(config.states[0].display?.icon).toBe(DEFAULT_DBX_TRISTATE_UNKNOWN_DEFAULT_ICON);
    expect(config.states[0].label).toBe('Default');
  });
});
