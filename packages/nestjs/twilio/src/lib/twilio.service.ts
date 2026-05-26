import { type Maybe, performAsyncTasks } from '@dereekb/util';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TwilioApi } from './twilio.api';
import { type TwilioMessageSid, type TwilioMessageStatus, type TwilioMessagingServiceSid, type TwilioPhoneNumber, type TwilioStatusCallbackUrl } from './twilio.type';

/**
 * Maximum number of concurrent SMS send requests issued by {@link TwilioService.sendBulkSms}.
 */
export const DEFAULT_TWILIO_SEND_SMS_MAX_PARALLEL_TASKS = 5;

/**
 * Input for sending a single SMS message via Twilio.
 */
export interface TwilioSendSmsInput {
  /**
   * Recipient phone number in E.164 format.
   */
  readonly to: TwilioPhoneNumber;
  /**
   * Message body. Twilio segments any body longer than 160 GSM-7 chars (or 70 UCS-2 chars).
   */
  readonly body: string;
  /**
   * Sender phone number (E.164). Overrides the configured default. Ignored when
   * `messagingServiceSid` is provided.
   */
  readonly from?: Maybe<TwilioPhoneNumber>;
  /**
   * Twilio Messaging Service SID to send from. Overrides the configured default and
   * takes precedence over `from`.
   */
  readonly messagingServiceSid?: Maybe<TwilioMessagingServiceSid>;
  /**
   * Status callback URL. Overrides the configured default.
   */
  readonly statusCallback?: Maybe<TwilioStatusCallbackUrl>;
  /**
   * Optional URLs of media (MMS) to attach.
   */
  readonly mediaUrl?: Maybe<string[]>;
}

/**
 * Result of a single SMS send attempt.
 */
export interface TwilioSendSmsResult {
  /**
   * Twilio Message SID assigned by the API. `null` when the send was suppressed by sandbox mode.
   */
  readonly sid: Maybe<TwilioMessageSid>;
  /**
   * Recipient phone number this result corresponds to.
   */
  readonly to: TwilioPhoneNumber;
  /**
   * Twilio-reported status at the time of the API response.
   */
  readonly status: TwilioMessageStatus;
  /**
   * When true, the message was suppressed by sandbox mode and never sent to Twilio.
   */
  readonly sandboxed: boolean;
  /**
   * Error message captured if the send failed.
   */
  readonly error?: Maybe<string>;
}

@Injectable()
export class TwilioService {
  private readonly logger = new Logger('TwilioService');
  private readonly _twilioApi: TwilioApi;

  constructor(@Inject(TwilioApi) twilioApi: TwilioApi) {
    this._twilioApi = twilioApi;
  }

  get twilioApi(): TwilioApi {
    return this._twilioApi;
  }

  /**
   * Sends a single SMS through Twilio. Honors the configured sandbox flag.
   *
   * @param input - Recipient, body, and optional sender/callback/media overrides.
   * @returns The result of the send attempt, including the Twilio Message SID on success.
   */
  async sendSms(input: TwilioSendSmsInput): Promise<TwilioSendSmsResult> {
    const { messages } = this._twilioApi.config;
    const isSandbox = messages.sandbox === true;

    let result: TwilioSendSmsResult;

    if (isSandbox) {
      result = {
        sid: null,
        to: input.to,
        status: 'queued',
        sandboxed: true
      };
    } else {
      const from = input.from ?? messages.defaultFrom ?? undefined;
      const messagingServiceSid = input.messagingServiceSid ?? messages.messagingServiceSid ?? undefined;
      const statusCallback = input.statusCallback ?? messages.defaultStatusCallback ?? undefined;

      try {
        const message = await this._twilioApi.client.messages.create({
          to: input.to,
          body: input.body,
          ...(messagingServiceSid ? { messagingServiceSid } : { from: from as string }),
          ...(statusCallback ? { statusCallback } : {}),
          ...(input.mediaUrl?.length ? { mediaUrl: input.mediaUrl } : {})
        });

        result = {
          sid: message.sid,
          to: input.to,
          status: message.status as TwilioMessageStatus,
          sandboxed: false
        };
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        this.logger.error(`Failed sending SMS to ${input.to}: ${errorMessage}`);
        result = {
          sid: null,
          to: input.to,
          status: 'failed',
          sandboxed: false,
          error: errorMessage
        };
      }
    }

    return result;
  }

  /**
   * Sends a batch of SMS messages through Twilio with bounded parallelism. Failures are
   * captured per-message and never reject the returned promise.
   *
   * @param inputs - Array of SMS send inputs, one per recipient.
   * @param maxParallelTasks - Maximum concurrent Twilio requests in flight.
   * @returns One {@link TwilioSendSmsResult} per input, in input order.
   */
  async sendBulkSms(inputs: TwilioSendSmsInput[], maxParallelTasks: number = DEFAULT_TWILIO_SEND_SMS_MAX_PARALLEL_TASKS): Promise<TwilioSendSmsResult[]> {
    const { results } = await performAsyncTasks(inputs, (input) => this.sendSms(input), { maxParallelTasks, throwError: false });
    return results.map(([, result]) => result);
  }
}

/**
 * Provides a reference to a TwilioService instance.
 */
export interface TwilioServiceRef {
  readonly twilioService: TwilioService;
}
