import {
  NotificationBoxRecipientFlag,
  NotificationDeliveryMethod,
  NotificationDeliveryMethodDecisionSource,
  firestoreNotificationUserDefaultNotificationBoxRecipientConfig,
  effectiveNotificationBoxRecipientTemplateConfigWithoutDeliveryMethods,
  hasNotificationDeliveryMethodOptIn,
  isNotificationDeliveryMethodDisabled,
  isNotificationDeliveryMethodEnabledByDefault,
  mergeEffectiveNotificationBoxRecipientTemplateConfigs,
  mergeNotificationBoxRecipientTemplateConfigRecords,
  mergeNotificationUserDefaultNotificationBoxRecipientConfig,
  readNotificationDeliveryMethodFlag,
  resolveNotificationDeliveryMethodDecisions,
  toCanonicalNotificationDeliveryMethods,
  type NotificationUserDefaultNotificationBoxRecipientConfig
} from './notification.config';

describe('readNotificationDeliveryMethodFlag()', () => {
  it('should read the flag for each delivery method', () => {
    const config = { se: true, st: false, sp: true, sn: false };

    expect(readNotificationDeliveryMethodFlag(config, NotificationDeliveryMethod.EMAIL)).toBe(true);
    expect(readNotificationDeliveryMethodFlag(config, NotificationDeliveryMethod.TEXT)).toBe(false);
    expect(readNotificationDeliveryMethodFlag(config, NotificationDeliveryMethod.PUSH)).toBe(true);
    expect(readNotificationDeliveryMethodFlag(config, NotificationDeliveryMethod.NOTIFICATION_SUMMARY)).toBe(false);
  });

  it('should not apply sd', () => {
    expect(readNotificationDeliveryMethodFlag({ sd: true }, NotificationDeliveryMethod.EMAIL)).toBeUndefined();
  });

  it('should return undefined for a null config', () => {
    expect(readNotificationDeliveryMethodFlag(undefined, NotificationDeliveryMethod.EMAIL)).toBeUndefined();
  });
});

describe('toCanonicalNotificationDeliveryMethods()', () => {
  it('should dedupe and sort the methods in the canonical order', () => {
    expect(toCanonicalNotificationDeliveryMethods([NotificationDeliveryMethod.NOTIFICATION_SUMMARY, NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.EMAIL, NotificationDeliveryMethod.TEXT])).toEqual([
      NotificationDeliveryMethod.EMAIL,
      NotificationDeliveryMethod.TEXT,
      NotificationDeliveryMethod.NOTIFICATION_SUMMARY
    ]);
  });

  it('should drop unknown values', () => {
    expect(toCanonicalNotificationDeliveryMethods(['x' as NotificationDeliveryMethod, NotificationDeliveryMethod.PUSH])).toEqual([NotificationDeliveryMethod.PUSH]);
  });

  it('should return an empty array for null', () => {
    expect(toCanonicalNotificationDeliveryMethods(null)).toEqual([]);
  });
});

describe('isNotificationDeliveryMethodEnabledByDefault()', () => {
  it('should enable email, push and summary by default', () => {
    expect(isNotificationDeliveryMethodEnabledByDefault(NotificationDeliveryMethod.EMAIL)).toBe(true);
    expect(isNotificationDeliveryMethodEnabledByDefault(NotificationDeliveryMethod.PUSH)).toBe(true);
    expect(isNotificationDeliveryMethodEnabledByDefault(NotificationDeliveryMethod.NOTIFICATION_SUMMARY)).toBe(true);
  });

  it('should disable text by default', () => {
    expect(isNotificationDeliveryMethodEnabledByDefault(NotificationDeliveryMethod.TEXT)).toBe(false);
    expect(isNotificationDeliveryMethodEnabledByDefault(NotificationDeliveryMethod.TEXT, { onlyTextExplicitlyEnabledRecipients: true })).toBe(false);
  });

  it('should enable text when onlyTextExplicitlyEnabledRecipients is false', () => {
    expect(isNotificationDeliveryMethodEnabledByDefault(NotificationDeliveryMethod.TEXT, { onlyTextExplicitlyEnabledRecipients: false })).toBe(true);
  });

  it('should disable email, push and summary when onlySendToExplicitlyEnabledRecipients is true', () => {
    const explicitOptIn = { onlySendToExplicitlyEnabledRecipients: true };

    expect(isNotificationDeliveryMethodEnabledByDefault(NotificationDeliveryMethod.EMAIL, explicitOptIn)).toBe(false);
    expect(isNotificationDeliveryMethodEnabledByDefault(NotificationDeliveryMethod.PUSH, explicitOptIn)).toBe(false);
    expect(isNotificationDeliveryMethodEnabledByDefault(NotificationDeliveryMethod.NOTIFICATION_SUMMARY, explicitOptIn)).toBe(false);
  });

  it('should not let onlySendToExplicitlyEnabledRecipients affect text', () => {
    expect(isNotificationDeliveryMethodEnabledByDefault(NotificationDeliveryMethod.TEXT, { onlySendToExplicitlyEnabledRecipients: true, onlyTextExplicitlyEnabledRecipients: false })).toBe(true);
  });
});

describe('mergeEffectiveNotificationBoxRecipientTemplateConfigs()', () => {
  it('should let a higher level sd beat a lower level channel', () => {
    const result = mergeEffectiveNotificationBoxRecipientTemplateConfigs([{ sd: false }, { se: true }]);

    expect(result.se).toBe(false);
    expect(result.st).toBe(false);
    expect(result.sp).toBe(false);
    expect(result.sn).toBe(false);
    expect(result.sd).toBe(false);
  });

  it('should let a higher level channel beat its own sd', () => {
    const result = mergeEffectiveNotificationBoxRecipientTemplateConfigs([{ sd: false, st: true }, { st: false }]);

    expect(result.st).toBe(true);
    expect(result.se).toBe(false);
  });

  it('should fill unset channels from lower levels', () => {
    const result = mergeEffectiveNotificationBoxRecipientTemplateConfigs([{ st: true }, undefined, { se: false }, { sd: true }]);

    expect(result.st).toBe(true);
    expect(result.se).toBe(false);
    expect(result.sp).toBe(true);
    expect(result.sn).toBe(true);
    expect(result.sd).toBe(true);
  });

  it('should return an empty config for no levels', () => {
    const result = mergeEffectiveNotificationBoxRecipientTemplateConfigs([]);
    expect(result).toEqual({});
  });
});

describe('effectiveNotificationBoxRecipientTemplateConfigWithoutDeliveryMethods()', () => {
  it('should return the config as-is when there are no methods', () => {
    const config = { sd: false };
    expect(effectiveNotificationBoxRecipientTemplateConfigWithoutDeliveryMethods(config, [])).toBe(config);
    expect(effectiveNotificationBoxRecipientTemplateConfigWithoutDeliveryMethods(config, undefined)).toBe(config);
  });

  it('should return null/undefined for a null/undefined config', () => {
    expect(effectiveNotificationBoxRecipientTemplateConfigWithoutDeliveryMethods(undefined, [NotificationDeliveryMethod.EMAIL])).toBeUndefined();
  });

  it('should unset sd and the given methods while sd still decides the other methods', () => {
    const result = effectiveNotificationBoxRecipientTemplateConfigWithoutDeliveryMethods({ sd: false }, [NotificationDeliveryMethod.EMAIL]);
    expect(result).toEqual({ st: false, sp: false, sn: false });
  });

  it('should unset the given methods even when set explicitly', () => {
    const result = effectiveNotificationBoxRecipientTemplateConfigWithoutDeliveryMethods({ se: false, st: true }, [NotificationDeliveryMethod.EMAIL]);
    expect(result?.se).toBeUndefined();
    expect(result?.st).toBe(true);
    expect(result?.sd).toBeUndefined();
  });

  it('should leave the given method to the lower levels when resolved', () => {
    const config = effectiveNotificationBoxRecipientTemplateConfigWithoutDeliveryMethods({ sd: false, se: false }, [NotificationDeliveryMethod.EMAIL]);
    const decisions = resolveNotificationDeliveryMethodDecisions({ configs: [config] });

    expect(decisions[NotificationDeliveryMethod.EMAIL]).toEqual({ send: true, source: NotificationDeliveryMethodDecisionSource.DEFAULT });
    expect(decisions[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send).toBe(false);
  });
});

describe('resolveNotificationDeliveryMethodDecisions()', () => {
  it('should use the default when no config sets the method', () => {
    const result = resolveNotificationDeliveryMethodDecisions({ configs: [undefined, {}] });

    expect(result[NotificationDeliveryMethod.EMAIL]).toEqual({ send: true, source: NotificationDeliveryMethodDecisionSource.DEFAULT });
    expect(result[NotificationDeliveryMethod.TEXT]).toEqual({ send: false, source: NotificationDeliveryMethodDecisionSource.DEFAULT });
    expect(result[NotificationDeliveryMethod.PUSH].send).toBe(true);
    expect(result[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send).toBe(true);
  });

  it('should use the explicit opt-in rules for the default', () => {
    const result = resolveNotificationDeliveryMethodDecisions({ configs: [], explicitOptIn: { onlySendToExplicitlyEnabledRecipients: true, onlyTextExplicitlyEnabledRecipients: false } });

    expect(result[NotificationDeliveryMethod.EMAIL].send).toBe(false);
    expect(result[NotificationDeliveryMethod.TEXT].send).toBe(true);
    expect(result[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send).toBe(false);
  });

  it('should use the first config level that sets the method', () => {
    const result = resolveNotificationDeliveryMethodDecisions({ configs: [{ st: true }, { se: false, st: false }, { sd: true }] });

    expect(result[NotificationDeliveryMethod.TEXT]).toEqual({ send: true, source: NotificationDeliveryMethodDecisionSource.CONFIG, configIndex: 0 });
    expect(result[NotificationDeliveryMethod.EMAIL]).toEqual({ send: false, source: NotificationDeliveryMethodDecisionSource.CONFIG, configIndex: 1 });
    expect(result[NotificationDeliveryMethod.PUSH]).toEqual({ send: true, source: NotificationDeliveryMethodDecisionSource.CONFIG, configIndex: 2 });
  });

  it('should make each level effective first', () => {
    const result = resolveNotificationDeliveryMethodDecisions({ configs: [{ sd: false }, { se: true }] });

    expect(result[NotificationDeliveryMethod.EMAIL]).toEqual({ send: false, source: NotificationDeliveryMethodDecisionSource.CONFIG, configIndex: 0 });
  });

  it('should keep sending email when a config only turns text off', () => {
    const result = resolveNotificationDeliveryMethodDecisions({ configs: [{ st: false }] });

    expect(result[NotificationDeliveryMethod.TEXT].send).toBe(false);
    expect(result[NotificationDeliveryMethod.EMAIL]).toEqual({ send: true, source: NotificationDeliveryMethodDecisionSource.DEFAULT });
    expect(result[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send).toBe(true);
  });

  it('should let the disabled methods beat the config and the default', () => {
    const result = resolveNotificationDeliveryMethodDecisions({ configs: [{ st: true, se: true }], disabledDeliveryMethods: [NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.NOTIFICATION_SUMMARY] });

    expect(result[NotificationDeliveryMethod.TEXT]).toEqual({ send: false, source: NotificationDeliveryMethodDecisionSource.DISABLED_METHOD });
    expect(result[NotificationDeliveryMethod.NOTIFICATION_SUMMARY]).toEqual({ send: false, source: NotificationDeliveryMethodDecisionSource.DISABLED_METHOD });
    expect(result[NotificationDeliveryMethod.EMAIL].send).toBe(true);
  });

  it('should let the disabled methods beat onlyTextExplicitlyEnabledRecipients false', () => {
    const result = resolveNotificationDeliveryMethodDecisions({ configs: [], disabledDeliveryMethods: [NotificationDeliveryMethod.TEXT], explicitOptIn: { onlyTextExplicitlyEnabledRecipients: false } });
    expect(result[NotificationDeliveryMethod.TEXT].source).toBe(NotificationDeliveryMethodDecisionSource.DISABLED_METHOD);
  });

  it('should turn every method off when suppressed', () => {
    const result = resolveNotificationDeliveryMethodDecisions({ configs: [{ sd: true }], suppressed: true });

    Object.values(result).forEach((x) => {
      expect(x).toEqual({ send: false, source: NotificationDeliveryMethodDecisionSource.SUPPRESSED });
    });
  });
});

describe('mergeNotificationBoxRecipientTemplateConfigRecords()', () => {
  it('should merge per type and per channel, preferring a', () => {
    const result = mergeNotificationBoxRecipientTemplateConfigRecords({ x: { se: true }, z: { sd: false } }, { x: { se: false, st: true }, y: { sn: false } });

    expect(result).toEqual({
      x: { se: true, st: true },
      y: { sn: false },
      z: { sd: false }
    });
  });

  it('should fill a null channel on a from b', () => {
    const result = mergeNotificationBoxRecipientTemplateConfigRecords({ x: { se: null } }, { x: { se: false } });
    expect(result['x'].se).toBe(false);
  });

  it('should handle null records', () => {
    expect(mergeNotificationBoxRecipientTemplateConfigRecords(undefined, { x: { se: true } })).toEqual({ x: { se: true } });
    expect(mergeNotificationBoxRecipientTemplateConfigRecords({ x: { se: true } }, null)).toEqual({ x: { se: true } });
  });
});

describe('mergeNotificationUserDefaultNotificationBoxRecipientConfig()', () => {
  it('should prefer the values from a', () => {
    const a: NotificationUserDefaultNotificationBoxRecipientConfig = { c: { x: { st: true } }, t: '+12085550001', f: NotificationBoxRecipientFlag.OPT_OUT };
    const b: NotificationUserDefaultNotificationBoxRecipientConfig = { c: { x: { st: false, se: false } }, t: '+12085550002', e: 'b@example.com', lk: true };

    const result = mergeNotificationUserDefaultNotificationBoxRecipientConfig(a, b);

    expect(result.t).toBe(a.t);
    expect(result.e).toBe(b.e);
    expect(result.f).toBe(NotificationBoxRecipientFlag.OPT_OUT);
    expect(result.lk).toBe(true);
    expect(result.c).toEqual({ x: { st: true, se: false } });
  });

  it('should fill null values on a from b', () => {
    const result = mergeNotificationUserDefaultNotificationBoxRecipientConfig({ c: {}, t: null }, { c: {}, t: '+12085550002' });
    expect(result.t).toBe('+12085550002');
  });

  it('should union the disabled delivery methods', () => {
    const result = mergeNotificationUserDefaultNotificationBoxRecipientConfig({ c: {}, dm: [NotificationDeliveryMethod.TEXT] }, { c: {}, dm: [NotificationDeliveryMethod.EMAIL, NotificationDeliveryMethod.TEXT] });
    expect(result.dm).toEqual([NotificationDeliveryMethod.EMAIL, NotificationDeliveryMethod.TEXT]);
  });

  it('should leave dm undefined when neither config has one', () => {
    const result = mergeNotificationUserDefaultNotificationBoxRecipientConfig({ c: {} }, { c: {} });
    expect(result.dm).toBeUndefined();
  });

  it('should prefer the tcat from a', () => {
    const aDate = new Date('2026-01-01T00:00:00Z');
    const bDate = new Date('2025-01-01T00:00:00Z');

    expect(mergeNotificationUserDefaultNotificationBoxRecipientConfig({ c: {}, tcat: aDate }, { c: {}, tcat: bDate }).tcat).toBe(aDate);
    expect(mergeNotificationUserDefaultNotificationBoxRecipientConfig({ c: {} }, { c: {}, tcat: bDate }).tcat).toBe(bDate);
  });
});

describe('isNotificationDeliveryMethodDisabled()', () => {
  it('should return true if the method is in dm', () => {
    expect(isNotificationDeliveryMethodDisabled({ dm: [NotificationDeliveryMethod.TEXT] }, NotificationDeliveryMethod.TEXT)).toBe(true);
  });

  it('should return false if the method is not in dm', () => {
    expect(isNotificationDeliveryMethodDisabled({ dm: [NotificationDeliveryMethod.TEXT] }, NotificationDeliveryMethod.EMAIL)).toBe(false);
    expect(isNotificationDeliveryMethodDisabled({}, NotificationDeliveryMethod.EMAIL)).toBe(false);
    expect(isNotificationDeliveryMethodDisabled(undefined, NotificationDeliveryMethod.EMAIL)).toBe(false);
  });
});

describe('hasNotificationDeliveryMethodOptIn()', () => {
  it('should return true if a type explicitly enables the method', () => {
    expect(hasNotificationDeliveryMethodOptIn({ c: { x: { st: false }, y: { st: true } } }, NotificationDeliveryMethod.TEXT)).toBe(true);
  });

  it('should return true if a type enables the method through sd', () => {
    expect(hasNotificationDeliveryMethodOptIn({ c: { x: { sd: true } } }, NotificationDeliveryMethod.TEXT)).toBe(true);
  });

  it('should return false if no type enables the method', () => {
    expect(hasNotificationDeliveryMethodOptIn({ c: { x: { st: false }, y: { se: true }, z: { sd: true, st: false } } }, NotificationDeliveryMethod.TEXT)).toBe(false);
    expect(hasNotificationDeliveryMethodOptIn({ c: {} }, NotificationDeliveryMethod.TEXT)).toBe(false);
    expect(hasNotificationDeliveryMethodOptIn(undefined, NotificationDeliveryMethod.TEXT)).toBe(false);
  });

  it('should return false if the method is disabled', () => {
    expect(hasNotificationDeliveryMethodOptIn({ c: { x: { st: true } }, dm: [NotificationDeliveryMethod.TEXT] }, NotificationDeliveryMethod.TEXT)).toBe(false);
  });
});

describe('firestoreNotificationUserDefaultNotificationBoxRecipientConfig', () => {
  it('should round-trip dm and tcat', () => {
    const tcat = new Date('2026-03-04T05:06:07Z');
    const config: NotificationUserDefaultNotificationBoxRecipientConfig = { c: { x: { st: true } }, dm: [NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.TEXT], tcat };

    const data = firestoreNotificationUserDefaultNotificationBoxRecipientConfig.mapFunctions.to(config);
    const restored = firestoreNotificationUserDefaultNotificationBoxRecipientConfig.mapFunctions.from(data);

    expect(restored.dm).toEqual([NotificationDeliveryMethod.TEXT]);
    expect(restored.tcat).toBeSameSecondAs(tcat);
    expect(restored.c['x'].st).toBe(true);
  });

  it('should store null for an empty dm and a null tcat', () => {
    const data = firestoreNotificationUserDefaultNotificationBoxRecipientConfig.mapFunctions.to({ c: {}, dm: [], tcat: null }) as Record<string, unknown>;

    expect(data['dm']).toBeNull();
    expect(data['tcat']).toBeNull();
  });
});
