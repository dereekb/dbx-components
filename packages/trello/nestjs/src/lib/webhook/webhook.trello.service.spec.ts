import { createHmac } from 'node:crypto';
import { type Request } from 'express';
import { Module, type DynamicModule } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRELLO_WEBHOOK_CREATE_CARD_ACTION_TYPE, TRELLO_WEBHOOK_COMMENT_CARD_ACTION_TYPE } from './webhook.trello';
import { TrelloWebhookServiceConfig } from './webhook.trello.config';
import { TrelloWebhookService } from './webhook.trello.service';
import { type TrelloWebhookCardActionData, type TrelloWebhookCommentCardActionData } from './webhook.trello.type';

const APP_SECRET = 'test-app-secret';
const CALLBACK_URL = 'https://example.com/webhook/trello';

function signRawBody(rawBody: Buffer): string {
  const hmac = createHmac('sha1', APP_SECRET);
  hmac.update(rawBody);
  hmac.update(CALLBACK_URL);
  return hmac.digest('base64');
}

function makeRequest(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

function makeWebhookPayload(actionType: string, actionData: object) {
  return {
    action: {
      id: 'action-id',
      type: actionType,
      date: '2026-05-16T00:00:00Z',
      idMemberCreator: 'member-id',
      data: actionData
    },
    model: { id: 'model-id' },
    webhook: {
      id: 'webhook-id',
      idModel: 'model-id',
      callbackURL: CALLBACK_URL,
      description: '',
      active: true
    }
  };
}

@Module({
  exports: [TrelloWebhookService],
  providers: [
    {
      provide: TrelloWebhookServiceConfig,
      useValue: {
        webhookConfig: { appSecret: APP_SECRET, callbackUrl: CALLBACK_URL }
      } satisfies TrelloWebhookServiceConfig
    },
    TrelloWebhookService
  ]
})
class TestTrelloWebhookModule {}

describe('TrelloWebhookService', () => {
  let nest: TestingModule;
  let service: TrelloWebhookService;

  beforeEach(async () => {
    const rootModule: DynamicModule = {
      module: TestTrelloWebhookModule,
      global: true
    };

    nest = await Test.createTestingModule({
      imports: [rootModule]
    }).compile();

    service = nest.get(TrelloWebhookService);
  });

  it('is provided', () => {
    expect(service).toBeDefined();
  });

  describe('updateForWebhook()', () => {
    it('returns valid=false when the signature is missing', async () => {
      const payload = makeWebhookPayload(TRELLO_WEBHOOK_CREATE_CARD_ACTION_TYPE, { card: { id: 'c' }, board: { id: 'b' } });
      const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');

      const result = await service.updateForWebhook(makeRequest({}), rawBody);

      expect(result.valid).toBe(false);
      expect(result.handled).toBe(false);
    });

    it('returns valid=true and dispatches to a registered handler for matching action type', async () => {
      const handler = vi.fn().mockResolvedValue(true);
      const bindTarget = {};
      service.configure(bindTarget, (c) => {
        c.handleCreateCard(async (event) => {
          handler(event);
          return true;
        });
      });

      const actionData: TrelloWebhookCardActionData = {
        card: { id: 'card-id', name: 'My Card' },
        board: { id: 'board-id', name: 'My Board' }
      };
      const payload = makeWebhookPayload(TRELLO_WEBHOOK_CREATE_CARD_ACTION_TYPE, actionData);
      const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
      const signature = signRawBody(rawBody);

      const result = await service.updateForWebhook(makeRequest({ 'x-trello-webhook': signature }), rawBody);

      expect(result.valid).toBe(true);
      expect(result.handled).toBe(true);
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].action.type).toBe(TRELLO_WEBHOOK_CREATE_CARD_ACTION_TYPE);
    });

    it('routes commentCard events to handleCommentCard', async () => {
      let receivedText: string | undefined;
      const bindTarget = {};
      service.configure(bindTarget, (c) => {
        c.handleCommentCard(async (event) => {
          receivedText = event.action.data.text;
          return true;
        });
      });

      const actionData: TrelloWebhookCommentCardActionData = {
        card: { id: 'c' },
        board: { id: 'b' },
        text: 'Hello world'
      };
      const payload = makeWebhookPayload(TRELLO_WEBHOOK_COMMENT_CARD_ACTION_TYPE, actionData);
      const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
      const signature = signRawBody(rawBody);

      const result = await service.updateForWebhook(makeRequest({ 'x-trello-webhook': signature }), rawBody);

      expect(result.valid).toBe(true);
      expect(result.handled).toBe(true);
      expect(receivedText).toBe('Hello world');
    });

    it('returns handled=false when no handler is registered for the action type', async () => {
      const payload = makeWebhookPayload('updateBoard', { board: { id: 'b' } });
      const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
      const signature = signRawBody(rawBody);

      const result = await service.updateForWebhook(makeRequest({ 'x-trello-webhook': signature }), rawBody);

      expect(result.valid).toBe(true);
      expect(result.handled).toBe(false);
      expect(result.event?.action.type).toBe('updateBoard');
    });
  });
});
