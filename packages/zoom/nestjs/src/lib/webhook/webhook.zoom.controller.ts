import { RawBody, RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ZoomWebhookService } from './webhook.zoom.service';

@Controller('/webhook/zoom')
export class ZoomWebhookController {
  readonly zoomWebhookService: ZoomWebhookService;

  constructor(zoomWebhookService: ZoomWebhookService) {
    this.zoomWebhookService = zoomWebhookService;
  }

  @Post()
  async handleZoomWebhook(@Res() res: Response, @Req() req: Request, @RawBody() rawBody: RawBodyBuffer): Promise<void> {
    const { validationEventResponse } = await this.zoomWebhookService.updateForWebhook(req, rawBody);

    if (validationEventResponse) {
      res.json(validationEventResponse);
    } else {
      res.json({});
    }

    res.status(200);
  }
}
