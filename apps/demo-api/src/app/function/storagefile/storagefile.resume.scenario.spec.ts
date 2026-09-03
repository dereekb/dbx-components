import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { type CreateStorageFileSignedUploadUrlParams, type CreateStorageFileSignedUploadUrlResult, type NotificationKey, type StorageFileDocument, StorageFileProcessingState, StorageFileState, type StoragePath, onCallCreateModelParams, storageFileIdentity } from '@dereekb/firebase';
import { OpenRouterRunTaskState, openRouterPromptVersionId } from '@dereekb/openrouter/firebase';
import { openRouterRunTaskSweep } from '@dereekb/openrouter/firebase-server';
import { DEMO_RESUME_CHECK_PROMPT_KEY, DEMO_RESUME_CHECK_PROMPT_VERSION, ProfileResumeState, USER_RESUME_FILE_PURPOSE, type UserResumeFileMetadata, userResumeFileUploadsFilePath } from 'demo-firebase';
import { demoResumeCheckRunTaskKey } from '../../common/model/notification/handlers/storagefile/task.handler.storagefile.resume';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

/**
 * Set to run the `live` block against the real API. Every other block runs against the emulator alone
 * and needs no credentials — the same gate the openrouter package's own live block uses.
 */
const OPENROUTER_LIVE_API_KEY = process.env['OPENROUTER_API_KEY'];

/**
 * Builds a tiny PDF in-test.
 *
 * Generated rather than committed: the resume upload policy caps at 10 KB (small enough to carry inline
 * as base64 on every attempt) and the repo's only resume fixture is 87 KB. A generated one also makes
 * the "obviously not a resume" counterpart free.
 *
 * @param lines - The text to draw, one line per entry.
 * @returns The PDF bytes.
 */
async function makeTestPdf(lines: string[]): Promise<Buffer> {
  const document = await PDFDocument.create();
  const page = document.addPage([420, 600]);
  const font = await document.embedFont(StandardFonts.Helvetica);

  lines.forEach((text, i) => {
    page.drawText(text, { x: 24, y: 560 - i * 18, size: 11, font });
  });

  return Buffer.from(await document.save());
}

const RESUME_PDF_LINES = [
  'Jane Doe',
  'Senior Software Engineer',
  'jane.doe@example.com',
  '',
  'EXPERIENCE',
  'Acme Corp - Staff Engineer (2021-2026)',
  'Globex - Software Engineer (2018-2021)',
  '',
  'EDUCATION',
  'B.S. Computer Science, State University, 2018',
  '',
  'SKILLS',
  'TypeScript, Node.js, Firebase, Distributed Systems'
];

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('storagefile.resume', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserAdminContext({ f }, (au) => {
      demoProfileContext({ f, u: au }, (p) => {
        /**
         * Uploads a PDF to the user's single resume upload slot.
         */
        async function uploadResumePdf(lines: string[]): Promise<StoragePath> {
          const bytes = await makeTestPdf(lines);
          expect(bytes.length).toBeLessThan(10 * 1024); // the upload policy's cap

          const file = f.storageContext.file(userResumeFileUploadsFilePath(au.uid));
          await file.upload(bytes, { contentType: 'application/pdf' });

          return { bucketId: file.storagePath.bucketId, pathString: file.storagePath.pathString };
        }

        /**
         * Uploads a resume and initializes it, yielding its StorageFile.
         */
        async function uploadAndInitialize(lines: string[] = RESUME_PDF_LINES): Promise<StorageFileDocument> {
          const uploadedFilePath = await uploadResumePdf(lines);
          const initialize = await f.storageFileServerActions.initializeStorageFileFromUpload({ bucketId: uploadedFilePath.bucketId, pathString: uploadedFilePath.pathString });

          return initialize();
        }

        /**
         * Publishes the app's prompt definitions to the store.
         *
         * Package logic now: the definitions the prompt service resolves against carry everything the
         * stored prompt needs, so there is nothing app-shaped left to write.
         */
        async function seedPrompts() {
          return f.openRouterPromptServerActions.seedOpenRouterPrompts({});
        }

        /**
         * Uploads a resume, initializes it, and drives it into PROCESSING with its notification task queued.
         *
         * Deliberately does NOT seed: a caller that wants the stored prompt seeds first, and the one
         * that does not is what covers resolution falling back to the code definition.
         */
        async function uploadAndBeginProcessing(lines: string[] = RESUME_PDF_LINES) {
          const storageFileDocument = await uploadAndInitialize(lines);

          const processAll = await f.storageFileServerActions.processAllQueuedStorageFiles({});
          await processAll();

          return storageFileDocument;
        }

        /**
         * Runs one pass of the notification queue.
         */
        async function runNotificationTasks() {
          const sendQueuedNotifications = await f.notificationServerActions.sendQueuedNotifications({});
          return sendQueuedNotifications();
        }

        /**
         * Clears the throttle a pass leaves on the file's processing task.
         *
         * Every run of a notification task pushes its `sat` out by
         * NOTIFICATION_TASK_MINIMUM_SET_AT_THROTTLE_TIME_MINUTES, which is what stops the queue looping on
         * a task it just ran. In a test that means back-to-back passes only ever execute the first
         * subtask, so the clock is wound back by hand between them.
         */
        async function clearProcessingTaskThrottle(storageFileDocument: StorageFileDocument) {
          const storageFile = await assertSnapshotData(storageFileDocument);
          const notificationDocument = f.demoFirestoreCollections.notificationCollectionGroup.documentAccessor().loadDocumentForKey(storageFile.pn as NotificationKey);

          await notificationDocument.update({ sat: new Date() });
        }

        describe('resume storage file', () => {
          it('should initialize an uploaded resume and queue it for processing', async () => {
            await seedPrompts();

            const storageFileDocument = await uploadAndInitialize();

            const storageFile = await assertSnapshotData(storageFileDocument);
            expect(storageFile.p).toBe(USER_RESUME_FILE_PURPOSE);
            expect(storageFile.ps).toBe(StorageFileProcessingState.QUEUED_FOR_PROCESSING);

            // The upload initializer opens the Profile's resume tracking, which is what the profile view
            // renders — the StorageFile itself is not client-readable.
            const profile = await assertSnapshotData(p.document);
            expect(profile.resume.storageFile).toBe(storageFileDocument.key);
            expect(profile.resume.state).toBe(ProfileResumeState.CHECKING);
            expect(profile.resume.uploadedAt).toBeDefined();
            expect(profile.resume.checkedAt).toBeFalsy();
          });

          it('should replace and mark the previous resume for deletion when a new one is uploaded', async () => {
            const previousStorageFileDocument = await uploadAndInitialize();
            const previousPathString = (await assertSnapshotData(previousStorageFileDocument)).pathString;

            const newStorageFileDocument = await uploadAndInitialize();
            const newStorageFile = await assertSnapshotData(newStorageFileDocument);

            // The destination is timestamped rather than fixed, so the replacement never lands on the
            // superseded file's object — which is what makes flagging the previous one safe to sweep.
            expect(newStorageFile.pathString).not.toBe(previousPathString);
            expect(newStorageFile.fs).toBe(StorageFileState.OK);
            expect(newStorageFile.sdat).not.toBeDefined();

            const previousStorageFile = await assertSnapshotData(previousStorageFileDocument);
            expect(previousStorageFile.fs).toBe(StorageFileState.QUEUED_FOR_DELETE);
            expect(previousStorageFile.sdat).toBeDefined();
            expect(previousStorageFile.sdat).toBeBefore(new Date());

            // The Profile points at the replacement.
            const profile = await assertSnapshotData(p.document);
            expect(profile.resume.storageFile).toBe(newStorageFileDocument.key);

            const deleteInstance = await f.storageFileServerActions.deleteAllQueuedStorageFiles({});
            const deleteResult = await deleteInstance();

            expect(deleteResult.storageFilesDeleted).toBeGreaterThanOrEqual(1);
            expect(await previousStorageFileDocument.exists()).toBe(false);

            // The point of the whole exercise: the sweep resolves the object to delete from the
            // superseded document's own path, so the live resume must have survived it.
            expect(await newStorageFileDocument.exists()).toBe(true);
            expect(await f.storageContext.file(newStorageFile).exists()).toBe(true);
          });

          it('should seed the resume-check prompt at the version the code declares, idempotently', async () => {
            const first = await seedPrompts();
            const second = await seedPrompts();

            expect(first.considered).toBe(1);
            expect(first.promptsCreated).toBe(1);
            expect(first.versionsPublished).toBe(1);
            expect(first.skipped).toBe(0);

            // A re-seed is a fixed point rather than a step toward convergence: the write address is the
            // number the definition declares, not one allocated from `lv`.
            expect(second.versionsPublished).toBe(0);
            expect(second.upToDate).toBe(1);
            expect(second.skipped).toBe(0);

            const promptDocument = f.demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocumentForId(DEMO_RESUME_CHECK_PROMPT_KEY);
            const prompt = await assertSnapshotData(promptDocument);

            expect(prompt.lv).toBe(DEMO_RESUME_CHECK_PROMPT_VERSION);
            expect(prompt.av).toBe(DEMO_RESUME_CHECK_PROMPT_VERSION);

            // The version an allocating seeder would have minted instead. Its absence is what closes the
            // gap that used to leave the store permanently one deploy behind the code.
            const firstVersion = await f.demoFirestoreCollections.openRouterPromptVersionCollectionFactory(promptDocument).documentAccessor().loadDocumentForId(openRouterPromptVersionId(1)).snapshotData();
            expect(firstVersion).toBeUndefined();
          });

          it('should enqueue an OpenRouterRunTask carrying only the object path', async () => {
            await seedPrompts();

            const storageFileDocument = await uploadAndBeginProcessing();

            const processing = await assertSnapshotData(storageFileDocument);
            expect(processing.ps).toBe(StorageFileProcessingState.PROCESSING);
            expect(processing.pn).toBeDefined();

            await runNotificationTasks();

            const runTask = await f.demoFirestoreCollections.openRouterRunTaskCollection.documentAccessor().loadDocumentForId(demoResumeCheckRunTaskKey(storageFileDocument.id)).snapshotData();

            expect(runTask).toBeDefined();
            expect(runTask?.pk).toBe(DEMO_RESUME_CHECK_PROMPT_KEY);
            // The STORED version, which now carries the number the definition declares — the seed pins
            // rather than allocates, so the two no longer disagree. Asserted against the constant so a
            // config change that bumps the version does not have to be mirrored here.
            expect(runTask?.pv).toBe(DEMO_RESUME_CHECK_PROMPT_VERSION);
            expect(runTask?.s).toBe(OpenRouterRunTaskState.QUEUED);
            expect(runTask?.fp).toHaveLength(1);
            expect(runTask?.fp?.[0].storagePath).toBe(processing.pathString);
            expect(runTask?.fp?.[0].filename).toBe('resume.pdf');

            // Neither transport is persisted: a url would be expired by the time anything read it back,
            // and inline base64 is the whole file on a document with a 1 MiB ceiling.
            const stored = JSON.stringify(runTask?.fp);
            expect(stored).not.toContain('base64');
            expect(stored).not.toContain('http');
          });

          it('should enqueue against the code definition when nothing has been seeded', async () => {
            const storageFileDocument = await uploadAndBeginProcessing();

            await runNotificationTasks();

            const runTask = await f.demoFirestoreCollections.openRouterRunTaskCollection.documentAccessor().loadDocumentForId(demoResumeCheckRunTaskKey(storageFileDocument.id)).snapshotData();

            // No prompt document exists at all, so the definition is the only thing that can serve —
            // which is the path that lets a fresh emulator run a resume check without a seed first.
            expect(await f.demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocumentForId(DEMO_RESUME_CHECK_PROMPT_KEY).snapshotData()).toBeUndefined();
            expect(runTask?.pk).toBe(DEMO_RESUME_CHECK_PROMPT_KEY);
            expect(runTask?.pv).toBe(DEMO_RESUME_CHECK_PROMPT_VERSION);
          });

          it('should delay rather than fail when the run is still queued', async () => {
            await seedPrompts();

            const storageFileDocument = await uploadAndBeginProcessing();

            await runNotificationTasks();
            await runNotificationTasks();

            // The run was never swept, so nothing has produced a verdict — and the file must still be
            // mid-processing rather than failed.
            const storageFile = await assertSnapshotData(storageFileDocument);
            expect(storageFile.ps).toBe(StorageFileProcessingState.PROCESSING);
            expect(storageFile.d).toBeUndefined();
            expect(storageFile.pn).toBeDefined();
          });

          it('should land the verdict on the StorageFile and the Profile once the run completes', async () => {
            await seedPrompts();

            const storageFileDocument = await uploadAndBeginProcessing();

            // `send` — enqueues the run.
            await runNotificationTasks();

            // Stands in for the sweep. The emulator never calls OpenRouter, so the run is completed by
            // hand and `retrieve` is left to do the part under test.
            const runTaskDocument = f.demoFirestoreCollections.openRouterRunTaskCollection.documentAccessor().loadDocumentForId(demoResumeCheckRunTaskKey(storageFileDocument.id));
            await runTaskDocument.update({ s: OpenRouterRunTaskState.COMPLETE, o: '{"isResume": true, "reason": "It lists work history and education."}' });

            // `retrieve`
            await clearProcessingTaskThrottle(storageFileDocument);
            await runNotificationTasks();

            const storageFile = await assertSnapshotData(storageFileDocument);
            expect((storageFile.d as UserResumeFileMetadata).isResume).toBe(true);

            // The verdict reaches the Profile, which is what the profile view actually renders.
            const profile = await assertSnapshotData(p.document);
            expect(profile.resume.state).toBe(ProfileResumeState.CHECKED);
            expect(profile.resume.isResume).toBe(true);
            expect(profile.resume.reason).toBe('It lists work history and education.');
            expect(profile.resume.checkedAt).toBeDefined();

            // ...without dropping what the upload initializer put there.
            expect(profile.resume.storageFile).toBe(storageFileDocument.key);
            expect(profile.resume.uploadedAt).toBeDefined();
          });

          describe('signedUploadUrl', () => {
            const callCreateSignedUploadUrl = (data: CreateStorageFileSignedUploadUrlParams) => au.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(storageFileIdentity, data, 'signedUploadUrl')) as Promise<CreateStorageFileSignedUploadUrlResult>;

            it('returns an upload url that targets the resume upload path', async () => {
              const result = await callCreateSignedUploadUrl({
                purpose: USER_RESUME_FILE_PURPOSE,
                contentType: 'application/pdf',
                fileSizeBytes: 2048
              });

              expect(result.uploadPath).toBe(userResumeFileUploadsFilePath(au.uid));
              expect(result.purpose).toBe(USER_RESUME_FILE_PURPOSE);
              expect(result.maxFileSizeBytes).toBe(10 * 1024);
            });

            it('ignores a supplied filename, since the resume has a single fixed slot', async () => {
              const result = await callCreateSignedUploadUrl({
                purpose: USER_RESUME_FILE_PURPOSE,
                contentType: 'application/pdf',
                filename: 'my-latest-resume.pdf',
                fileSizeBytes: 2048
              });

              expect(result.uploadPath).toBe(userResumeFileUploadsFilePath(au.uid));
            });

            itShouldFail('with FILE_TOO_LARGE when the file exceeds the 10kb inline cap', async () => {
              await expectFail(
                () =>
                  callCreateSignedUploadUrl({
                    purpose: USER_RESUME_FILE_PURPOSE,
                    contentType: 'application/pdf',
                    fileSizeBytes: 64 * 1024
                  }),
                expectFailAssertHttpErrorServerErrorCode('FILE_TOO_LARGE')
              );
            });

            itShouldFail('with INVALID_CONTENT_TYPE for anything but application/pdf', async () => {
              await expectFail(
                () =>
                  callCreateSignedUploadUrl({
                    purpose: USER_RESUME_FILE_PURPOSE,
                    contentType: 'text/plain',
                    fileSizeBytes: 1024
                  }),
                expectFailAssertHttpErrorServerErrorCode('INVALID_CONTENT_TYPE')
              );
            });
          });

          // MARK: The live block — the only thing that proves inline base64 reaches a real model
          describe.skipIf(!OPENROUTER_LIVE_API_KEY)('live', () => {
            it('should land the model verdict on the StorageFile', async () => {
              await seedPrompts();

              const storageFileDocument = await uploadAndBeginProcessing();

              // `send`
              await runNotificationTasks();

              // Drain the queue for real. Inside the emulator the file goes on the wire as inline base64,
              // because the environment service reports a testing env — a signed url here would point at
              // localhost and OpenRouter would fetch nothing.
              const sweep = await openRouterRunTaskSweep({ service: f.openRouterRunTaskService, pageSize: 5 });
              expect(sweep.executed).toBe(1);

              const runTask = await f.demoFirestoreCollections.openRouterRunTaskCollection.documentAccessor().loadDocumentForId(demoResumeCheckRunTaskKey(storageFileDocument.id)).snapshotData();
              expect(runTask?.s, `The live run did not complete: ${JSON.stringify(runTask?.e)}`).toBe(OpenRouterRunTaskState.COMPLETE);
              expect(runTask?.o).toBeTruthy();

              // `retrieve` — the run is already COMPLETE, so it lands the verdict on its first look rather
              // than parking for a sweep interval. The throttle is wound back first for the same reason
              // the emulator block does it: `send` already ran this pass, and a live inference takes
              // seconds where the throttle is a minute.
              await clearProcessingTaskThrottle(storageFileDocument);
              await runNotificationTasks();

              // Cleanup, which is what moves the file to SUCCESS. A separate pass on purpose: the
              // processor does not set `canRunNextCheckpoint`, so completing the last subtask advances to
              // the cleanup checkpoint without running it.
              await clearProcessingTaskThrottle(storageFileDocument);
              await runNotificationTasks();

              const storageFile = await assertSnapshotData(storageFileDocument);
              expect(storageFile.ps).toBe(StorageFileProcessingState.SUCCESS);

              const metadata = storageFile.d as UserResumeFileMetadata;
              expect(metadata).toBeDefined();
              expect(metadata.isResume).toBe(true);
              expect(metadata.checkedAt).toBeDefined();

              const profile = await assertSnapshotData(p.document);
              expect(profile.resume.state).toBe(ProfileResumeState.CHECKED);
              expect(profile.resume.isResume).toBe(true);
            }, 180_000);
          });
        });
      });
    });
  });
});
