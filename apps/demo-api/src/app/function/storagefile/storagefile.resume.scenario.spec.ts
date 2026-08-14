import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { type CreateStorageFileSignedUploadUrlParams, type CreateStorageFileSignedUploadUrlResult, type NotificationKey, type StorageFileDocument, StorageFileProcessingState, type StoragePath, onCallCreateModelParams, storageFileIdentity } from '@dereekb/firebase';
import { OpenRouterRunTaskState } from '@dereekb/openrouter/firebase';
import { openRouterRunTaskSweep } from '@dereekb/openrouter/firebase-server';
import { DEMO_RESUME_CHECK_PROMPT_KEY, DEMO_RESUME_CHECK_PROMPT_VERSION, ProfileResumeState, USER_RESUME_FILE_PURPOSE, type UserResumeFileMetadata, userResumeFileUploadsFilePath } from 'demo-firebase';
import { seedDemoOpenRouterPrompts } from '../../common/model/openrouter/openrouter.seed';
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

const RESUME_PDF_LINES = ['Jane Doe', 'Senior Software Engineer', 'jane.doe@example.com', '', 'EXPERIENCE', 'Acme Corp - Staff Engineer (2021-2026)', 'Globex - Software Engineer (2018-2021)', '', 'EDUCATION', 'B.S. Computer Science, State University, 2018', '', 'SKILLS', 'TypeScript, Node.js, Firebase, Distributed Systems'];

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('storagefile.resume', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserAdminContext({ f }, (au) => {
      demoProfileContext({ f, u: au }, (p) => {
        /**
         * Uploads a PDF to the user's resume uploads folder.
         */
        async function uploadResumePdf(lines: string[], fileName = 'resume.pdf'): Promise<StoragePath> {
          const bytes = await makeTestPdf(lines);
          expect(bytes.length).toBeLessThan(10 * 1024); // the upload policy's cap

          const file = f.storageContext.file(userResumeFileUploadsFilePath(au.uid, fileName));
          await file.upload(bytes, { contentType: 'application/pdf' });

          return { bucketId: file.storagePath.bucketId, pathString: file.storagePath.pathString };
        }

        /**
         * Uploads a resume, initializes it, and drives it into PROCESSING with its notification task queued.
         */
        async function uploadAndBeginProcessing(lines: string[] = RESUME_PDF_LINES) {
          await seedDemoOpenRouterPrompts({ openRouterPromptActions: f.openRouterPromptServerActions, demoFirestoreCollections: f.demoFirestoreCollections });

          const uploadedFilePath = await uploadResumePdf(lines);
          const initialize = await f.storageFileServerActions.initializeStorageFileFromUpload({ bucketId: uploadedFilePath.bucketId, pathString: uploadedFilePath.pathString });
          const storageFileDocument = await initialize();

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
            await seedDemoOpenRouterPrompts({ openRouterPromptActions: f.openRouterPromptServerActions, demoFirestoreCollections: f.demoFirestoreCollections });

            const uploadedFilePath = await uploadResumePdf(RESUME_PDF_LINES);
            const initialize = await f.storageFileServerActions.initializeStorageFileFromUpload({ bucketId: uploadedFilePath.bucketId, pathString: uploadedFilePath.pathString });
            const storageFileDocument = await initialize();

            const storageFile = await assertSnapshotData(storageFileDocument);
            expect(storageFile.p).toBe(USER_RESUME_FILE_PURPOSE);
            expect(storageFile.ps).toBe(StorageFileProcessingState.QUEUED_FOR_PROCESSING);

            // The upload initializer opens the Profile's resume tracking, which is what the profile view
            // renders — the StorageFile itself is not client-readable.
            const profile = await assertSnapshotData(p.document);
            expect(profile.resume.storageFile).toBe(storageFileDocument.key);
            expect(profile.resume.state).toBe(ProfileResumeState.CHECKING);
            expect(profile.resume.filename).toBe('resume.pdf');
            expect(profile.resume.uploadedAt).toBeDefined();
            expect(profile.resume.checkedAt).toBeFalsy();
          });

          it('should seed the resume-check prompt idempotently', async () => {
            const first = await seedDemoOpenRouterPrompts({ openRouterPromptActions: f.openRouterPromptServerActions, demoFirestoreCollections: f.demoFirestoreCollections });
            const second = await seedDemoOpenRouterPrompts({ openRouterPromptActions: f.openRouterPromptServerActions, demoFirestoreCollections: f.demoFirestoreCollections });

            expect(first.created).toBe(true);
            expect(first.version).toBe(1);
            // Minting a version locks the one before it, so re-seeding must NOT mint a second identical one.
            expect(second.created).toBe(false);
            expect(second.version).toBe(1);
          });

          it('should enqueue an OpenRouterRunTask carrying only the object path', async () => {
            const storageFileDocument = await uploadAndBeginProcessing();

            const processing = await assertSnapshotData(storageFileDocument);
            expect(processing.ps).toBe(StorageFileProcessingState.PROCESSING);
            expect(processing.pn).toBeDefined();

            await runNotificationTasks();

            const runTask = await f.demoFirestoreCollections.openRouterRunTaskCollection.documentAccessor().loadDocumentForId(demoResumeCheckRunTaskKey(storageFileDocument.id)).snapshotData();

            expect(runTask).toBeDefined();
            expect(runTask?.pk).toBe(DEMO_RESUME_CHECK_PROMPT_KEY);
            // The code definition, not the version the seeder published: it ships ahead of the store, so
            // the resolver serves it. Asserted against the constant so a config change that bumps the
            // version does not have to be mirrored here.
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

          it('should delay rather than fail when the run is still queued', async () => {
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
            expect(profile.resume.filename).toBe('resume.pdf');
          });

          describe('signedUploadUrl', () => {
            const callCreateSignedUploadUrl = (data: CreateStorageFileSignedUploadUrlParams) => au.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(storageFileIdentity, data, 'signedUploadUrl')) as Promise<CreateStorageFileSignedUploadUrlResult>;

            it('returns an upload url that targets the resume upload path', async () => {
              const result = await callCreateSignedUploadUrl({
                purpose: USER_RESUME_FILE_PURPOSE,
                contentType: 'application/pdf',
                filename: 'resume.pdf',
                fileSizeBytes: 2048
              });

              expect(result.uploadPath).toBe(userResumeFileUploadsFilePath(au.uid, 'resume.pdf'));
              expect(result.purpose).toBe(USER_RESUME_FILE_PURPOSE);
              expect(result.maxFileSizeBytes).toBe(10 * 1024);
            });

            itShouldFail('with FILE_TOO_LARGE when the file exceeds the 10kb inline cap', async () => {
              await expectFail(
                () =>
                  callCreateSignedUploadUrl({
                    purpose: USER_RESUME_FILE_PURPOSE,
                    contentType: 'application/pdf',
                    filename: 'resume.pdf',
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
                    filename: 'resume.txt',
                    fileSizeBytes: 1024
                  }),
                expectFailAssertHttpErrorServerErrorCode('INVALID_CONTENT_TYPE')
              );
            });
          });

          // MARK: The live block — the only thing that proves inline base64 reaches a real model
          describe.skipIf(!OPENROUTER_LIVE_API_KEY)('live', () => {
            it('should land the model verdict on the StorageFile', async () => {
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
