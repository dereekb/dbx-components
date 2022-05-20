import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { TwilioServiceConfig } from './twilio.config';
import { Request } from 'express';
import * as twilio from 'twilio';
import { TwilioIdentity, TwilioMessagingServiceSid } from './twilio';

// TODO: Add factories for TwilioAPIs, retrieved by App identifiers, or no identifier.

@Injectable()
export class TwilioApi {

  readonly client: twilio.Twilio;

  constructor(@Inject(TwilioServiceConfig) public readonly config: TwilioServiceConfig) {
    this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
  }

  // MARK: Access Token
  public makeAccessToken({ identity, chat }: { identity: TwilioIdentity, chat: boolean }) {
    // https://www.twilio.com/docs/chat/create-tokens
    const token = new twilio.jwt.AccessToken(
      this.config.twilio.accountSid,
      this.config.chat.apiKey.sid,
      this.config.chat.apiKey.secret,
      { identity }
    );

    if (chat) {
      // Allows access to Chat/Conversations API
      const chatGrant = new twilio.jwt.AccessToken.ChatGrant({
        serviceSid: this.config.chat.sid,
      });

      token.addGrant(chatGrant);
    }

    return token;
  }

  // MARK: Webhook
  public assertValidTwilioRequest(req: Request, body: object): void {
    if (!this.isValidTwilioRequest(req, body)) {
      throw new UnauthorizedException('Validity could not be confirmed.');
    }
  }

  public isValidTwilioRequest(req: Request, body: object): boolean {
    return twilio.validateExpressRequest(req, this.config.twilio.authToken, { protocol: 'https', host: this.config.host });
  }

}
