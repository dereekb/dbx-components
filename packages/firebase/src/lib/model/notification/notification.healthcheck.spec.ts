import {
  type NotificationDeliveryHealthCheckResult,
  NotificationDeliveryMethod,
  type NotificationHealthCheck,
  type NotificationHealthCheckIssue,
  NotificationHealthCheckStatus,
  KnownNotificationHealthCheckIssueCode,
  allNotificationHealthCheckIssues,
  firestoreNotificationHealthCheck,
  isPendingNotificationHealthCheckProbe,
  isProblemNotificationHealthCheckStatus,
  notificationDeliveryHealthCheckResultForMethod,
  notificationHealthCheckIssue,
  rollupNotificationDeliveryHealthCheckResultStatus,
  rollupNotificationHealthCheckResultStatus,
  rollupNotificationHealthCheckStatus
} from './notification.healthcheck';

describe('rollupNotificationHealthCheckStatus()', () => {
  it('should return SKIPPED for an empty set of statuses', () => {
    expect(rollupNotificationHealthCheckStatus([])).toBe(NotificationHealthCheckStatus.SKIPPED);
  });

  it('should return the most severe status', () => {
    expect(rollupNotificationHealthCheckStatus([NotificationHealthCheckStatus.OK, NotificationHealthCheckStatus.ERROR, NotificationHealthCheckStatus.WARNING])).toBe(NotificationHealthCheckStatus.ERROR);
  });

  it('should prefer a warning over a pending probe', () => {
    expect(rollupNotificationHealthCheckStatus([NotificationHealthCheckStatus.PENDING, NotificationHealthCheckStatus.WARNING])).toBe(NotificationHealthCheckStatus.WARNING);
  });

  it('should not let a skipped method mask a healthy one', () => {
    expect(rollupNotificationHealthCheckStatus([NotificationHealthCheckStatus.SKIPPED, NotificationHealthCheckStatus.OK])).toBe(NotificationHealthCheckStatus.OK);
  });

  it('should return OK when everything is OK', () => {
    expect(rollupNotificationHealthCheckStatus([NotificationHealthCheckStatus.OK, NotificationHealthCheckStatus.OK])).toBe(NotificationHealthCheckStatus.OK);
  });
});

describe('isProblemNotificationHealthCheckStatus()', () => {
  it('should be true for errors and warnings', () => {
    expect(isProblemNotificationHealthCheckStatus(NotificationHealthCheckStatus.ERROR)).toBe(true);
    expect(isProblemNotificationHealthCheckStatus(NotificationHealthCheckStatus.WARNING)).toBe(true);
  });

  it('should be false for statuses that do not require action', () => {
    expect(isProblemNotificationHealthCheckStatus(NotificationHealthCheckStatus.OK)).toBe(false);
    expect(isProblemNotificationHealthCheckStatus(NotificationHealthCheckStatus.PENDING)).toBe(false);
    expect(isProblemNotificationHealthCheckStatus(NotificationHealthCheckStatus.SKIPPED)).toBe(false);
    expect(isProblemNotificationHealthCheckStatus(NotificationHealthCheckStatus.UNKNOWN)).toBe(false);
  });
});

describe('notificationHealthCheckIssue()', () => {
  it('should create an issue with the input code, status and message', () => {
    const issue = notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET, NotificationHealthCheckStatus.ERROR, { message: 'no address' });

    expect(issue.c).toBe(KnownNotificationHealthCheckIssueCode.NO_DELIVERY_TARGET);
    expect(issue.s).toBe(NotificationHealthCheckStatus.ERROR);
    expect(issue.m).toBe('no address');
    expect(issue.f).toBeUndefined();
    expect(issue.d).toBeUndefined();
  });

  it('should attach the fix and detail when provided', () => {
    const issue = notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.RECIPIENT_OPTED_OUT, NotificationHealthCheckStatus.ERROR, { message: 'opted out', fix: 'turn it on', data: { scope: 'global' } });

    expect(issue.f).toBe('turn it on');
    expect(issue.d).toEqual({ scope: 'global' });
  });
});

describe('rollupNotificationDeliveryHealthCheckResultStatus()', () => {
  it('should roll up the issue statuses', () => {
    const is: NotificationHealthCheckIssue[] = [
      //
      notificationHealthCheckIssue('a', NotificationHealthCheckStatus.OK, { message: 'ok' }),
      notificationHealthCheckIssue('b', NotificationHealthCheckStatus.WARNING, { message: 'warn' })
    ];

    expect(rollupNotificationDeliveryHealthCheckResultStatus({ is })).toBe(NotificationHealthCheckStatus.WARNING);
  });

  it('should include the probe status in the rollup', () => {
    const result = rollupNotificationDeliveryHealthCheckResultStatus({
      is: [notificationHealthCheckIssue('a', NotificationHealthCheckStatus.OK, { message: 'ok' })],
      pr: { id: 'x', at: new Date(), s: NotificationHealthCheckStatus.PENDING, tg: 'a@b.com' }
    });

    expect(result).toBe(NotificationHealthCheckStatus.PENDING);
  });

  it('should return SKIPPED when there are no issues and no probe', () => {
    expect(rollupNotificationDeliveryHealthCheckResultStatus({ is: [] })).toBe(NotificationHealthCheckStatus.SKIPPED);
  });
});

describe('isPendingNotificationHealthCheckProbe()', () => {
  it('should be true only for a pending probe', () => {
    expect(isPendingNotificationHealthCheckProbe({ id: 'x', at: new Date(), s: NotificationHealthCheckStatus.PENDING, tg: 'a@b.com' })).toBe(true);
    expect(isPendingNotificationHealthCheckProbe({ id: 'x', at: new Date(), s: NotificationHealthCheckStatus.OK, tg: 'a@b.com' })).toBe(false);
    expect(isPendingNotificationHealthCheckProbe(undefined)).toBe(false);
  });
});

function makeTestHealthCheck(): NotificationHealthCheck {
  const emailResult: NotificationDeliveryHealthCheckResult = {
    me: NotificationDeliveryMethod.EMAIL,
    s: NotificationHealthCheckStatus.ERROR,
    tg: 'user@example.com',
    is: [notificationHealthCheckIssue('mailgunSuppressedBounce', NotificationHealthCheckStatus.ERROR, { message: 'bounced', fix: 'contact support', data: { code: 550 } })],
    pr: { id: 'probe-1', at: new Date('2026-01-01T00:00:00.000Z'), s: NotificationHealthCheckStatus.PENDING, tg: 'user@example.com', d: 'sent' }
  };

  const textResult: NotificationDeliveryHealthCheckResult = {
    me: NotificationDeliveryMethod.TEXT,
    s: NotificationHealthCheckStatus.SKIPPED,
    is: [notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_NOT_CONFIGURED, NotificationHealthCheckStatus.SKIPPED, { message: 'not enabled' })]
  };

  return {
    at: new Date('2026-01-02T00:00:00.000Z'),
    s: NotificationHealthCheckStatus.ERROR,
    t: 'D',
    is: [notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.NEEDS_CONFIG_SYNC, NotificationHealthCheckStatus.WARNING, { message: 'still syncing' })],
    m: [emailResult, textResult]
  };
}

describe('rollupNotificationHealthCheckResultStatus()', () => {
  it('should roll up account-wide issues together with the per-method statuses', () => {
    const healthCheck = makeTestHealthCheck();
    expect(rollupNotificationHealthCheckResultStatus(healthCheck)).toBe(NotificationHealthCheckStatus.ERROR);
  });

  it('should surface an account-wide issue even when every method is healthy', () => {
    const result = rollupNotificationHealthCheckResultStatus({
      is: [notificationHealthCheckIssue(KnownNotificationHealthCheckIssueCode.RECIPIENT_OPTED_OUT, NotificationHealthCheckStatus.ERROR, { message: 'opted out' })],
      m: [{ me: NotificationDeliveryMethod.EMAIL, s: NotificationHealthCheckStatus.OK, is: [] }]
    });

    expect(result).toBe(NotificationHealthCheckStatus.ERROR);
  });
});

describe('notificationDeliveryHealthCheckResultForMethod()', () => {
  it('should find the result for the requested method', () => {
    const healthCheck = makeTestHealthCheck();
    expect(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.EMAIL)?.tg).toBe('user@example.com');
  });

  it('should return undefined for a method that was not checked', () => {
    const healthCheck = makeTestHealthCheck();
    expect(notificationDeliveryHealthCheckResultForMethod(healthCheck, NotificationDeliveryMethod.PUSH)).toBeUndefined();
  });

  it('should return undefined for a missing health check', () => {
    expect(notificationDeliveryHealthCheckResultForMethod(undefined, NotificationDeliveryMethod.EMAIL)).toBeUndefined();
  });
});

describe('allNotificationHealthCheckIssues()', () => {
  it('should return the account-wide issues before the per-method issues', () => {
    const issues = allNotificationHealthCheckIssues(makeTestHealthCheck());

    expect(issues.length).toBe(3);
    expect(issues[0].c).toBe(KnownNotificationHealthCheckIssueCode.NEEDS_CONFIG_SYNC);
    expect(issues[1].c).toBe('mailgunSuppressedBounce');
    expect(issues[2].c).toBe(KnownNotificationHealthCheckIssueCode.SEND_SERVICE_NOT_CONFIGURED);
  });

  it('should return an empty array for a missing health check', () => {
    expect(allNotificationHealthCheckIssues(undefined)).toEqual([]);
  });
});

describe('firestoreNotificationHealthCheck', () => {
  it('should round-trip a health check through Firestore data', () => {
    const healthCheck = makeTestHealthCheck();

    const data = firestoreNotificationHealthCheck.mapFunctions.to(healthCheck);
    const restored = firestoreNotificationHealthCheck.mapFunctions.from(data);

    expect(restored.at).toBeSameSecondAs(healthCheck.at);
    expect(restored.s).toBe(healthCheck.s);
    expect(restored.t).toBe(healthCheck.t);
    expect(restored.is.length).toBe(1);
    expect(restored.is[0].c).toBe(KnownNotificationHealthCheckIssueCode.NEEDS_CONFIG_SYNC);
    expect(restored.m.length).toBe(2);

    const email = restored.m[0];
    expect(email.me).toBe(NotificationDeliveryMethod.EMAIL);
    expect(email.tg).toBe('user@example.com');
    expect(email.is[0].d).toEqual({ code: 550 });
    expect(email.is[0].f).toBe('contact support');
    expect(email.pr?.id).toBe('probe-1');
    expect(email.pr?.s).toBe(NotificationHealthCheckStatus.PENDING);
    expect(email.pr?.at).toBeSameSecondAs(healthCheck.m[0].pr?.at as Date);
  });

  it('should round-trip a method result that has no probe or target', () => {
    const healthCheck = makeTestHealthCheck();

    const data = firestoreNotificationHealthCheck.mapFunctions.to(healthCheck);
    const restored = firestoreNotificationHealthCheck.mapFunctions.from(data);

    const text = restored.m[1];
    expect(text.me).toBe(NotificationDeliveryMethod.TEXT);
    expect(text.tg).toBeUndefined();
    expect(text.pr).toBeUndefined();
    expect(text.is.length).toBe(1);
  });
});
