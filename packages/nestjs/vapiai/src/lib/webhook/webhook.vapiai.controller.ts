import { RawBody, RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { VapiAiWebhookService } from './webhook.vapiai.service';

@Controller('/webhook/vapiai')
export class VapiAiWebhookController {
  private readonly _vapiaiWebhookService: VapiAiWebhookService;

  constructor(vapiaiWebhookService: VapiAiWebhookService) {
    this._vapiaiWebhookService = vapiaiWebhookService;
  }

  @Post()
  async handleVapiAiWebhook(@Res() res: Response, @Req() req: Request, @RawBody() rawBody: RawBodyBuffer): Promise<void> {
    const { valid, response: responseData } = await this._vapiaiWebhookService.updateForWebhook(req, rawBody);

    const response = res.status(200); // always return a 200 status code

    if (valid && responseData) {
      response.json(responseData);
    } else {
      response.json({});
    }
  }
}
