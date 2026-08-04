import { RawBody, type RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, Inject, Post, Req } from '@nestjs/common';
import { type Request } from 'express';
import { DiscordWebhookService } from './webhook.discord.service';

@Controller('/webhook/discord')
export class DiscordWebhookController {
  private readonly _discordWebhookService: DiscordWebhookService;

  constructor(@Inject(DiscordWebhookService) discordWebhookService: DiscordWebhookService) {
    this._discordWebhookService = discordWebhookService;
  }

  @Post()
  async handleDiscordWebhook(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer) {
    await this._discordWebhookService.updateForWebhook(req, rawBody);
  }
}
