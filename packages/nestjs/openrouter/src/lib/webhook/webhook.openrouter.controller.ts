import { Body, Controller, Inject, Post, Put, Req, UnauthorizedException } from '@nestjs/common';
import { type Request } from 'express';
import { OpenRouterWebhookService } from './webhook.openrouter.service';

/**
 * Controller for incoming OpenRouter broadcast webhook requests.
 *
 * OpenRouter can be configured to deliver broadcast traces via POST (default) or PUT, so both
 * verbs are handled. Authentication is a user-configured header carrying a shared secret, so a
 * plain `@Body()` (parsed JSON) is sufficient — no raw-body middleware is required.
 */
@Controller('/webhook/openrouter')
export class OpenRouterWebhookController {
  private readonly _openrouterWebhookService: OpenRouterWebhookService;

  constructor(@Inject(OpenRouterWebhookService) openrouterWebhookService: OpenRouterWebhookService) {
    this._openrouterWebhookService = openrouterWebhookService;
  }

  @Post()
  async handleOpenRouterWebhookPost(@Req() req: Request, @Body() body: unknown) {
    await this.handleOpenRouterWebhook(req, body);
  }

  @Put()
  async handleOpenRouterWebhookPut(@Req() req: Request, @Body() body: unknown) {
    await this.handleOpenRouterWebhook(req, body);
  }

  private async handleOpenRouterWebhook(req: Request, body: unknown): Promise<void> {
    const result = await this._openrouterWebhookService.updateForWebhook(req, body);

    if (!result.valid) {
      throw new UnauthorizedException('Invalid OpenRouter webhook token.');
    }
  }
}
