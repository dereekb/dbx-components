import { RawBody, type RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, Head, Inject, Post, Req } from '@nestjs/common';
import { type Request } from 'express';
import { TrelloWebhookService } from './webhook.trello.service';

@Controller('/webhook/trello')
export class TrelloWebhookController {
  readonly trelloWebhookService: TrelloWebhookService;

  constructor(@Inject(TrelloWebhookService) trelloWebhookService: TrelloWebhookService) {
    this.trelloWebhookService = trelloWebhookService;
  }

  /**
   * Endpoint Trello pings with HEAD during webhook registration. Must return 200.
   */
  @Head()
  handleTrelloWebhookHead(): void {
    // Empty body, 200 status.
  }

  @Post()
  async handleTrelloWebhook(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer): Promise<void> {
    await this.trelloWebhookService.updateForWebhook(req, rawBody);
  }
}
