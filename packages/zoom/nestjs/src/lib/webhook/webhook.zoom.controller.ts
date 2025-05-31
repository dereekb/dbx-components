import { RawBody, RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ZoomWebhookService } from './webhook.zoom.service';

@Controller('/webhook/zoom')
export class ZoomWebhookController {
  readonly zoomWebhookService: ZoomWebhookService;

  constructor(zoomWebhookService: ZoomWebhookService) {
    this.zoomWebhookService = zoomWebhookService;
  }

  @Post()
  async handleZoomWebhook(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer) {
    await this.zoomWebhookService.updateForWebhook(req, rawBody);
  }
}
