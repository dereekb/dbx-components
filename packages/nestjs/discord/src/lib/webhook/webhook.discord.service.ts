import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Request } from 'express';
import { discordInteractionHandlerConfigurerFactory, discordInteractionHandlerFactory, type DiscordInteractionType, type UntypedDiscordInteraction } from './webhook.discord';
import { type Handler } from '@dereekb/util';
import { DiscordWebhookServiceConfig } from './webhook.discord.config';
import { discordWebhookEventVerifier, type DiscordWebhookEventVerifier } from './webhook.discord.verify';

/**
 * Service that handles Discord interaction webhook events.
 *
 * Verifies incoming webhook signatures and dispatches interactions to registered handlers.
 */
@Injectable()
export class DiscordWebhookService {
  private readonly logger = new Logger('DiscordWebhookService');

  private readonly _verifier: DiscordWebhookEventVerifier;

  readonly handler: Handler<UntypedDiscordInteraction, DiscordInteractionType> = discordInteractionHandlerFactory();
  readonly configure = discordInteractionHandlerConfigurerFactory(this.handler);

  constructor(@Inject(DiscordWebhookServiceConfig) discordWebhookServiceConfig: DiscordWebhookServiceConfig) {
    this._verifier = discordWebhookEventVerifier({
      publicKey: discordWebhookServiceConfig.discordWebhook.publicKey
    });
  }

  async updateForWebhook(req: Request, rawBody: Buffer): Promise<void> {
    const result = await this._verifier(req, rawBody);

    if (!result.valid) {
      this.logger.warn('Received invalid Discord interaction event.', req);
    } else {
      await this.updateForDiscordInteraction(result.body as UntypedDiscordInteraction);
    }
  }

  async updateForDiscordInteraction(interaction: UntypedDiscordInteraction): Promise<void> {
    const result = await this.handler(interaction);

    if (!result) {
      this.logger.warn('Received unexpected/unhandled Discord interaction.', interaction);
    }
  }
}
