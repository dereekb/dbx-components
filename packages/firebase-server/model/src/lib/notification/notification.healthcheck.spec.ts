import { KnownNotificationHealthCheckIssueCode, NotificationDeliveryMethod, NotificationHealthCheckStatus, type NotificationUser, type NotificationUserNotificationBoxRecipientConfig } from '@dereekb/firebase';
import { NOTIFICATION_HEALTH_CHECK_INTERNAL } from './notification.healthcheck';

const { notificationDeliveryMethodConfigIssues, collectDisabledMethodsForBoxRecipient } = NOTIFICATION_HEALTH_CHECK_INTERNAL;

const TEMPLATE_TYPE = 'test';

function notificationUser(overrides: Partial<Pick<NotificationUser, 'gc' | 'dc' | 'bc'>> = {}): NotificationUser {
  return { uid: 'u', x: [], b: [], bc: [], gc: { c: {} }, dc: { c: {} }, ...overrides };
}

function methodContext(method: NotificationDeliveryMethod, target: unknown = 'target', sendServiceConfigured = true) {
  return { method, label: method === NotificationDeliveryMethod.TEXT ? 'Text' : 'Email', sendServiceConfigured, target };
}

describe('notificationDeliveryMethodConfigIssues()', () => {
  describe('per-type opt-in', () => {
    it('should report nothing for email, which is on by default', () => {
      const issues = notificationDeliveryMethodConfigIssues({ methodContext: methodContext(NotificationDeliveryMethod.EMAIL), notificationUser: notificationUser(), notificationTemplateType: TEMPLATE_TYPE, explicitOptIn: undefined });
      expect(issues).toEqual([]);
    });

    it('should report that texts require opting in by default', () => {
      const issues = notificationDeliveryMethodConfigIssues({ methodContext: methodContext(NotificationDeliveryMethod.TEXT), notificationUser: notificationUser(), notificationTemplateType: TEMPLATE_TYPE, explicitOptIn: undefined });

      expect(issues).toHaveLength(1);
      expect(issues[0].c).toBe(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_TEMPLATE);
      expect(issues[0].s).toBe(NotificationHealthCheckStatus.WARNING);
      expect((issues[0].d as { requiresExplicitOptIn?: boolean }).requiresExplicitOptIn).toBe(true);
    });

    it('should report nothing for texts when the type sends texts by default', () => {
      const issues = notificationDeliveryMethodConfigIssues({ methodContext: methodContext(NotificationDeliveryMethod.TEXT), notificationUser: notificationUser(), notificationTemplateType: TEMPLATE_TYPE, explicitOptIn: { onlyTextExplicitlyEnabledRecipients: false } });
      expect(issues).toEqual([]);
    });

    it('should report that email requires opting in when the type only sends to explicitly enabled recipients', () => {
      const issues = notificationDeliveryMethodConfigIssues({ methodContext: methodContext(NotificationDeliveryMethod.EMAIL), notificationUser: notificationUser(), notificationTemplateType: TEMPLATE_TYPE, explicitOptIn: { onlySendToExplicitlyEnabledRecipients: true } });

      expect(issues).toHaveLength(1);
      expect(issues[0].c).toBe(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_TEMPLATE);
      expect((issues[0].d as { requiresExplicitOptIn?: boolean }).requiresExplicitOptIn).toBe(true);
    });

    it('should report nothing when the user opted in to texts on their global config', () => {
      const issues = notificationDeliveryMethodConfigIssues({
        methodContext: methodContext(NotificationDeliveryMethod.TEXT),
        notificationUser: notificationUser({ gc: { c: { [TEMPLATE_TYPE]: { st: true } } } }),
        notificationTemplateType: TEMPLATE_TYPE,
        explicitOptIn: undefined
      });

      expect(issues).toEqual([]);
    });

    it('should report nothing when the user opted in to email on their default config for an explicit opt-in type', () => {
      const issues = notificationDeliveryMethodConfigIssues({
        methodContext: methodContext(NotificationDeliveryMethod.EMAIL),
        notificationUser: notificationUser({ dc: { c: { [TEMPLATE_TYPE]: { se: true } } } }),
        notificationTemplateType: TEMPLATE_TYPE,
        explicitOptIn: { onlySendToExplicitlyEnabledRecipients: true }
      });

      expect(issues).toEqual([]);
    });
  });

  describe('configured off', () => {
    it('should report an error when the global config turns the method off', () => {
      const issues = notificationDeliveryMethodConfigIssues({
        methodContext: methodContext(NotificationDeliveryMethod.EMAIL),
        notificationUser: notificationUser({ gc: { c: { [TEMPLATE_TYPE]: { se: false } } } }),
        notificationTemplateType: TEMPLATE_TYPE,
        explicitOptIn: undefined
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].c).toBe(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_GLOBALLY);
      expect(issues[0].s).toBe(NotificationHealthCheckStatus.ERROR);
    });

    it('should report a warning when the default config turns the method off', () => {
      const issues = notificationDeliveryMethodConfigIssues({
        methodContext: methodContext(NotificationDeliveryMethod.EMAIL),
        notificationUser: notificationUser({ dc: { c: { [TEMPLATE_TYPE]: { se: false } } } }),
        notificationTemplateType: TEMPLATE_TYPE,
        explicitOptIn: undefined
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].c).toBe(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_FOR_TEMPLATE);
      expect(issues[0].s).toBe(NotificationHealthCheckStatus.WARNING);
    });
  });

  describe('disabled delivery methods', () => {
    it('should report the method switched off globally before the missing destination', () => {
      const issues = notificationDeliveryMethodConfigIssues({
        methodContext: methodContext(NotificationDeliveryMethod.TEXT, null),
        notificationUser: notificationUser({ gc: { c: { [TEMPLATE_TYPE]: { st: true } }, dm: [NotificationDeliveryMethod.TEXT] } }),
        notificationTemplateType: TEMPLATE_TYPE,
        explicitOptIn: undefined
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].c).toBe(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_GLOBALLY);
      expect(issues[0].s).toBe(NotificationHealthCheckStatus.ERROR);
      expect((issues[0].d as { disabledDeliveryMethod?: boolean }).disabledDeliveryMethod).toBe(true);
    });

    it('should report a warning when the default config disables the method', () => {
      const issues = notificationDeliveryMethodConfigIssues({
        methodContext: methodContext(NotificationDeliveryMethod.TEXT),
        notificationUser: notificationUser({ dc: { c: {}, dm: [NotificationDeliveryMethod.TEXT] } }),
        notificationTemplateType: TEMPLATE_TYPE,
        explicitOptIn: undefined
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].c).toBe(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_GLOBALLY);
      expect(issues[0].s).toBe(NotificationHealthCheckStatus.WARNING);
    });
  });

  describe('any template type', () => {
    const OTHER_TEMPLATE_TYPE = 'other';
    const anyTemplateTypes = [
      { notificationTemplateType: TEMPLATE_TYPE, explicitOptIn: undefined },
      { notificationTemplateType: OTHER_TEMPLATE_TYPE, explicitOptIn: undefined }
    ];

    function anyTemplateTypeIssues(method: NotificationDeliveryMethod, user: NotificationUser) {
      return notificationDeliveryMethodConfigIssues({ methodContext: methodContext(method), notificationUser: user, notificationTemplateType: 'D', explicitOptIn: undefined, anyTemplateTypes });
    }

    it('should report nothing when texts are on for one of the types', () => {
      expect(anyTemplateTypeIssues(NotificationDeliveryMethod.TEXT, notificationUser({ gc: { c: { [TEMPLATE_TYPE]: { st: false }, [OTHER_TEMPLATE_TYPE]: { st: true } } } }))).toEqual([]);
    });

    it('should report nothing when texts are on for one of the types in a subscription', () => {
      const user = notificationUser({ bc: [{ nb: 'box', i: 0, c: { [OTHER_TEMPLATE_TYPE]: { st: true } } }] });
      expect(anyTemplateTypeIssues(NotificationDeliveryMethod.TEXT, user)).toEqual([]);
    });

    it('should ignore a subscription the user removed', () => {
      const user = notificationUser({ bc: [{ nb: 'box', i: 0, rm: true, c: { [OTHER_TEMPLATE_TYPE]: { st: true } } }] });
      const issues = anyTemplateTypeIssues(NotificationDeliveryMethod.TEXT, user);

      expect(issues).toHaveLength(1);
      expect(issues[0].c).toBe(KnownNotificationHealthCheckIssueCode.METHOD_NOT_ENABLED_FOR_ANY_TEMPLATE);
    });

    it('should report a warning when no type sends texts', () => {
      const issues = anyTemplateTypeIssues(NotificationDeliveryMethod.TEXT, notificationUser({ gc: { c: { [TEMPLATE_TYPE]: { st: false } } } }));

      expect(issues).toHaveLength(1);
      expect(issues[0].c).toBe(KnownNotificationHealthCheckIssueCode.METHOD_NOT_ENABLED_FOR_ANY_TEMPLATE);
      expect(issues[0].s).toBe(NotificationHealthCheckStatus.WARNING);
    });

    it('should report nothing for email, which is on by default', () => {
      expect(anyTemplateTypeIssues(NotificationDeliveryMethod.EMAIL, notificationUser({ gc: { c: { [TEMPLATE_TYPE]: { se: false } } } }))).toEqual([]);
    });

    it('should still report the method switched off account-wide', () => {
      const issues = anyTemplateTypeIssues(NotificationDeliveryMethod.TEXT, notificationUser({ gc: { c: { [TEMPLATE_TYPE]: { st: true } }, dm: [NotificationDeliveryMethod.TEXT] } }));

      expect(issues).toHaveLength(1);
      expect(issues[0].c).toBe(KnownNotificationHealthCheckIssueCode.METHOD_DISABLED_GLOBALLY);
    });
  });

  it('should report a missing destination', () => {
    const issues = notificationDeliveryMethodConfigIssues({ methodContext: methodContext(NotificationDeliveryMethod.TEXT, null), notificationUser: notificationUser(), notificationTemplateType: TEMPLATE_TYPE, explicitOptIn: undefined });

    expect(issues).toHaveLength(1);
    expect(issues[0].c).toBe(KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET);
  });

  it('should only report the send service when it is not configured', () => {
    const issues = notificationDeliveryMethodConfigIssues({ methodContext: methodContext(NotificationDeliveryMethod.TEXT, null, false), notificationUser: notificationUser(), notificationTemplateType: TEMPLATE_TYPE, explicitOptIn: undefined });

    expect(issues).toHaveLength(1);
    expect(issues[0].c).toBe(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_NOT_CONFIGURED);
    expect(issues[0].s).toBe(NotificationHealthCheckStatus.SKIPPED);
  });
});

describe('collectDisabledMethodsForBoxRecipient()', () => {
  function boxConfig(c: NotificationUserNotificationBoxRecipientConfig['c'], overrides: Partial<NotificationUserNotificationBoxRecipientConfig> = {}): NotificationUserNotificationBoxRecipientConfig {
    return { nb: 'box', i: 0, c, ...overrides };
  }

  it('should report a method the box entry turns off', () => {
    const methods = collectDisabledMethodsForBoxRecipient({ boxRecipient: undefined, config: boxConfig({ [TEMPLATE_TYPE]: { st: false } }), gc: { c: {} }, notificationTemplateType: TEMPLATE_TYPE, explicitOptIn: { onlyTextExplicitlyEnabledRecipients: false } });
    expect(methods).toEqual([NotificationDeliveryMethod.TEXT]);
  });

  it('should not report a method the global config overrides', () => {
    const methods = collectDisabledMethodsForBoxRecipient({ boxRecipient: undefined, config: boxConfig({ [TEMPLATE_TYPE]: { st: false } }), gc: { c: { [TEMPLATE_TYPE]: { st: true } } }, notificationTemplateType: TEMPLATE_TYPE, explicitOptIn: undefined });
    expect(methods).toEqual([]);
  });

  it('should not report a method that is only off by default', () => {
    const methods = collectDisabledMethodsForBoxRecipient({ boxRecipient: undefined, config: boxConfig({}), gc: { c: {} }, notificationTemplateType: TEMPLATE_TYPE, explicitOptIn: undefined });
    expect(methods).toEqual([]);
  });

  it('should report nothing for a flagged recipient', () => {
    const methods = collectDisabledMethodsForBoxRecipient({ boxRecipient: undefined, config: boxConfig({ [TEMPLATE_TYPE]: { se: false } }, { x: true }), gc: { c: {} }, notificationTemplateType: TEMPLATE_TYPE, explicitOptIn: undefined });
    expect(methods).toEqual([]);
  });
});
