import { type Handler } from '@dereekb/util';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Request } from 'express';
import { TwilioApi } from '../twilio.api';
import { type TwilioMessageSid, type TwilioMessageStatus, type TwilioPhoneNumber } from '../twilio.type';
import { type TwilioIncomingMessageEvent, type TwilioStatusCallbackEvent, type TwilioWebhookEvent, type TwilioWebhookEventType, twilioWebhookEventHandlerConfigurerFactory, twilioWebhookEventHandlerFactory } from './webhook.twilio';
import { TwilioWebhookServiceConfig } from './webhook.twilio.config';
import { twilioWebhookVerifier, type TwilioWebhookVerifier } from './webhook.twilio.verify';

@Injectable()
export class TwilioWebhookService {
  private readonly logger = new Logger('TwilioWebhookService');
  private readonly _verifier: TwilioWebhookVerifier;

  readonly handler: Handler<TwilioWebhookEvent, TwilioWebhookEventType> = twilioWebhookEventHandlerFactory();
  readonly configure = twilioWebhookEventHandlerConfigurerFactory(this.handler);

  constructor(@Inject(TwilioApi) twilioApi: TwilioApi, @Inject(TwilioWebhookServiceConfig) webhookConfig: TwilioWebhookServiceConfig) {
    const authToken = webhookConfig.twilioWebhook.authToken ?? twilioApi.config.twilio.authToken;

    if (!authToken) {
      throw new Error('TwilioWebhookService: authToken is required (set TWILIO_AUTH_TOKEN or TWILIO_WEBHOOK_AUTH_TOKEN).');
    }

    this._verifier = twilioWebhookVerifier({
      authToken,
      baseUrl: webhookConfig.twilioWebhook.baseUrl,
      skip: webhookConfig.twilioWebhook.skipVerify
    });
  }

  async handleStatusCallback(req: Request, rawBody: Buffer): Promise<void> {
    const { valid, params } = this._verifier(req, rawBody);

    if (!valid) {
      this.logger.warn('Received Twilio status callback with invalid signature.');
    } else {
      const event: TwilioStatusCallbackEvent = {
        type: 'status',
        payload: {
          MessageSid: params['MessageSid'] as TwilioMessageSid,
          MessageStatus: params['MessageStatus'] as TwilioMessageStatus,
          AccountSid: params['AccountSid'] ?? '',
          From: params['From'] as TwilioPhoneNumber | undefined,
          To: params['To'] as TwilioPhoneNumber | undefined,
          ApiVersion: params['ApiVersion'],
          ErrorCode: params['ErrorCode'],
          ErrorMessage: params['ErrorMessage'],
          raw: params
        }
      };

      await this.dispatchEvent(event);
    }
  }

  async handleIncomingMessage(req: Request, rawBody: Buffer): Promise<void> {
    const { valid, params } = this._verifier(req, rawBody);

    if (!valid) {
      this.logger.warn('Received Twilio incoming message with invalid signature.');
    } else {
      const numMedia = Number(params['NumMedia'] ?? '0');
      const numSegments = params['NumSegments'] !== undefined ? Number(params['NumSegments']) : undefined;
      const mediaUrls: string[] = [];

      for (let i = 0; i < numMedia; i++) {
        const url = params[`MediaUrl${i}`];
        if (url) {
          mediaUrls.push(url);
        }
      }

      const event: TwilioIncomingMessageEvent = {
        type: 'incoming',
        payload: {
          MessageSid: params['MessageSid'] as TwilioMessageSid,
          AccountSid: params['AccountSid'] ?? '',
          From: params['From'] as TwilioPhoneNumber,
          To: params['To'] as TwilioPhoneNumber,
          Body: params['Body'] ?? '',
          NumMedia: numMedia,
          NumSegments: numSegments,
          FromCity: params['FromCity'],
          FromState: params['FromState'],
          FromZip: params['FromZip'],
          FromCountry: params['FromCountry'],
          mediaUrls,
          raw: params
        }
      };

      await this.dispatchEvent(event);
    }
  }

  private async dispatchEvent(event: TwilioWebhookEvent): Promise<void> {
    const handled = await this.handler(event);

    if (!handled) {
      this.logger.debug(`Received unhandled Twilio webhook event of type "${event.type}".`);
    }
  }
}

/**
 * Provides a reference to a TwilioWebhookService instance.
 */
export interface TwilioWebhookServiceRef {
  readonly twilioWebhookService: TwilioWebhookService;
}
