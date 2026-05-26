import { type Maybe } from '@dereekb/util';
import { Inject, Injectable } from '@nestjs/common';
import { type TwilioPhoneNumber, type TwilioVerificationStatus, type TwilioVerifyChannel } from '../twilio.type';
import { TwilioVerifyApi } from './verify.api';

/**
 * Input for starting a Twilio Verify check.
 */
export interface TwilioStartVerificationInput {
  /**
   * Recipient phone number / address (E.164 for SMS/call, email for email channel).
   */
  readonly to: string;
  /**
   * Delivery channel. Defaults to the configured default channel.
   */
  readonly channel?: Maybe<TwilioVerifyChannel>;
  /**
   * BCP-47 locale code for the verification message template (e.g. `en`, `es`).
   */
  readonly locale?: Maybe<string>;
  /**
   * Optional custom code (Twilio Verify Premium feature).
   */
  readonly customCode?: Maybe<string>;
}

/**
 * Result of a started verification.
 */
export interface TwilioStartVerificationResult {
  readonly sid: string;
  readonly to: string;
  readonly channel: TwilioVerifyChannel;
  readonly status: TwilioVerificationStatus;
  readonly valid: boolean;
}

/**
 * Input for checking a verification code.
 */
export interface TwilioCheckVerificationInput {
  /**
   * The phone number / address the code was sent to.
   */
  readonly to: TwilioPhoneNumber | string;
  /**
   * The code supplied by the user.
   */
  readonly code: string;
}

/**
 * Result of a verification check.
 */
export interface TwilioCheckVerificationResult {
  readonly sid: string;
  readonly to: string;
  readonly status: TwilioVerificationStatus;
  readonly valid: boolean;
}

@Injectable()
export class TwilioVerifyService {
  private readonly _twilioVerifyApi: TwilioVerifyApi;

  constructor(@Inject(TwilioVerifyApi) twilioVerifyApi: TwilioVerifyApi) {
    this._twilioVerifyApi = twilioVerifyApi;
  }

  get twilioVerifyApi(): TwilioVerifyApi {
    return this._twilioVerifyApi;
  }

  /**
   * Starts a verification for the given recipient. Twilio generates and dispatches the code.
   *
   * @param input - Recipient, optional channel override, optional locale and customCode.
   * @returns The Twilio verification record (status, channel, SID).
   */
  async startVerification(input: TwilioStartVerificationInput): Promise<TwilioStartVerificationResult> {
    const channel: TwilioVerifyChannel = input.channel ?? this._twilioVerifyApi.config.twilioVerify.defaultChannel ?? 'sms';

    const verification = await this._twilioVerifyApi.verifyService.verifications.create({
      to: input.to,
      channel,
      ...(input.locale ? { locale: input.locale } : {}),
      ...(input.customCode ? { customCode: input.customCode } : {})
    });

    const result: TwilioStartVerificationResult = {
      sid: verification.sid,
      to: verification.to,
      channel: verification.channel as TwilioVerifyChannel,
      status: verification.status as TwilioVerificationStatus,
      valid: verification.valid
    };

    return result;
  }

  /**
   * Checks a previously-issued verification code.
   *
   * Returns `valid: true` only when Twilio reports the verification as `approved`.
   *
   * @param input - Recipient address and the submitted code.
   * @returns The verification-check result, with `valid` reflecting Twilio's `approved` status.
   */
  async checkVerification(input: TwilioCheckVerificationInput): Promise<TwilioCheckVerificationResult> {
    const check = await this._twilioVerifyApi.verifyService.verificationChecks.create({
      to: input.to,
      code: input.code
    });

    const status = check.status as TwilioVerificationStatus;
    const result: TwilioCheckVerificationResult = {
      sid: check.sid,
      to: check.to,
      status,
      valid: status === 'approved'
    };

    return result;
  }
}

/**
 * Provides a reference to a TwilioVerifyService instance.
 */
export interface TwilioVerifyServiceRef {
  readonly twilioVerifyService: TwilioVerifyService;
}
