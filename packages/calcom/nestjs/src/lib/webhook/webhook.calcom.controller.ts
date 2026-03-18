import { RawBody, type RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { CalcomWebhookService } from './webhook.calcom.service';

@Controller('/webhook/calcom')
export class CalcomWebhookController {
  readonly calcomWebhookService: CalcomWebhookService;

  constructor(@Inject(CalcomWebhookService) calcomWebhookService: CalcomWebhookService) {
    this.calcomWebhookService = calcomWebhookService;
  }

  @Post()
  async handleCalcomWebhook(@Res() res: Response, @Req() req: Request, @RawBody() rawBody: RawBodyBuffer): Promise<void> {
    const { valid: _valid } = await this.calcomWebhookService.updateForWebhook(req, rawBody);

    const response = res.status(200); // always return a 200 status code
    response.json({});
  }
}
