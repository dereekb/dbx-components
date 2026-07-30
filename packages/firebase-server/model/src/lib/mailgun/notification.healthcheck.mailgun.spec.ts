import { type EmailAddress, type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId, type NotificationHealthCheckIssue, type NotificationHealthCheckIssueCode, type NotificationHealthCheckProbe, isPendingNotificationHealthCheckProbe, KnownNotificationHealthCheckIssueCode, MailgunNotificationHealthCheckIssueCode, NotificationDeliveryMethod, NotificationHealthCheckStatus } from '@dereekb/firebase';
import { type MailgunBounceSuppression, type MailgunComplaintSuppression, type MailgunDomainEvent, type MailgunEmailValidationResult, type MailgunService, type MailgunTemplateEmailRequest, type MailgunUnsubscribeSuppression, MailgunEventName, MailgunEventSeverity } from '@dereekb/nestjs/mailgun';
import { type NotificationSendServiceHealthCheckRequest, type NotificationSendServiceHealthCheckResponse } from '../notification/notification.healthcheck.service';
import { type MailgunNotificationEmailSendServiceHealthCheckServiceConfig, type MailgunNotificationHealthCheckProbeBuilder, mailgunNotificationEmailSendServiceHealthCheckService } from './notification.healthcheck.mailgun';

// This service only ever touches mailgunService.mailgunApi and mailgunService.sendTemplateEmail, so its
// classification logic is exercised here with a hand-rolled stub and no Mailgun key. The paths that need
// real documents (the orchestration around this service) are covered in
// demo-api/.../notificationuser.healthcheck.spec.ts instead.

const TEST_DOMAIN = 'mail.example.com';
const TEST_TARGET: EmailAddress = 'user@example.com';
const TEST_UID: FirebaseAuthUserId = 'testuid';
const TEST_NOW = new Date('2026-01-01T00:00:00.000Z');

const MINUTE_MS = 60 * 1000;

// MARK: Mock
interface MockMailgunServiceConfig {
  /**
   * The domains.get() payload. Defaults to an active domain.
   */
  readonly domainResult?: Maybe<{ state?: string; is_disabled?: boolean }>;
  /**
   * Whether domains.get() rejects.
   */
  readonly domainError?: boolean;
  readonly bounce?: Maybe<MailgunBounceSuppression>;
  readonly complaint?: Maybe<MailgunComplaintSuppression>;
  readonly unsubscribe?: Maybe<MailgunUnsubscribeSuppression>;
  /**
   * Whether every suppressions.get() rejects, as it does when the lookup itself is unavailable.
   */
  readonly suppressionsError?: boolean;
  /**
   * Events returned for a recipient query. Mailgun queries with `ascending: 'no'`, so these are newest-first.
   */
  readonly recentEvents?: MailgunDomainEvent[];
  /**
   * Events returned for a `message-id` query — the probe correlation lookup.
   */
  readonly probeEvents?: MailgunDomainEvent[];
  readonly validation?: Maybe<Partial<MailgunEmailValidationResult>>;
  readonly sendResult?: Maybe<{ id?: string; status?: number; message?: string }>;
  readonly sendError?: boolean;
}

interface MockMailgunServiceCaptures {
  readonly eventQueries: Record<string, any>[];
  readonly validatedAddresses: string[];
  readonly sentRequests: MailgunTemplateEmailRequest[];
}

interface MockMailgunService {
  readonly mailgunService: MailgunService;
  readonly captures: MockMailgunServiceCaptures;
}

function createMockMailgunService(config: MockMailgunServiceConfig = {}): MockMailgunService {
  const { domainResult, domainError, bounce, complaint, unsubscribe, suppressionsError, recentEvents, probeEvents, validation, sendResult, sendError } = config;

  const captures: MockMailgunServiceCaptures = { eventQueries: [], validatedAddresses: [], sentRequests: [] };
  const suppressionRecords: Record<string, unknown> = { bounces: bounce, complaints: complaint, unsubscribes: unsubscribe };

  const mailgunService = {
    mailgunApi: {
      domain: TEST_DOMAIN,
      clientUrl: 'https://example.com',
      domains: {
        get: () => (domainError ? Promise.reject(new Error('domains unavailable')) : Promise.resolve(domainResult ?? { state: 'active' }))
      },
      suppressions: {
        // the real api responds 404 when the address is not on the requested list
        get: (_domain: string, list: string) => {
          const record = suppressionsError ? undefined : suppressionRecords[list];
          return record ? Promise.resolve(record) : Promise.reject(new Error('not found'));
        }
      },
      events: {
        get: (_domain: string, query: Record<string, any>) => {
          captures.eventQueries.push(query);
          const items = query['message-id'] == null ? recentEvents : probeEvents;
          return Promise.resolve({ items: items ?? [] });
        }
      },
      validate: {
        get: (address: string) => {
          captures.validatedAddresses.push(address);
          return Promise.resolve(validation);
        }
      }
    },
    sendTemplateEmail: (request: MailgunTemplateEmailRequest) => {
      captures.sentRequests.push(request);
      return sendError ? Promise.reject(new Error('mailgun refused the send')) : Promise.resolve(sendResult ?? { id: '<20260101120000.1.abc@mail.example.com>', status: 200, message: 'Queued' });
    }
  } as unknown as MailgunService;

  return { mailgunService, captures };
}

function makeTestEvent(config: Partial<MailgunDomainEvent>): MailgunDomainEvent {
  return {
    event: MailgunEventName.DELIVERED,
    timestamp: 1767225600, // 2026-01-01T00:00:00Z
    recipient: TEST_TARGET,
    ...config
  } as MailgunDomainEvent;
}

const testProbeBuilder: MailgunNotificationHealthCheckProbeBuilder = ({ recipient }) => ({ to: recipient, template: 'notificationtemplate', subject: 'Email delivery test' });

function makePendingProbe(config: Partial<NotificationHealthCheckProbe> = {}): NotificationHealthCheckProbe {
  return { id: '20260101120000.1.abc@mail.example.com', at: TEST_NOW, s: NotificationHealthCheckStatus.PENDING, tg: TEST_TARGET, ...config };
}

// MARK: Runner
interface RunHealthCheckInput {
  readonly mock?: MockMailgunServiceConfig;
  readonly service?: Omit<Partial<MailgunNotificationEmailSendServiceHealthCheckServiceConfig>, 'mailgunService'>;
  readonly request?: Partial<NotificationSendServiceHealthCheckRequest<EmailAddress>>;
}

interface RunHealthCheckResult {
  readonly response: NotificationSendServiceHealthCheckResponse;
  readonly captures: MockMailgunServiceCaptures;
}

async function runHealthCheck(input: RunHealthCheckInput = {}): Promise<RunHealthCheckResult> {
  const { mailgunService, captures } = createMockMailgunService(input.mock);
  const healthCheckService = mailgunNotificationEmailSendServiceHealthCheckService({ mailgunService, ...input.service });

  const response = await healthCheckService.runHealthCheck({
    method: NotificationDeliveryMethod.EMAIL,
    target: TEST_TARGET,
    uid: TEST_UID,
    sendProbe: false,
    now: TEST_NOW,
    ...input.request
  });

  return { response, captures };
}

function issueForCode(response: NotificationSendServiceHealthCheckResponse, code: NotificationHealthCheckIssueCode): Maybe<NotificationHealthCheckIssue> {
  return response.issues.find((x) => x.c === code);
}

function issueCodes(response: NotificationSendServiceHealthCheckResponse): NotificationHealthCheckIssueCode[] {
  return response.issues.map((x) => x.c);
}

describe('mailgunNotificationEmailSendServiceHealthCheckService()', () => {
  describe('supportsProbe', () => {
    it('should be true when a probe builder is configured', () => {
      const { mailgunService } = createMockMailgunService();
      expect(mailgunNotificationEmailSendServiceHealthCheckService({ mailgunService, probeBuilder: testProbeBuilder }).supportsProbe).toBe(true);
    });

    it('should be false when no probe builder is configured', () => {
      const { mailgunService } = createMockMailgunService();
      expect(mailgunNotificationEmailSendServiceHealthCheckService({ mailgunService }).supportsProbe).toBe(false);
    });
  });

  describe('domain state', () => {
    it('should report no domain issue when the domain is active', async () => {
      const { response } = await runHealthCheck({ mock: { domainResult: { state: 'active' } } });

      expect(issueForCode(response, MailgunNotificationHealthCheckIssueCode.DOMAIN_NOT_ACTIVE)).toBeUndefined();
      expect(issueForCode(response, KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE)).toBeUndefined();
    });

    it('should report DOMAIN_NOT_ACTIVE when the domain is unverified', async () => {
      const { response } = await runHealthCheck({ mock: { domainResult: { state: 'unverified' } } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.DOMAIN_NOT_ACTIVE);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.d?.state).toBe('unverified');
      expect(issue?.d?.domain).toBe(TEST_DOMAIN);
    });

    it('should report DOMAIN_NOT_ACTIVE when an active domain is disabled', async () => {
      const { response } = await runHealthCheck({ mock: { domainResult: { state: 'active', is_disabled: true } } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.DOMAIN_NOT_ACTIVE);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.d?.disabled).toBe(true);
    });

    it('should report the check as unavailable when the domain state cannot be read', async () => {
      const { response } = await runHealthCheck({ mock: { domainError: true } });
      const issue = issueForCode(response, KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.UNKNOWN);
      expect(issue?.d?.domain).toBe(TEST_DOMAIN);
      expect(issueForCode(response, MailgunNotificationHealthCheckIssueCode.DOMAIN_NOT_ACTIVE)).toBeUndefined();
    });
  });

  describe('suppressions', () => {
    const bounce: MailgunBounceSuppression = { address: TEST_TARGET, code: 550, error: 'no such mailbox', created_at: TEST_NOW };
    const complaint: MailgunComplaintSuppression = { address: TEST_TARGET, created_at: TEST_NOW };
    const unsubscribe: MailgunUnsubscribeSuppression = { address: TEST_TARGET, tags: ['*'], created_at: TEST_NOW };

    it('should report SUPPRESSED_BOUNCE as an error', async () => {
      const { response } = await runHealthCheck({ mock: { bounce } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.SUPPRESSED_BOUNCE);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.d?.code).toBe(550);
      expect(issue?.d?.error).toBe('no such mailbox');
      expect(issue?.f).toBeDefined();
    });

    it('should report SUPPRESSED_COMPLAINT as an error', async () => {
      const { response } = await runHealthCheck({ mock: { complaint } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.SUPPRESSED_COMPLAINT);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.d?.address).toBe(TEST_TARGET);
    });

    it('should report SUPPRESSED_UNSUBSCRIBE as a warning', async () => {
      const { response } = await runHealthCheck({ mock: { unsubscribe } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.SUPPRESSED_UNSUBSCRIBE);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.WARNING);
      expect(issue?.d?.tags).toEqual(['*']);
    });

    it('should report every suppression list the address appears on', async () => {
      const { response } = await runHealthCheck({ mock: { bounce, complaint, unsubscribe } });

      expect(issueCodes(response)).toEqual(expect.arrayContaining([MailgunNotificationHealthCheckIssueCode.SUPPRESSED_BOUNCE, MailgunNotificationHealthCheckIssueCode.SUPPRESSED_COMPLAINT, MailgunNotificationHealthCheckIssueCode.SUPPRESSED_UNSUBSCRIBE]));
    });

    it('should treat a failed suppression lookup as the address not being listed', async () => {
      const { response } = await runHealthCheck({ mock: { bounce, suppressionsError: true } });

      expect(issueForCode(response, MailgunNotificationHealthCheckIssueCode.SUPPRESSED_BOUNCE)).toBeUndefined();
      expect(issueForCode(response, MailgunNotificationHealthCheckIssueCode.SUPPRESSED_COMPLAINT)).toBeUndefined();
      expect(issueForCode(response, MailgunNotificationHealthCheckIssueCode.SUPPRESSED_UNSUBSCRIBE)).toBeUndefined();
    });
  });

  describe('recent activity', () => {
    it('should warn when no email has been sent to the address recently', async () => {
      const { response } = await runHealthCheck({ mock: { recentEvents: [] } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.NO_RECENT_ACTIVITY);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.WARNING);
      expect(issue?.f).toBeDefined();
    });

    it('should be inconclusive when recent email was accepted but never settled', async () => {
      const recentEvents = [makeTestEvent({ event: MailgunEventName.OPENED }), makeTestEvent({ event: MailgunEventName.ACCEPTED })];
      const { response } = await runHealthCheck({ mock: { recentEvents } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.NO_RECENT_ACTIVITY);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.UNKNOWN);
      expect(issue?.d?.eventCount).toBe(2);
    });

    it('should report RECENT_DELIVERY_SUCCESS when the newest conclusive event is a delivery', async () => {
      // newest-first: the delivery is newer than the failure, so the problem is already resolved
      const recentEvents = [makeTestEvent({ event: MailgunEventName.DELIVERED, timestamp: 1767225600 }), makeTestEvent({ event: MailgunEventName.FAILED, timestamp: 1767139200, severity: MailgunEventSeverity.PERMANENT })];
      const { response } = await runHealthCheck({ mock: { recentEvents } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.RECENT_DELIVERY_SUCCESS);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.OK);
      expect(issue?.d?.deliveredAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      expect(issueForCode(response, MailgunNotificationHealthCheckIssueCode.RECENT_DELIVERY_FAILURE)).toBeUndefined();
    });

    it('should report a permanent failure as an error', async () => {
      const recentEvents = [makeTestEvent({ event: MailgunEventName.FAILED, severity: MailgunEventSeverity.PERMANENT, reason: 'suppress-bounce' })];
      const { response } = await runHealthCheck({ mock: { recentEvents } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.RECENT_DELIVERY_FAILURE);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.d?.severity).toBe(MailgunEventSeverity.PERMANENT);
      expect(issue?.d?.reason).toBe('suppress-bounce');
      expect(issue?.m).toContain('suppress-bounce');
    });

    it('should report a temporary failure as a warning', async () => {
      const recentEvents = [makeTestEvent({ event: MailgunEventName.FAILED, severity: MailgunEventSeverity.TEMPORARY, reason: 'greylisted' })];
      const { response } = await runHealthCheck({ mock: { recentEvents } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.RECENT_DELIVERY_FAILURE);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.WARNING);
      expect(issue?.d?.severity).toBe(MailgunEventSeverity.TEMPORARY);
    });

    it('should report a rejected message as a failure', async () => {
      const recentEvents = [makeTestEvent({ event: MailgunEventName.REJECTED, reason: 'Sandbox subdomains are for test purposes only' })];
      const { response } = await runHealthCheck({ mock: { recentEvents } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.RECENT_DELIVERY_FAILURE);

      expect(issue?.d?.event).toBe(MailgunEventName.REJECTED);
      // no severity on a rejection, so it is not treated as permanent
      expect(issue?.s).toBe(NotificationHealthCheckStatus.WARNING);
    });
  });

  describe('address validation', () => {
    it('should not run validation unless it is enabled', async () => {
      const { captures, response } = await runHealthCheck({ mock: { validation: { result: 'undeliverable' } } });

      expect(captures.validatedAddresses).toHaveLength(0);
      expect(issueForCode(response, MailgunNotificationHealthCheckIssueCode.ADDRESS_UNDELIVERABLE)).toBeUndefined();
    });

    it('should report ADDRESS_UNDELIVERABLE as an error', async () => {
      const { captures, response } = await runHealthCheck({ mock: { validation: { address: TEST_TARGET, result: 'undeliverable', risk: 'high' } }, service: { validateAddress: true } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.ADDRESS_UNDELIVERABLE);

      expect(captures.validatedAddresses).toEqual([TEST_TARGET]);
      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.d?.risk).toBe('high');
    });

    it('should report ADDRESS_DISPOSABLE as a warning', async () => {
      const { response } = await runHealthCheck({ mock: { validation: { address: TEST_TARGET, result: 'deliverable', is_disposable_address: true } }, service: { validateAddress: true } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.ADDRESS_DISPOSABLE);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.WARNING);
      expect(issueForCode(response, MailgunNotificationHealthCheckIssueCode.ADDRESS_UNDELIVERABLE)).toBeUndefined();
    });

    it('should report both validation findings when both apply', async () => {
      const { response } = await runHealthCheck({ mock: { validation: { address: TEST_TARGET, result: 'undeliverable', is_disposable_address: true } }, service: { validateAddress: true } });

      expect(issueCodes(response)).toEqual(expect.arrayContaining([MailgunNotificationHealthCheckIssueCode.ADDRESS_UNDELIVERABLE, MailgunNotificationHealthCheckIssueCode.ADDRESS_DISPOSABLE]));
    });
  });

  describe('probe dispatch', () => {
    it('should not dispatch or report a probe when probing was not requested', async () => {
      const { captures, response } = await runHealthCheck({ service: { probeBuilder: testProbeBuilder } });

      expect(captures.sentRequests).toHaveLength(0);
      expect(response.probe).toBeUndefined();
      expect(issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_PENDING)).toBeUndefined();
    });

    it('should report PROBE_NOT_CONFIGURED when no probe builder is configured', async () => {
      const { captures, response } = await runHealthCheck({ request: { sendProbe: true } });
      const issue = issueForCode(response, MailgunNotificationHealthCheckIssueCode.PROBE_NOT_CONFIGURED);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.SKIPPED);
      expect(issue?.d?.target).toBe(TEST_TARGET);
      expect(captures.sentRequests).toHaveLength(0);
      expect(response.probe).toBeUndefined();
    });

    it('should dispatch a probe and record it as pending with the bare message id', async () => {
      const { captures, response } = await runHealthCheck({ mock: { sendResult: { id: '<20260101120000.1.abc@mail.example.com>', status: 200 } }, service: { probeBuilder: testProbeBuilder }, request: { sendProbe: true } });
      const issue = issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_PENDING);

      expect(captures.sentRequests).toHaveLength(1);
      expect(captures.sentRequests[0].to).toEqual({ email: TEST_TARGET });
      expect(issue?.s).toBe(NotificationHealthCheckStatus.PENDING);
      // the events api message-id filter matches nothing when the angle brackets are left on
      expect(response.probe?.id).toBe('20260101120000.1.abc@mail.example.com');
      expect(response.probe?.s).toBe(NotificationHealthCheckStatus.PENDING);
      expect(response.probe?.at).toBe(TEST_NOW);
      expect(response.probe?.tg).toBe(TEST_TARGET);
    });

    it('should report the dispatch as unverifiable when the send returns no message id', async () => {
      const { captures, response } = await runHealthCheck({ mock: { sendResult: { status: 200, message: 'Suppressed' } }, service: { probeBuilder: testProbeBuilder }, request: { sendProbe: true } });
      const issue = issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED);

      expect(captures.sentRequests).toHaveLength(1);
      expect(issue?.s).toBe(NotificationHealthCheckStatus.UNKNOWN);
      expect(issue?.d?.message).toBe('Suppressed');
    });

    it('should report a refused send as an error rather than as unverifiable', async () => {
      const { response } = await runHealthCheck({ mock: { sendResult: { status: 400, message: 'Bad request' } }, service: { probeBuilder: testProbeBuilder }, request: { sendProbe: true } });
      const issue = issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.m).toContain('Bad request');
      expect(response.probe?.s).toBe(NotificationHealthCheckStatus.ERROR);
    });

    // the test message window is derived from the recorded probe, so an attempt that recorded nothing
    // would leave the action enabled and immediately repeatable — one provider call per click
    describe('an attempt with nothing to track it by', () => {
      it('should still record a settled probe, so the test message window applies', async () => {
        const { response } = await runHealthCheck({ mock: { sendResult: { status: 200, message: 'Suppressed' } }, service: { probeBuilder: testProbeBuilder }, request: { sendProbe: true } });

        expect(response.probe).toBeDefined();
        expect(response.probe?.at).toBe(TEST_NOW);
        expect(response.probe?.tg).toBe(TEST_TARGET);
        // nothing to correlate against, and so nothing to resolve later
        expect(response.probe?.id).toBe('');
        expect(response.probe?.s).toBe(NotificationHealthCheckStatus.UNKNOWN);
        expect(isPendingNotificationHealthCheckProbe(response.probe)).toBe(false);
      });

      it('should record one for a send that threw', async () => {
        const { response } = await runHealthCheck({ mock: { sendError: true }, service: { probeBuilder: testProbeBuilder }, request: { sendProbe: true } });

        expect(response.probe?.s).toBe(NotificationHealthCheckStatus.ERROR);
        expect(response.probe?.at).toBe(TEST_NOW);
        expect(isPendingNotificationHealthCheckProbe(response.probe)).toBe(false);
      });
    });

    it('should report PROBE_DISPATCH_FAILED as an error when the send throws', async () => {
      const { response } = await runHealthCheck({ mock: { sendError: true }, service: { probeBuilder: testProbeBuilder }, request: { sendProbe: true } });
      const issue = issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.d?.error).toContain('mailgun refused the send');
    });

    it('should report PROBE_DISPATCH_FAILED as an error when the probe builder throws', async () => {
      const probeBuilder: MailgunNotificationHealthCheckProbeBuilder = () => {
        throw new Error('no probe template');
      };

      const { captures, response } = await runHealthCheck({ service: { probeBuilder }, request: { sendProbe: true } });
      const issue = issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED);

      expect(captures.sentRequests).toHaveLength(0);
      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.d?.error).toContain('no probe template');
    });
  });

  describe('probe resolution', () => {
    it('should resolve a pending probe as delivered', async () => {
      const probeEvents = [makeTestEvent({ event: MailgunEventName.DELIVERED, timestamp: 1767225600 })];
      const { response } = await runHealthCheck({ mock: { probeEvents }, service: { probeBuilder: testProbeBuilder }, request: { pendingProbe: makePendingProbe() } });
      const issue = issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_DELIVERED);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.OK);
      expect(issue?.d?.deliveredAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      expect(response.probe?.s).toBe(NotificationHealthCheckStatus.OK);
      expect(response.probe?.d).toBe('Delivered');
    });

    it('should resolve a pending probe as failed, carrying the provider reason', async () => {
      const probeEvents = [makeTestEvent({ event: MailgunEventName.FAILED, severity: MailgunEventSeverity.PERMANENT, reason: 'mailbox does not exist' })];
      const { response } = await runHealthCheck({ mock: { probeEvents }, service: { probeBuilder: testProbeBuilder }, request: { pendingProbe: makePendingProbe() } });
      const issue = issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_FAILED);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.d?.reason).toBe('mailbox does not exist');
      expect(response.probe?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(response.probe?.d).toBe('mailbox does not exist');
    });

    it('should keep a probe pending while it is still inside the timeout window', async () => {
      const pendingProbe = makePendingProbe({ at: new Date(TEST_NOW.getTime() - 5 * MINUTE_MS) });
      const { response } = await runHealthCheck({ mock: { probeEvents: [] }, service: { probeBuilder: testProbeBuilder }, request: { pendingProbe } });
      const issue = issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_PENDING);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.PENDING);
      expect(response.probe).toBe(pendingProbe);
    });

    it('should fail a probe that outlived its timeout with no recorded outcome', async () => {
      const pendingProbe = makePendingProbe({ at: new Date(TEST_NOW.getTime() - 20 * MINUTE_MS) });
      const { response } = await runHealthCheck({ mock: { probeEvents: [] }, service: { probeBuilder: testProbeBuilder }, request: { pendingProbe } });
      const issue = issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_FAILED);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.d?.probeTimeoutMinutes).toBe(15);
      expect(response.probe?.d).toBe('No delivery result recorded');
    });

    it('should honour a configured probe timeout', async () => {
      const pendingProbe = makePendingProbe({ at: new Date(TEST_NOW.getTime() - 20 * MINUTE_MS) });
      const { response } = await runHealthCheck({ mock: { probeEvents: [] }, service: { probeBuilder: testProbeBuilder, probeTimeoutMinutes: 60 }, request: { pendingProbe } });

      expect(issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_PENDING)?.s).toBe(NotificationHealthCheckStatus.PENDING);
      expect(issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_FAILED)).toBeUndefined();
    });

    it('should correlate the probe lookup on the bare message id and the target', async () => {
      const pendingProbe = makePendingProbe({ id: '<20260101120000.1.abc@mail.example.com>' });
      const { captures } = await runHealthCheck({ mock: { probeEvents: [] }, service: { probeBuilder: testProbeBuilder }, request: { pendingProbe } });
      const probeQuery = captures.eventQueries.find((x) => x['message-id'] != null);

      expect(probeQuery?.['message-id']).toBe('20260101120000.1.abc@mail.example.com');
      expect(probeQuery?.recipient).toBe(TEST_TARGET);
    });

    it('should resolve the pending probe rather than dispatch a second one', async () => {
      const probeEvents = [makeTestEvent({ event: MailgunEventName.DELIVERED })];
      const { captures, response } = await runHealthCheck({ mock: { probeEvents }, service: { probeBuilder: testProbeBuilder }, request: { pendingProbe: makePendingProbe(), sendProbe: true } });

      expect(captures.sentRequests).toHaveLength(0);
      expect(issueForCode(response, KnownNotificationHealthCheckIssueCode.PROBE_DELIVERED)).toBeDefined();
    });
  });
});
