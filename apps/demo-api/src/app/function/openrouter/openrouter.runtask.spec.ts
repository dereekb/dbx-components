import { describe, expect, it } from 'vitest';
import { OpenRouterRunTaskState } from '@dereekb/openrouter/firebase';
import { openRouterFileAttachmentModeForConfig, openRouterFileAttachmentResolver } from '@dereekb/openrouter/firebase-server';
import { DEMO_RESUME_CHECK_PROMPT_KEY, DEMO_RESUME_CHECK_PROMPT_VERSION } from 'demo-firebase';
import { demoApiFunctionContextFactory } from '../../../test/fixture';

/**
 * The openrouter package proves the run task service's own logic against a fake OpenRouter client, a fake
 * storage context, and a stubbed env service — correctly, because those are what let thirty-odd scenarios
 * run with no credentials and no timing races.
 *
 * What a fake cannot answer is whether THIS app's wiring lands on the same behaviour: the env service the
 * module injects, the storage context the emulator hands it, and the definitions the prompt service was
 * built with are all app-shaped, and every one of them is a place the package's stub could be right while
 * the app is wrong. Everything here therefore runs against the real DI-provided services, and none of it
 * needs an API key — the assertions all sit on the near side of the outbound call.
 */

/**
 * Bytes standing in for an uploaded document.
 *
 * Not a real PDF on purpose: the resolver reads bytes and a content type and parses neither, so
 * generating one would only make the fixture slower.
 */
const ATTACHMENT_BYTES = Buffer.from('%PDF-1.7\nstands in for an uploaded document\n');
const ATTACHMENT_BASE64 = ATTACHMENT_BYTES.toString('base64');
const ATTACHMENT_PATH = 'openrouter/attachment-wiring/candidate.pdf';

demoApiFunctionContextFactory((f) => {
  /**
   * Puts a real object in the storage emulator at {@link ATTACHMENT_PATH}.
   */
  async function uploadAttachment(): Promise<void> {
    await f.storageContext.file(ATTACHMENT_PATH).upload(ATTACHMENT_BYTES, { contentType: 'application/pdf' });
  }

  describe('openrouter file attachment', () => {
    it('should select inlineData from the app env service, since a signed url here points at localhost', () => {
      // The regression the gate exists for. The storage emulator cannot sign, so the accessor falls back
      // to a publicUrl() on 127.0.0.1 and OpenRouter answers "Localhost URLs are not allowed" — and the
      // app is the only place that knows which env service is in play.
      expect(openRouterFileAttachmentModeForConfig({ envService: f.envService })).toBe('inlineData');
    });

    it('should inline a real object, reading its bytes and content type back out of storage', async () => {
      // The package asserts this against an in-memory fake whose getBytes/getMetadata are hand-written to
      // the shape the resolver expects. This is the same assertion against the accessor the app actually
      // runs on, which is the only thing that catches the two drifting apart.
      await uploadAttachment();

      const resolve = openRouterFileAttachmentResolver({ storageContext: f.storageContext, envService: f.envService });
      const [attached] = await resolve([{ storagePath: ATTACHMENT_PATH, filename: 'candidate.pdf' }]);

      expect(attached.fileData).toBe(`data:application/pdf;base64,${ATTACHMENT_BASE64}`);
      // No url alongside it: sending both leaves it undefined which one wins, and a url is exactly what
      // does not work here.
      expect(attached.fileUrl).toBeUndefined();
    });
  });

  describe('openrouter run task enqueue', () => {
    it('should resolve the shipped prompt definition with nothing seeded, pinning its version', async () => {
      // demoOpenRouterPromptServiceFactory is what passes the app's definitions into the service. Without
      // them an unseeded environment throws OpenRouterPromptResolutionError, which is classified permanent
      // — so the owning work would have no retry that could ever succeed.
      const result = await f.openRouterRunTaskService.enqueueRunTask({ key: 'wiring_definition_run', promptKey: DEMO_RESUME_CHECK_PROMPT_KEY, input: 'is this a resume?' });

      expect(result.created).toBe(true);
      expect(result.task.s).toBe(OpenRouterRunTaskState.QUEUED);
      expect(result.task.pk).toBe(DEMO_RESUME_CHECK_PROMPT_KEY);
      expect(result.task.pv).toBe(DEMO_RESUME_CHECK_PROMPT_VERSION);
    });

    it('should record the object path on the run task rather than anything derived from it', async () => {
      // `fp` is written once and re-read on every attempt, so both transports have to stay out of it: a
      // signed url would be stale by the second attempt, and inline bytes would put the file into a
      // document with a 1 MiB ceiling and re-pay for it on every read.
      await uploadAttachment();

      const result = await f.openRouterRunTaskService.enqueueRunTask({
        key: 'wiring_file_run',
        promptKey: DEMO_RESUME_CHECK_PROMPT_KEY,
        input: 'is this a resume?',
        files: [{ storagePath: ATTACHMENT_PATH, filename: 'candidate.pdf' }]
      });

      expect(result.task.fp).toEqual([{ storagePath: ATTACHMENT_PATH, filename: 'candidate.pdf' }]);
      expect(JSON.stringify(result.task.fp)).not.toContain(ATTACHMENT_BASE64);
    });
  });
});
