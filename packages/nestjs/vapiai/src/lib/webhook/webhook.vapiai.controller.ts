import { RawBody, RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { VapiAiWebhookService } from './webhook.vapiai.service';

@Controller('/webhook/vapiai')
export class VapiAiWebhookController {
  private readonly _vapiaiWebhookService: VapiAiWebhookService;

  constructor(vapiaiWebhookService: VapiAiWebhookService) {
    this._vapiaiWebhookService = vapiaiWebhookService;
  }

  @Post()
  async handleVapiAiWebhook(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer) {
    await this._vapiaiWebhookService.updateForWebhook(req, rawBody);
  }
}
