import { RawBody, RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { TypeformWebhookService } from './webhook.typeform.service';

@Controller('/webhook/typeform')
export class TypeformWebhookController {
  private readonly _typeformWebhookService: TypeformWebhookService;

  constructor(typeformWebhookService: TypeformWebhookService) {
    this._typeformWebhookService = typeformWebhookService;
  }

  @Post()
  async handleTypeformWebhook(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer) {
    await this._typeformWebhookService.updateForWebhook(req, rawBody);
  }
}
