import { RawBody, type RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, Inject, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { OpenAIWebhookService } from './webhook.openai.service';

@Controller('/webhook/openai')
export class OpenAIWebhookController {
  private readonly _openaiWebhookService: OpenAIWebhookService;

  constructor(@Inject(OpenAIWebhookService) openaiWebhookService: OpenAIWebhookService) {
    this._openaiWebhookService = openaiWebhookService;
  }

  @Post()
  async handleOpenAIWebhook(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer) {
    await this._openaiWebhookService.updateForWebhook(req, rawBody);
  }
}
