import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { FORM_SPACE_PURPOSE, FormSpaceProcessingState, FormSpaceState, formSpaceStorageFileGroupId, StorageFileState } from '@dereekb/firebase';
import { DEMO_EXAMPLE_FORM_SPACE_ATTACHMENT_SLOT, DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT } from 'demo-firebase';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext, demoFormSpaceContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('formspace.scenario', { f, fns: { demoCallModel } }, () => {
    demoAuthorizedUserContext({ f }, (u) => {
      /**
       * One pass of the notification queue, which is what actually runs the submission subtask.
       */
      async function runNotificationTasks() {
        const sendQueuedNotifications = await f.notificationServerActions.sendQueuedNotifications({});
        return sendQueuedNotifications();
      }

      /**
       * Clears the throttle a notification pass leaves behind, so a following pass runs the task again
       * rather than skipping it. Mirrors the calendar scenario's helper.
       */
      async function clearProcessingTaskThrottle(processingNotificationKey: string) {
        await f.demoFirestoreCollections.notificationCollectionGroup.documentAccessor().loadDocumentForKey(processingNotificationKey).update({ sat: new Date() });
      }

      demoFormSpaceContext({ f, u, data: { fullName: 'Ada' } }, (fsp) => {
        describe('the full FormSpace lifecycle', () => {
          it('should accept an upload into a declared slot', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'resume.pdf', content: 'a resume', contentType: 'application/pdf' });

            const initResult = await fsp.initializeUploads();
            expect(initResult.initializationsSuccessCount).toBe(1);

            const storageFiles = await fsp.loadStorageFiles();
            expect(storageFiles).toHaveLength(1);

            const storageFile = await assertSnapshotData(storageFiles[0]);
            expect(storageFile.p).toBe(FORM_SPACE_PURPOSE);
            expect(storageFile.pg).toBe(DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT);
            expect(storageFile.g).toContain(formSpaceStorageFileGroupId(fsp.documentKey));
            expect(storageFile.o).toBe(`pr/${u.uid}`);
            expect(storageFile.u).toBe(u.uid);

            // the monotonic accepted-upload counter, not a live file count
            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.uc).toBe(1);
          });

          it('should reject a file the slot does not allow, leaving the counter untouched', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'notes.txt', content: 'plain text', contentType: 'text/plain' });

            const initResult = await fsp.initializeUploads();
            expect(initResult.initializationsSuccessCount).toBe(0);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.uc).toBe(0);
            expect(await fsp.loadStorageFiles()).toHaveLength(0);
          });

          it('should reject an upload into a slot the type never declared', async () => {
            await fsp.uploadFileToSlot({ slot: 'undeclared', filename: 'x.pdf', content: 'x', contentType: 'application/pdf' });

            const initResult = await fsp.initializeUploads();
            expect(initResult.initializationsSuccessCount).toBe(0);
            expect(await fsp.loadStorageFiles()).toHaveLength(0);
          });

          it('should supersede the previous file when the same slot is uploaded into again', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'resume.pdf', content: 'first', contentType: 'application/pdf' });
            await fsp.initializeUploads();

            const [first] = await fsp.loadStorageFiles();

            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'resume-v2.pdf', content: 'second', contentType: 'application/pdf' });
            await fsp.initializeUploads();

            const previous = await assertSnapshotData(first);
            expect(previous.sdat).toBeDefined();
            expect(previous.fs).toBe(StorageFileState.QUEUED_FOR_DELETE);

            // superseding still consumes budget: the counter bounds work done, not files retained
            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.uc).toBe(2);
          });

          itShouldFail('to submit while a required slot is empty', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_ATTACHMENT_SLOT, filename: 'extra.png', content: 'img', contentType: 'image/png' });
            await fsp.initializeUploads();

            await expectFail(() => fsp.submit());
          });

          it('should submit, lock, queue, and process through the registered handler', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'resume.pdf', content: 'a resume', contentType: 'application/pdf' });
            await fsp.initializeUploads();

            const submitResult = await fsp.submit();
            expect(submitResult.processingTaskCreated).toBe(true);
            expect(submitResult.processingNotificationKey).toBeDefined();

            const submitted = await assertSnapshotData(fsp.document);
            expect(submitted.s).toBe(FormSpaceState.SUBMITTED);
            expect(submitted.sat).toBeDefined();
            expect(submitted.ps).toBe(FormSpaceProcessingState.QUEUED_FOR_PROCESSING);
            expect(submitted.pn).toBe(submitResult.processingNotificationKey);
            // cleared so the expiration sweep cannot retire a space that is being processed. A cleared
            // optional date reads back as absent, not as an explicit null.
            expect(submitted.eat).toBeUndefined();

            const taskDocument = await fsp.loadProcessingTaskDocument();
            expect(await taskDocument.exists()).toBe(true);

            // run the task to completion. Three passes: the review checkpoint, the record checkpoint, and
            // the cleanup step the subtask framework adds after the flow finishes.
            for (let i = 0; i < 3; i += 1) {
              await clearProcessingTaskThrottle(submitResult.processingNotificationKey);
              await runNotificationTasks();
            }

            const processed = await assertSnapshotData(fsp.document);
            expect(processed.ps).toBe(FormSpaceProcessingState.SUCCESS);
            expect(processed.cpat).toBeDefined();
            expect(processed.pn).toBeUndefined();
          });
        });
      });

      describe('expiration', () => {
        demoFormSpaceContext({ f, u }, (fsp) => {
          it('should expire a due draft and flag its files for delete', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'resume.pdf', content: 'a resume', contentType: 'application/pdf' });
            await fsp.initializeUploads();

            const [storageFileDocument] = await fsp.loadStorageFiles();

            // the sweep's cutoff is what decides due-ness, so push it past this space's eat rather than
            // rewriting the document under test
            const result = await fsp.expireAllExpiredFormSpaces({ before: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });

            expect(result.formSpacesExpired).toBeGreaterThanOrEqual(1);
            expect(result.storageFilesFlaggedForDelete).toBeGreaterThanOrEqual(1);

            const expired = await assertSnapshotData(fsp.document);
            expect(expired.s).toBe(FormSpaceState.EXPIRED);
            // cleared, so a second sweep pass finds nothing and the loop terminates
            expect(expired.eat).toBeUndefined();

            const storageFile = await assertSnapshotData(storageFileDocument);
            expect(storageFile.sdat).toBeDefined();
            expect(storageFile.fs).toBe(StorageFileState.QUEUED_FOR_DELETE);
          });

          it('should not expire a space whose expiration has not arrived', async () => {
            const result = await fsp.expireAllExpiredFormSpaces({ before: new Date(Date.now() - 60 * 1000) });
            expect(result.formSpacesExpired).toBe(0);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.s).toBe(FormSpaceState.DRAFT);
          });
        });
      });
    });
  });
});
