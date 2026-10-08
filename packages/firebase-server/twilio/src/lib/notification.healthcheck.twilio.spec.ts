import { describe, it, expect, vi } from 'vitest';
import { type E164PhoneNumber, type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId, type NotificationHealthCheckIssue, type NotificationHealthCheckIssueCode, type NotificationHealthCheckProbe, KnownNotificationHealthCheckIssueCode, NotificationDeliveryMethod, NotificationHealthCheckStatus, TwilioNotificationHealthCheckIssueCode } from '@dereekb/firebase';
import { type NotificationSendServiceHealthCheckRequest, type NotificationSendServiceHealthCheckResponse } from '@dereekb/firebase-server/model';
import { type TwilioDiagnosticMessageInput, type TwilioSendSmsInput, type TwilioSendSmsResult, type TwilioService, TwilioMessageErrorCode } from '@dereekb/nestjs/twilio';
import { type TwilioNotificationTextSendServiceHealthCheckServiceConfig, DEFAULT_TWILIO_HEALTH_CHECK_PROBE_TIMEOUT_MINUTES, twilioNotificationTextSendServiceHealthCheckService } from './notification.healthcheck.twilio';

// This service only ever touches twilioService.twilioApi.client and twilioService.sendSms, so its
// classification logic is exercised here with a hand-rolled stub and no Twilio credentials.

const TEST_TARGET = '+15555550100' as E164PhoneNumber;
const TEST_UID: FirebaseAuthUserId = 'testuid';
const TEST_NOW = new Date('2026-01-01T00:00:00.000Z');
const TEST_SID = 'SM00000000000000000000000000000001';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// MARK: Mock
interface MockTwilioServiceConfig {
  /**
   * The account status. Defaults to active.
   */
  readonly accountStatus?: string;
  /**
   * The HTTP status the account fetch fails with.
   */
  readonly accountErrorStatus?: number;
  /**
   * The messages a list query returns, newest first.
   */
  readonly recentMessages?: Partial<TwilioDiagnosticMessageInput>[];
  /**
   * The HTTP status a list query fails with.
   */
  readonly recentMessagesErrorStatus?: number;
  /**
   * The message a fetch by SID returns. Fetching a message that is not set throws a 404.
   */
  readonly probeMessage?: Maybe<Partial<TwilioDiagnosticMessageInput>>;
  readonly probeMessageError?: boolean;
  readonly lookup?: { readonly valid: boolean; readonly lineTypeIntelligence?: Record<string, unknown> };
  readonly sendResult?: Partial<TwilioSendSmsResult>;
}

interface MockTwilioService {
  readonly twilioService: TwilioService;
  readonly sentInputs: TwilioSendSmsInput[];
  readonly listQueries: Record<string, unknown>[];
  readonly lookups: string[];
}

function message(input: Partial<TwilioDiagnosticMessageInput>): TwilioDiagnosticMessageInput {
  return { sid: TEST_SID, status: 'delivered', to: TEST_TARGET, dateCreated: TEST_NOW, ...input };
}

function twilioRestError(status: number): Error {
  return Object.assign(new Error(`status ${status}`), { status });
}

function createMockTwilioService(config: MockTwilioServiceConfig = {}): MockTwilioService {
  const sentInputs: TwilioSendSmsInput[] = [];
  const listQueries: Record<string, unknown>[] = [];
  const lookups: string[] = [];

  const messages = Object.assign(
    (sid: string) => ({
      fetch: async () => {
        if (config.probeMessageError) {
          throw twilioRestError(500);
        } else if (!config.probeMessage) {
          throw twilioRestError(404);
        }

        return message({ sid, ...config.probeMessage });
      }
    }),
    {
      list: async (query: Record<string, unknown>) => {
        listQueries.push(query);

        if (config.recentMessagesErrorStatus != null) {
          throw twilioRestError(config.recentMessagesErrorStatus);
        }

        return (config.recentMessages ?? []).map((x) => message(x));
      }
    }
  );

  const client = {
    api: {
      v2010: {
        account: {
          fetch: async () => {
            if (config.accountErrorStatus != null) {
              throw twilioRestError(config.accountErrorStatus);
            }

            return { status: config.accountStatus ?? 'active' };
          }
        }
      }
    },
    messages,
    lookups: {
      v2: {
        phoneNumbers: (phoneNumber: string) => ({
          fetch: async () => {
            lookups.push(phoneNumber);
            return config.lookup ?? { valid: true };
          }
        })
      }
    }
  };

  const twilioService = {
    twilioApi: { client },
    sendSms: vi.fn(async (input: TwilioSendSmsInput): Promise<TwilioSendSmsResult> => {
      sentInputs.push(input);
      return { sid: TEST_SID, to: input.to, status: 'queued', sandboxed: false, ...config.sendResult };
    })
  } as unknown as TwilioService;

  return { twilioService, sentInputs, listQueries, lookups };
}

// MARK: Helpers
function probeBuilder() {
  return { to: '+15555559999' as E164PhoneNumber, body: 'Example: this is a test text.' };
}

function pendingProbe(ageMinutes: number): NotificationHealthCheckProbe {
  return { id: TEST_SID, at: new Date(TEST_NOW.getTime() - ageMinutes * MINUTE_MS), s: NotificationHealthCheckStatus.PENDING, tg: TEST_TARGET };
}

async function runHealthCheck(
  mockConfig: MockTwilioServiceConfig = {},
  serviceConfig: Partial<TwilioNotificationTextSendServiceHealthCheckServiceConfig> = {},
  request: Partial<NotificationSendServiceHealthCheckRequest<E164PhoneNumber>> = {}
): Promise<NotificationSendServiceHealthCheckResponse & { readonly mock: MockTwilioService }> {
  const mock = createMockTwilioService(mockConfig);
  const service = twilioNotificationTextSendServiceHealthCheckService({ twilioService: mock.twilioService, ...serviceConfig });
  const response = await service.runHealthCheck({ method: NotificationDeliveryMethod.TEXT, target: TEST_TARGET, uid: TEST_UID, sendProbe: false, now: TEST_NOW, ...request });
  return { ...response, mock };
}

function issueForCode(issues: NotificationHealthCheckIssue[], code: NotificationHealthCheckIssueCode): Maybe<NotificationHealthCheckIssue> {
  return issues.find((x) => x.c === code);
}

function issueCodes(issues: NotificationHealthCheckIssue[]): NotificationHealthCheckIssueCode[] {
  return issues.map((x) => x.c);
}

// MARK: Tests
describe('twilioNotificationTextSendServiceHealthCheckService()', () => {
  describe('account', () => {
    it('should report nothing about an active account', async () => {
      const { issues } = await runHealthCheck({ recentMessages: [{ status: 'delivered' }] });
      expect(issueCodes(issues)).toEqual([TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_SUCCESS]);
    });

    it('should report an account that is not active as a system-wide error', async () => {
      const { issues } = await runHealthCheck({ accountStatus: 'suspended', recentMessages: [{ status: 'delivered' }] });
      const issue = issueForCode(issues, TwilioNotificationHealthCheckIssueCode.ACCOUNT_NOT_ACTIVE);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.d?.['status']).toBe('suspended');
    });

    it('should report an unreachable provider once, with why', async () => {
      const { issues } = await runHealthCheck({ accountErrorStatus: 500, recentMessagesErrorStatus: 503 });

      expect(issueCodes(issues)).toEqual([KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE]);
      expect(issues[0].s).toBe(NotificationHealthCheckStatus.UNKNOWN);
      expect(issues[0].m).toContain('could not be reached');
      expect(issues[0].d?.['status']).toBe(503);
    });

    it('should report refused credentials', async () => {
      const { issues } = await runHealthCheck({ accountErrorStatus: 401, recentMessagesErrorStatus: 401 });

      expect(issueCodes(issues)).toEqual([KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE]);
      expect(issues[0].m).toContain('refused our credentials');
    });

    it('should not report an account a Standard API key may not read', async () => {
      const { issues } = await runHealthCheck({ accountErrorStatus: 403, recentMessages: [{ status: 'delivered' }] });
      expect(issueCodes(issues)).toEqual([TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_SUCCESS]);
    });

    it('should report an account that could not be reached when the texts could be read', async () => {
      const { issues } = await runHealthCheck({ accountErrorStatus: 500, recentMessages: [{ status: 'delivered' }] });
      expect(issueCodes(issues)).toEqual([KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE, TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_SUCCESS]);
    });
  });

  describe('recent activity', () => {
    it('should only read texts sent within the window', async () => {
      const { mock } = await runHealthCheck({}, { recentMessagesWindowDays: 7, recentMessagesLimit: 5 });

      expect(mock.listQueries).toEqual([{ to: TEST_TARGET, limit: 5, dateSentAfter: new Date(TEST_NOW.getTime() - 7 * DAY_MS) }]);
    });

    it('should report no recent activity when nothing was texted', async () => {
      const { issues } = await runHealthCheck({ recentMessages: [] });
      expect(issueForCode(issues, TwilioNotificationHealthCheckIssueCode.NO_RECENT_ACTIVITY)?.s).toBe(NotificationHealthCheckStatus.WARNING);
    });

    it('should report an unknown outcome when no recent text has one yet', async () => {
      const { issues } = await runHealthCheck({ recentMessages: [{ status: 'queued' }, { status: 'sending' }] });
      expect(issueForCode(issues, TwilioNotificationHealthCheckIssueCode.NO_RECENT_ACTIVITY)?.s).toBe(NotificationHealthCheckStatus.UNKNOWN);
    });

    it('should report the newest delivery over an older failure', async () => {
      const { issues } = await runHealthCheck({ recentMessages: [{ status: 'delivered' }, { status: 'undelivered', errorCode: TwilioMessageErrorCode.LANDLINE_OR_UNREACHABLE_CARRIER }] });
      expect(issueCodes(issues)).toEqual([TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_SUCCESS]);
    });

    it('should report a text the carrier accepted as handed to the carrier', async () => {
      const { issues } = await runHealthCheck({ recentMessages: [{ status: 'sent' }] });
      const issue = issueForCode(issues, TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_SUCCESS);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.OK);
      expect(issue?.m).toContain('carrier');
    });

    it('should report a permanent failure as an error with its reason', async () => {
      const { issues } = await runHealthCheck({ recentMessages: [{ status: 'undelivered', errorCode: TwilioMessageErrorCode.LANDLINE_OR_UNREACHABLE_CARRIER, errorMessage: 'Unreachable destination' }] });
      const issue = issueForCode(issues, TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_FAILURE);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.m).toContain('landline');
      expect(issue?.d?.['errorCode']).toBe(TwilioMessageErrorCode.LANDLINE_OR_UNREACHABLE_CARRIER);
    });

    it('should report a temporary failure as a warning', async () => {
      const { issues } = await runHealthCheck({ recentMessages: [{ status: 'undelivered', errorCode: TwilioMessageErrorCode.UNREACHABLE_DESTINATION_HANDSET }] });
      expect(issueForCode(issues, TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_FAILURE)?.s).toBe(NotificationHealthCheckStatus.WARNING);
    });

    it("should fall back to Twilio's error message for an unknown error code", async () => {
      const { issues } = await runHealthCheck({ recentMessages: [{ status: 'failed', errorCode: 12345, errorMessage: 'Something odd' }] });
      expect(issueForCode(issues, TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_FAILURE)?.m).toContain('Something odd');
    });

    it('should report a number that replied STOP', async () => {
      const { issues } = await runHealthCheck({ recentMessages: [{ status: 'failed', errorCode: TwilioMessageErrorCode.UNSUBSCRIBED_RECIPIENT }] });

      expect(issueCodes(issues)).toEqual([TwilioNotificationHealthCheckIssueCode.RECIPIENT_OPTED_OUT]);
      expect(issues[0].f).toContain('START');
    });

    it('should report an unregistered sending number as a system-wide error', async () => {
      const { issues } = await runHealthCheck({ recentMessages: [{ status: 'undelivered', errorCode: TwilioMessageErrorCode.UNREGISTERED_NUMBER }] });
      expect(issueCodes(issues)).toEqual([TwilioNotificationHealthCheckIssueCode.SENDER_NOT_REGISTERED]);
    });

    it('should report recent texts that could not be read when the account could', async () => {
      const { issues } = await runHealthCheck({ recentMessagesErrorStatus: 500 });
      expect(issueCodes(issues)).toEqual([KnownNotificationHealthCheckIssueCode.SEND_SERVICE_HEALTH_CHECK_UNAVAILABLE]);
    });
  });

  describe('number lookup', () => {
    it('should not look the number up by default', async () => {
      const { mock } = await runHealthCheck();
      expect(mock.lookups).toEqual([]);
    });

    it('should report an invalid number', async () => {
      const { issues } = await runHealthCheck({ lookup: { valid: false }, recentMessages: [{ status: 'delivered' }] }, { lookupNumber: true });
      expect(issueForCode(issues, TwilioNotificationHealthCheckIssueCode.NUMBER_INVALID)?.s).toBe(NotificationHealthCheckStatus.ERROR);
    });

    it('should report a landline', async () => {
      const { issues } = await runHealthCheck({ lookup: { valid: true, lineTypeIntelligence: { type: 'landline', carrier_name: 'Example Telco' } }, recentMessages: [{ status: 'delivered' }] }, { lookupNumber: true });
      const issue = issueForCode(issues, TwilioNotificationHealthCheckIssueCode.NUMBER_LANDLINE);

      expect(issue?.s).toBe(NotificationHealthCheckStatus.ERROR);
      expect(issue?.d?.['carrierName']).toBe('Example Telco');
    });

    it('should report nothing about a mobile number', async () => {
      const { issues } = await runHealthCheck({ lookup: { valid: true, lineTypeIntelligence: { type: 'mobile' } }, recentMessages: [{ status: 'delivered' }] }, { lookupNumber: true });
      expect(issueCodes(issues)).toEqual([TwilioNotificationHealthCheckIssueCode.RECENT_DELIVERY_SUCCESS]);
    });
  });

  describe('probe', () => {
    it('should only support probing with a probe builder', () => {
      const { twilioService } = createMockTwilioService();

      expect(twilioNotificationTextSendServiceHealthCheckService({ twilioService }).supportsProbe).toBe(false);
      expect(twilioNotificationTextSendServiceHealthCheckService({ twilioService, probeBuilder }).supportsProbe).toBe(true);
    });

    it('should report that probing is not configured', async () => {
      const { issues, probe } = await runHealthCheck({}, {}, { sendProbe: true });

      expect(issueForCode(issues, TwilioNotificationHealthCheckIssueCode.PROBE_NOT_CONFIGURED)?.s).toBe(NotificationHealthCheckStatus.SKIPPED);
      expect(probe).toBeUndefined();
    });

    describe('dispatch', () => {
      it('should send the probe to the target and record it as pending', async () => {
        const { issues, probe, mock } = await runHealthCheck({}, { probeBuilder }, { sendProbe: true });

        expect(mock.sentInputs.map((x) => x.to)).toEqual([TEST_TARGET]);
        expect(issueForCode(issues, KnownNotificationHealthCheckIssueCode.PROBE_PENDING)?.s).toBe(NotificationHealthCheckStatus.PENDING);
        expect(probe).toEqual({ id: TEST_SID, at: TEST_NOW, s: NotificationHealthCheckStatus.PENDING, tg: TEST_TARGET });
      });

      it('should not send a probe unless asked to', async () => {
        const { mock, probe } = await runHealthCheck({}, { probeBuilder });

        expect(mock.sentInputs).toEqual([]);
        expect(probe).toBeUndefined();
      });

      it('should record a sandboxed probe as settled and untrackable', async () => {
        const { issues, probe } = await runHealthCheck({ sendResult: { sid: null, sandboxed: true } }, { probeBuilder }, { sendProbe: true });

        expect(issueForCode(issues, KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED)?.s).toBe(NotificationHealthCheckStatus.UNKNOWN);
        expect(probe?.s).toBe(NotificationHealthCheckStatus.UNKNOWN);
        expect(probe?.id).toBe('');
      });

      it('should report a refused probe to a number that replied STOP', async () => {
        const { issues, probe } = await runHealthCheck({ sendResult: { sid: null, status: 'failed', error: 'Attempt to send to unsubscribed recipient', errorCode: TwilioMessageErrorCode.UNSUBSCRIBED_RECIPIENT } }, { probeBuilder }, { sendProbe: true });

        expect(issueCodes(issues)).toContain(KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED);
        expect(issueCodes(issues)).toContain(TwilioNotificationHealthCheckIssueCode.RECIPIENT_OPTED_OUT);
        expect(probe?.s).toBe(NotificationHealthCheckStatus.ERROR);
      });

      it('should record a probe that could not be built as failed', async () => {
        const failingProbeBuilder = () => {
          throw new Error('no body');
        };

        const { issues, probe } = await runHealthCheck({}, { probeBuilder: failingProbeBuilder }, { sendProbe: true });

        expect(issueForCode(issues, KnownNotificationHealthCheckIssueCode.PROBE_DISPATCH_FAILED)?.s).toBe(NotificationHealthCheckStatus.ERROR);
        expect(probe?.s).toBe(NotificationHealthCheckStatus.ERROR);
      });
    });

    describe('pending probe', () => {
      it('should resolve a delivered probe', async () => {
        const { issues, probe, mock } = await runHealthCheck({ probeMessage: { status: 'delivered' } }, { probeBuilder }, { pendingProbe: pendingProbe(1), sendProbe: true });

        expect(issueForCode(issues, KnownNotificationHealthCheckIssueCode.PROBE_DELIVERED)?.s).toBe(NotificationHealthCheckStatus.OK);
        expect(probe?.s).toBe(NotificationHealthCheckStatus.OK);
        expect(mock.sentInputs).toEqual([]); // the pending probe is resolved instead of sending another
      });

      it('should resolve a failed probe with its reason', async () => {
        const { issues, probe } = await runHealthCheck({ probeMessage: { status: 'undelivered', errorCode: TwilioMessageErrorCode.MESSAGE_FILTERED } }, {}, { pendingProbe: pendingProbe(1) });

        expect(issueForCode(issues, KnownNotificationHealthCheckIssueCode.PROBE_FAILED)?.m).toContain('filtered');
        expect(probe?.s).toBe(NotificationHealthCheckStatus.ERROR);
      });

      it('should keep a young probe that is still in flight pending', async () => {
        const { issues, probe } = await runHealthCheck({ probeMessage: { status: 'sending' } }, {}, { pendingProbe: pendingProbe(1) });

        expect(issueForCode(issues, KnownNotificationHealthCheckIssueCode.PROBE_PENDING)).toBeDefined();
        expect(probe?.s).toBe(NotificationHealthCheckStatus.PENDING);
      });

      it('should settle a probe still in flight after the timeout as failed', async () => {
        const { issues, probe } = await runHealthCheck({ probeMessage: { status: 'sending' } }, {}, { pendingProbe: pendingProbe(DEFAULT_TWILIO_HEALTH_CHECK_PROBE_TIMEOUT_MINUTES + 1) });

        expect(issueForCode(issues, KnownNotificationHealthCheckIssueCode.PROBE_FAILED)).toBeDefined();
        expect(probe?.s).toBe(NotificationHealthCheckStatus.ERROR);
      });

      it('should settle a probe the carrier accepted but never confirmed as unconfirmed', async () => {
        const { issues, probe } = await runHealthCheck({ probeMessage: { status: 'sent' } }, {}, { pendingProbe: pendingProbe(DEFAULT_TWILIO_HEALTH_CHECK_PROBE_TIMEOUT_MINUTES + 1) });

        expect(issueForCode(issues, KnownNotificationHealthCheckIssueCode.PROBE_DELIVERED)?.s).toBe(NotificationHealthCheckStatus.UNKNOWN);
        expect(probe?.s).toBe(NotificationHealthCheckStatus.UNKNOWN);
      });

      it('should keep a probe pending while its status cannot be read', async () => {
        const { probe } = await runHealthCheck({ probeMessageError: true }, {}, { pendingProbe: pendingProbe(DEFAULT_TWILIO_HEALTH_CHECK_PROBE_TIMEOUT_MINUTES + 1) });
        expect(probe?.s).toBe(NotificationHealthCheckStatus.PENDING);
      });

      it('should settle a probe Twilio has no record of after the timeout as failed', async () => {
        const { probe } = await runHealthCheck({ probeMessage: null }, {}, { pendingProbe: pendingProbe(DEFAULT_TWILIO_HEALTH_CHECK_PROBE_TIMEOUT_MINUTES + 1) });
        expect(probe?.s).toBe(NotificationHealthCheckStatus.ERROR);
      });
    });
  });
});
