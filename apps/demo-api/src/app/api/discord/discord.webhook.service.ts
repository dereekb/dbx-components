import { catchAllHandlerKey } from '@dereekb/util';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DiscordWebhookService, type UntypedDiscordInteraction } from '@dereekb/nestjs/discord';

@Injectable()
export class DemoApiDiscordWebhookService {
  private readonly _discordWebhookService: DiscordWebhookService;

  private readonly logger = new Logger('DemoApiDiscordWebhookService');

  constructor(@Inject(DiscordWebhookService) discordWebhookService: DiscordWebhookService) {
    this._discordWebhookService = discordWebhookService;

    discordWebhookService.configure(this, (x) => {
      x.set(catchAllHandlerKey(), this.logHandledInteraction);
    });
  }

  get discordWebhookService() {
    return this._discordWebhookService;
  }

  logHandledInteraction(interaction: UntypedDiscordInteraction) {
    this.logger.log('Received Discord interaction: ', interaction.type);
  }
}
