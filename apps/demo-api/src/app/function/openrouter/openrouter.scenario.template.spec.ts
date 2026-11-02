import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type E164PhoneNumber, type Maybe } from '@dereekb/util';
import { type NotificationMessage, type OnCallCreateModelResult, NotificationSendState, createNotificationDocument, firestoreModelKey, notificationUserIdentity, onCallCreateModelParams, onCallInvokeModelParams, onCallUpdateModelParams } from '@dereekb/firebase';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { type NotificationTextSendService } from '@dereekb/firebase-server/model';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { OpenRouterApi } from '@dereekb/nestjs/openrouter';
import { type OpenRouterTemplateTypeKey } from '@dereekb/openrouter';
import { type CreateOpenRouterPromptVersionResult, type PreviewOpenRouterTemplateResult, OPENROUTER_TEMPLATE_TEXT_NOTIFICATION_TEMPLATE_TYPE, OpenRouterPromptState, createOpenRouterTemplateTextNotificationTemplate, openRouterPromptIdentity, openRouterPromptVersionIdentity } from '@dereekb/openrouter/firebase';
import { OPENROUTER_TEMPLATE_SERVICE_TOKEN, type OpenRouterTemplateService } from '@dereekb/openrouter/firebase-server';
import { DEMO_PROFILE_ANNOUNCEMENT_TEXT_TEMPLATE_TYPE, DEMO_PROFILE_TEXT_TEMPLATE_TYPE } from 'demo-firebase';
import { DEMO_API_TEST_OPENROUTER_MODEL_CONFIG, type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoNotificationBoxContext, demoNotificationUserContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

/**
 * Message templates end to end in the demo app: authored over callModel, then sent as template-text notifications.
 *
 * The openrouter package's emulator spec proves the template service and its actions in-process. What only the app can
 * prove is the wiring around them: the callModel operations, the template service the app builds from its profile
 * context factories, the template-text notification type it registers, and the notification send loop's recipient limit.
 *
 * Nothing reaches OpenRouter. The app's own client is answered locally (see {@link installFakeOpenRouter}), and texts go
 * to a capturing text send service instead of the ignoring one the test environment configures.
 */

const PHONE_NUMBER_A: E164PhoneNumber = '+12085550101';
const PHONE_NUMBER_B: E164PhoneNumber = '+12085550102';

const PROFILE_USERNAME = 'jordan';

/**
 * The username in the demo profile types' sample accessor data, which a preview renders with by default.
 */
const SAMPLE_PROFILE_USERNAME = 'ana';

const PROFILE_TEXT_SCRIPT = `const profile = await context.accessor.profile();\nreturn 'Hi ' + profile.username + '! Your demo profile is ready.';`;
const PROFILE_TEXT_BODY = `Hi ${PROFILE_USERNAME}! Your demo profile is ready.`;
const SAMPLE_PROFILE_TEXT_BODY = `Hi ${SAMPLE_PROFILE_USERNAME}! Your demo profile is ready.`;

/**
 * Returns null, which means "no message", when the profile has no bio.
 */
const PROFILE_BIO_SCRIPT = `const profile = await context.accessor.profile();\nif (!profile.bio) { return null; }\nreturn 'Your bio: ' + profile.bio;`;

const ANNOUNCEMENT_SCRIPT = `const profile = await context.accessor.profile();\nreturn { openRouter: { input: 'Announce that ' + profile.username + ' updated their profile.' } };`;
const ANNOUNCEMENT_FINAL_SCRIPT = `return 'Demo news: ' + context.output.text;`;

/**
 * Reads the notification the template is rendered for.
 */
const NOTIFICATION_SCRIPT = `return context.notification ? 'Sent for ' + context.notification.templateType : null;`;
const ANNOUNCEMENT_MODEL_TEXT = `${PROFILE_USERNAME} updated their profile today.`;
const ANNOUNCEMENT_BODY = `Demo news: ${ANNOUNCEMENT_MODEL_TEXT}`;

// MARK: Fake OpenRouter
/**
 * The app's OpenRouter client, answered locally for one test.
 */
interface DemoFakeOpenRouter {
  /**
   * Text the fake model replies with.
   */
  modelText: string;
  /**
   * Every request url sent, in order.
   */
  readonly urls: string[];
  /**
   * Number of model (`/responses`) calls made.
   */
  readonly modelCallCount: number;
  /**
   * Puts the client's own fetcher back.
   */
  restore(): void;
}

type DemoFakeOpenRouterFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const FAKE_OPENROUTER_SYSTEM_ONE_PATH = '/systemone';

/**
 * A `DecisionsResponse` body in the wire shape, answering every question the request declared as unflagged.
 *
 * The template review is a System One decision, so this is what a clean review of an uploaded script looks like.
 *
 * @param body - The decision request body.
 * @param index - The call ordinal.
 * @returns The response body.
 */
function fakeOpenRouterReviewResponseBody(body: Record<string, unknown>, index: number): Record<string, unknown> {
  const answers: Record<string, unknown> = {};

  Object.keys((body['questions'] as Maybe<Record<string, unknown>>) ?? {}).forEach((id) => {
    answers[id] = { type: 'noul', noul: 0.02 };
  });

  return {
    id: `gen_dec_${index}`,
    model: 'typesafe/jev-1.13-20260917',
    provider: 'TypeSafe',
    answers,
    usage: { input_tokens: 100, output_tokens: 20, cost: 0.0000042 }
  };
}

/**
 * An `OpenResponsesResult` body in the wire shape, replying with the given text.
 *
 * @param text - The model text.
 * @param index - The call ordinal.
 * @returns The response body.
 */
function fakeOpenRouterModelResponseBody(text: string, index: number): Record<string, unknown> {
  return {
    id: `gen_${index}`,
    object: 'response',
    created_at: 1000 + index,
    completed_at: 1001 + index,
    error: null,
    frequency_penalty: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    model: DEMO_API_TEST_OPENROUTER_MODEL_CONFIG.model,
    output: [{ type: 'message', id: `msg_${index}`, role: 'assistant', status: 'completed', content: [{ type: 'output_text', text }] }],
    parallel_tool_calls: false,
    presence_penalty: null,
    status: 'completed',
    temperature: null,
    tool_choice: 'auto',
    tools: [],
    top_p: null,
    usage: { input_tokens: 11, input_tokens_details: { cached_tokens: 0 }, output_tokens: 7, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 18, cost: 0.001, is_byok: true }
  };
}

/**
 * Answers the app's OpenRouter client locally until restored.
 *
 * The template service holds the client the app built, so the fake swaps that client's fetcher rather than the client. Every
 * other part of the SDK still runs, so the requests and replies cross the SDK's real serialization.
 *
 * @param f - The test context.
 * @returns The fake.
 */
function installFakeOpenRouter(f: DemoApiFunctionContextFixture): DemoFakeOpenRouter {
  const httpClient = f.nest.get(OpenRouterApi).openRouterClient._options.httpClient as unknown as { fetcher: DemoFakeOpenRouterFetcher };
  const originalFetcher = httpClient.fetcher;
  const urls: string[] = [];

  const fake: DemoFakeOpenRouter = {
    modelText: 'Model text.',
    urls,
    get modelCallCount() {
      return urls.filter((x) => !x.endsWith(FAKE_OPENROUTER_SYSTEM_ONE_PATH)).length;
    },
    restore() {
      httpClient.fetcher = originalFetcher;
    }
  };

  httpClient.fetcher = async (input) => {
    const request = input as Request;
    const body = (await request.clone().json()) as Record<string, unknown>;
    const index = urls.length;
    urls.push(request.url);

    const responseBody = request.url.endsWith(FAKE_OPENROUTER_SYSTEM_ONE_PATH) ? fakeOpenRouterReviewResponseBody(body, index) : fakeOpenRouterModelResponseBody(fake.modelText, index);
    return new Response(JSON.stringify(responseBody), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  return fake;
}

// MARK: Captured Texts
/**
 * A text the capturing text send service received.
 */
interface CapturedText {
  readonly to: Maybe<string>;
  readonly body: Maybe<string>;
}

/**
 * Creates a text send service that records every text and reports it sent.
 *
 * The body is the message's `textContent.title`, which is what the Twilio text send service sends for a template message.
 *
 * @param captured - Receives the texts.
 * @returns The text send service.
 */
function capturingTextSendService(captured: CapturedText[]): NotificationTextSendService {
  return {
    async buildSendInstanceForTextNotificationMessages(messages: NotificationMessage[]) {
      return async () => {
        messages.forEach((x) => captured.push({ to: x.inputContext.recipient.t, body: x.textContent?.title }));
        return { success: messages.map((x) => x.inputContext.recipient.t as E164PhoneNumber), failed: [], ignored: [] };
      };
    }
  };
}

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('openrouter.scenario.template', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    let fakeOpenRouter: DemoFakeOpenRouter;
    let templateCount = 0;

    beforeEach(() => {
      fakeOpenRouter = installFakeOpenRouter(f);
    });

    afterEach(() => {
      fakeOpenRouter.restore();
    });

    /**
     * Returns a template key no earlier test used, so a template the prompt service cached for another test is never served.
     *
     * @param prefix - The key prefix.
     * @returns The key.
     */
    function nextTemplateKey(prefix: string): string {
      templateCount += 1;
      return `${prefix}-${templateCount}`;
    }

    demoAuthorizedUserAdminContext({ f }, (u) => {
      interface PublishTemplateInput {
        readonly key: string;
        readonly templateType: OpenRouterTemplateTypeKey;
        readonly script: string;
        readonly finalScript?: Maybe<string>;
        readonly instructions?: Maybe<string>;
        readonly activate?: Maybe<boolean>;
      }

      async function createTemplate(key: string, templateType: OpenRouterTemplateTypeKey): Promise<OnCallCreateModelResult> {
        return (await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(openRouterPromptIdentity, { key, name: key, templateType }, 'template'))) as OnCallCreateModelResult;
      }

      async function uploadVersion(input: PublishTemplateInput): Promise<CreateOpenRouterPromptVersionResult> {
        const { key, script, finalScript, instructions, activate } = input;
        const config = instructions ? (DEMO_API_TEST_OPENROUTER_MODEL_CONFIG as Record<string, unknown>) : undefined;
        return (await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(openRouterPromptVersionIdentity, { prompt: firestoreModelKey(openRouterPromptIdentity, key), script, finalScript, instructions, config, activate }))) as CreateOpenRouterPromptVersionResult;
      }

      async function publishTemplate(input: PublishTemplateInput): Promise<CreateOpenRouterPromptVersionResult> {
        await createTemplate(input.key, input.templateType);
        return uploadVersion({ ...input, activate: true });
      }

      function templateService(): OpenRouterTemplateService {
        return f.nest.get<OpenRouterTemplateService>(OPENROUTER_TEMPLATE_SERVICE_TOKEN);
      }

      // MARK: Authoring
      describe('authoring over callModel', () => {
        demoProfileContext({ f, u }, (p) => {
          beforeEach(async () => {
            await p.document.update({ username: PROFILE_USERNAME });
          });

          it('should create a template, upload a reviewed script, preview it and promote it', async () => {
            const key = nextTemplateKey('profile-text');

            const promptKey = firestoreModelKey(openRouterPromptIdentity, key);

            const created = await createTemplate(key, DEMO_PROFILE_TEXT_TEMPLATE_TYPE);
            expect(created.modelKeys).toEqual([promptKey]);

            const prompt = f.demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocumentForId(key);
            const draft = await assertSnapshotData(prompt);
            expect(draft.tt).toBe(DEMO_PROFILE_TEXT_TEMPLATE_TYPE);
            expect(draft.s).toBe(OpenRouterPromptState.DRAFT);

            // the upload runs the review, which the fake answers as clean
            const uploaded = await uploadVersion({ key, templateType: DEMO_PROFILE_TEXT_TEMPLATE_TYPE, script: PROFILE_TEXT_SCRIPT });
            expect(uploaded.version).toBe(1);
            expect(uploaded.activated).toBe(false);
            expect(uploaded.review?.flagged).toEqual([]);
            expect(fakeOpenRouter.urls.some((x) => x.endsWith(FAKE_OPENROUTER_SYSTEM_ONE_PATH))).toBe(true);

            // the preview runs the stored version with the type's sample accessor data, with no model call
            const preview = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallInvokeModelParams(openRouterPromptIdentity, { key: promptKey, version: 1, data: { profileKey: p.documentKey } }, 'previewTemplate'))) as PreviewOpenRouterTemplateResult;
            expect(preview.valid).toBe(true);
            expect(preview.output?.text).toBe(SAMPLE_PROFILE_TEXT_BODY);
            expect(preview.output?.encoding).toBe('gsm7');
            expect(preview.output?.segments).toBe(1);

            // a draft template only resolves its active version once its state is ACTIVE, so promoting sets both
            await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptIdentity, { key: promptKey, activeVersion: 1, state: OpenRouterPromptState.ACTIVE }));

            const promoted = await assertSnapshotData(prompt);
            expect(promoted.av).toBe(1);
            expect(promoted.s).toBe(OpenRouterPromptState.ACTIVE);

            const rendered = await templateService().renderTemplate({ templateKey: key, data: { profileKey: p.documentKey } });
            expect(rendered.text).toBe(PROFILE_TEXT_BODY);
            expect(fakeOpenRouter.modelCallCount).toBe(0);
          });
        });
      });

      // MARK: Template Text Notifications
      describe('template-text notifications', () => {
        demoProfileContext({ f, u }, (p) => {
          demoNotificationUserContext({ f, u }, (nu) => {
            demoNotificationBoxContext({ f, for: p, createIfNeeded: true, initIfNeeded: true }, (nb) => {
              let capturedTexts: CapturedText[];
              let originalTextSendService: Maybe<NotificationTextSendService>;

              function notificationSendService() {
                return f.notificationSendService as { textSendService?: Maybe<NotificationTextSendService> };
              }

              async function enableTexts(userContext: typeof u, notificationUserKey: string, phoneNumber: E164PhoneNumber): Promise<void> {
                await userContext.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationUserIdentity, { key: notificationUserKey, gc: { t: phoneNumber, configs: [{ type: OPENROUTER_TEMPLATE_TEXT_NOTIFICATION_TEMPLATE_TYPE, st: true }] } }));
              }

              async function sendTemplateTextNotification(templateKey: string) {
                const template = createOpenRouterTemplateTextNotificationTemplate({ templateKey, data: { profileKey: p.documentKey }, notificationModel: p.document });
                const { notificationDocument } = await createNotificationDocument({ template, accessor: f.demoFirestoreCollections.notificationCollectionFactory(nb.document).documentAccessor() });

                const sendNotification = await f.notificationServerActions.sendNotification({ key: notificationDocument.key });
                const result = await sendNotification(notificationDocument);
                const notification = await assertSnapshotData(notificationDocument);

                return { result, notification };
              }

              beforeEach(async () => {
                await p.document.update({ username: PROFILE_USERNAME });
                await enableTexts(u, nu.documentKey, PHONE_NUMBER_A);

                capturedTexts = [];
                originalTextSendService = notificationSendService().textSendService;
                notificationSendService().textSendService = capturingTextSendService(capturedTexts);
              });

              afterEach(() => {
                notificationSendService().textSendService = originalTextSendService;
              });

              describe('single-recipient template', () => {
                it('should text the exact rendered body', async () => {
                  const key = nextTemplateKey('profile-text');
                  await publishTemplate({ key, templateType: DEMO_PROFILE_TEXT_TEMPLATE_TYPE, script: PROFILE_TEXT_SCRIPT });

                  const { result, notification } = await sendTemplateTextNotification(key);

                  expect(result.success).toBe(true);
                  expect(capturedTexts).toEqual([{ to: PHONE_NUMBER_A, body: PROFILE_TEXT_BODY }]);
                  expect(notification.ts).toBe(NotificationSendState.SENT);
                });

                it('should count one person reached by both text and in-app as one recipient, and send', async () => {
                  const key = nextTemplateKey('profile-text');
                  await publishTemplate({ key, templateType: DEMO_PROFILE_TEXT_TEMPLATE_TYPE, script: PROFILE_TEXT_SCRIPT });

                  const { result, notification } = await sendTemplateTextNotification(key);

                  expect(result.sendTextsResult?.success).toEqual([PHONE_NUMBER_A]);
                  expect(result.sendNotificationSummaryResult?.success.length).toBe(1);
                  expect(notification.ts).toBe(NotificationSendState.SENT);
                  expect(notification.ns).toBe(NotificationSendState.SENT);
                });

                it('should render with the notification it is sent for', async () => {
                  const key = nextTemplateKey('profile-notification');
                  await publishTemplate({ key, templateType: DEMO_PROFILE_TEXT_TEMPLATE_TYPE, script: NOTIFICATION_SCRIPT });

                  const { result } = await sendTemplateTextNotification(key);

                  expect(result.success).toBe(true);
                  expect(capturedTexts).toEqual([{ to: PHONE_NUMBER_A, body: `Sent for ${OPENROUTER_TEMPLATE_TEXT_NOTIFICATION_TEMPLATE_TYPE}` }]);
                });

                it('should send nothing when the script returns null', async () => {
                  const key = nextTemplateKey('profile-bio');
                  await publishTemplate({ key, templateType: DEMO_PROFILE_TEXT_TEMPLATE_TYPE, script: PROFILE_BIO_SCRIPT });

                  // the profile has no bio, so the script returns null
                  const { result } = await sendTemplateTextNotification(key);

                  expect(result.success).toBe(true);
                  expect(capturedTexts).toEqual([]);
                  expect(result.sendTextsResult).toBeUndefined();
                  expect(result.sendNotificationSummaryResult).toBeUndefined();
                });
              });

              describe('box with a second subscriber', () => {
                demoAuthorizedUserContext({ f }, (u2) => {
                  demoNotificationUserContext({ f, u: u2 }, (nu2) => {
                    beforeEach(async () => {
                      await nb.updateRecipient({ uid: u2.uid, insert: true });
                      await enableTexts(u2, nu2.documentKey, PHONE_NUMBER_B);
                    });

                    it('should send nothing on any channel for a single-recipient template, and not retry', async () => {
                      const key = nextTemplateKey('profile-text');
                      await publishTemplate({ key, templateType: DEMO_PROFILE_TEXT_TEMPLATE_TYPE, script: PROFILE_TEXT_SCRIPT });

                      const { result, notification } = await sendTemplateTextNotification(key);

                      expect(capturedTexts).toEqual([]);
                      expect(result.sendTextsResult).toBeUndefined();
                      expect(result.sendNotificationSummaryResult).toBeUndefined();
                      expect(notification.es).toBe(NotificationSendState.NO_TRY);
                      expect(notification.ts).toBe(NotificationSendState.NO_TRY);
                      expect(notification.ns).toBe(NotificationSendState.NO_TRY);
                    });

                    it('should give both text recipients the identical body of a multi-recipient template, rendering it once', async () => {
                      const key = nextTemplateKey('profile-announcement');
                      await publishTemplate({ key, templateType: DEMO_PROFILE_ANNOUNCEMENT_TEXT_TEMPLATE_TYPE, script: ANNOUNCEMENT_SCRIPT, finalScript: ANNOUNCEMENT_FINAL_SCRIPT, instructions: 'Write a one sentence announcement.' });

                      const accessors = templateService().typeConfigService.configForTemplateType(DEMO_PROFILE_ANNOUNCEMENT_TEXT_TEMPLATE_TYPE).contextFactory?.accessors;
                      expect(accessors).toBeDefined();
                      const loadSpy = vi.spyOn(accessors as NonNullable<typeof accessors>, 'profile');

                      fakeOpenRouter.modelText = ANNOUNCEMENT_MODEL_TEXT;
                      const modelCallsBeforeSend = fakeOpenRouter.modelCallCount;

                      const { result, notification } = await sendTemplateTextNotification(key);

                      expect(result.success).toBe(true);
                      expect(capturedTexts).toHaveLength(2);
                      expect(capturedTexts.map((x) => x.to)).toEqual(expect.arrayContaining([PHONE_NUMBER_A, PHONE_NUMBER_B]));
                      capturedTexts.forEach((x) => expect(x.body).toBe(ANNOUNCEMENT_BODY));
                      expect(notification.ts).toBe(NotificationSendState.SENT);

                      expect(loadSpy).toHaveBeenCalledTimes(1);
                      expect(fakeOpenRouter.modelCallCount - modelCallsBeforeSend).toBe(1);

                      loadSpy.mockRestore();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
