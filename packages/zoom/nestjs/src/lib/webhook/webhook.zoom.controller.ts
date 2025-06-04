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
    const { valid, validationEventResponse } = await this.zoomWebhookService.updateForWebhook(req, rawBody);

    let response = res.status(200); // always return a 200 status code

    if (valid && validationEventResponse) {
      response.json(validationEventResponse);
    } else {
      response.json({});
    }
  }
}
