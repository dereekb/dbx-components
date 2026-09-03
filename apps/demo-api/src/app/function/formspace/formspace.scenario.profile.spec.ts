import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { FORM_SPACE_PURPOSE, FormSpaceProcessingState, FormSpaceState, formSpaceSlotFileAccess, formSpaceStorageFileGroupId, isFormSpaceFileAccessibleByUser, type NotificationKey, StorageFileState } from '@dereekb/firebase';
import { DEMO_FORM_SPACE_TYPE_CONFIG_SERVICE, DEMO_TEST_FORM_SPACE_COVER_SLOT, DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES, DEMO_TEST_FORM_SPACE_FOLDER_SLOT, DEMO_TEST_FORM_SPACE_TYPE, type DemoTestFormSpaceData } from 'demo-firebase';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext, demoFormSpaceContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

/**
 * The SINGLE-USER FormSpace shape, driven through `demo_test` — the type the `/demo/app/formspace` page
 * uses.
 *
 * `formspace.scenario.spec.ts` already covers the lifecycle through `demo_example`. What is here instead is
 * everything that type cannot show: a folder that holds four rather than three, a slot with no validator,
 * and — the reason this file exists at all — that opening the SHARED shape's upload delegate did not widen
 * the single-user path by a hair.
 */
demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('formspace.scenario.profile', { f, fns: { demoCallModel } }, () => {
    demoAuthorizedUserContext({ f }, (u) => {
      async function runNotificationTasks() {
        const sendQueuedNotifications = await f.notificationServerActions.sendQueuedNotifications({});
        return sendQueuedNotifications();
      }

      /**
       * Winds back the throttle a notification pass leaves behind, so the next pass runs the task rather
       * than skipping it.
       */
      async function clearProcessingTaskThrottle(processingNotificationKey: NotificationKey) {
        await f.demoFirestoreCollections.notificationCollectionGroup.documentAccessor().loadDocumentForKey(processingNotificationKey).update({ sat: new Date() });
      }

      /**
       * Runs one submitted space's task to completion: `demo_test`'s single checkpoint, plus the cleanup
       * step the subtask framework adds after the flow ends.
       */
      async function processSubmission(processingNotificationKey: NotificationKey) {
        for (let i = 0; i < 3; i += 1) {
          await clearProcessingTaskThrottle(processingNotificationKey);
          await runNotificationTasks();
        }
      }

      demoFormSpaceContext({ f, u, formSpaceType: DEMO_TEST_FORM_SPACE_TYPE, data: { title: 'A Test' } as DemoTestFormSpaceData }, (fsp) => {
        describe('the cover slot', () => {
          it('should be owned by the calling user, not by a target model', async () => {
            const formSpace = await assertSnapshotData(fsp.document);

            expect(formSpace.t).toBe(DEMO_TEST_FORM_SPACE_TYPE);
            expect(formSpace.u).toBe(u.uid);
            expect(formSpace.o).toBe(`pr/${u.uid}`);
            // the single-user shape expires; only the shared one is exempt
            expect(formSpace.eat).toBeDefined();
          });

          it('should accept an upload', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_TEST_FORM_SPACE_COVER_SLOT, filename: 'cover.pdf', content: 'a cover', contentType: 'application/pdf' });

            const initResult = await fsp.initializeUploads();
            expect(initResult.initializationsSuccessCount).toBe(1);

            const storageFile = await assertSnapshotData((await fsp.loadStorageFiles())[0]);
            expect(storageFile.p).toBe(FORM_SPACE_PURPOSE);
            expect(storageFile.pg).toBe(DEMO_TEST_FORM_SPACE_COVER_SLOT);
            expect(storageFile.g).toContain(formSpaceStorageFileGroupId(fsp.documentKey));
            expect(storageFile.u).toBe(u.uid);
            // the owner uploaded it themselves, so the two are the same user here — which is exactly what
            // the guestbook scenario shows coming apart
            expect(storageFile.uby ?? storageFile.u).toBe(u.uid);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.f).toHaveLength(1);
            expect(formSpace.f[0].n).toBe('cover.pdf');
          });

          it('should supersede the previous file when uploaded into again', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_TEST_FORM_SPACE_COVER_SLOT, filename: 'cover.pdf', content: 'first', contentType: 'application/pdf' });
            await fsp.initializeUploads();

            const [first] = await fsp.loadStorageFiles();

            await fsp.uploadFileToSlot({ slot: DEMO_TEST_FORM_SPACE_COVER_SLOT, filename: 'cover-v2.png', content: 'second', contentType: 'image/png' });
            await fsp.initializeUploads();

            const previous = await assertSnapshotData(first);
            expect(previous.fs).toBe(StorageFileState.QUEUED_FOR_DELETE);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.f).toHaveLength(1);
            expect(formSpace.f[0].n).toBe('cover-v2.png');
            // superseding still burns budget: the counter bounds work done, not files retained
            expect(formSpace.uc).toBe(2);
          });

          it('should refuse a mime type the slot does not allow', async () => {
            const uploadPath = await fsp.uploadFileToSlot({ slot: DEMO_TEST_FORM_SPACE_COVER_SLOT, filename: 'notes.txt', content: 'plain text', contentType: 'text/plain' });

            const initResult = await fsp.initializeUploads();
            expect(initResult.initializationsSuccessCount).toBe(0);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.uc).toBe(0);
            expect(formSpace.fi).toBe(0);
            expect(await f.storageContext.file(uploadPath).exists()).toBe(false);
          });
        });
      });

      describe('the folder slot', () => {
        demoFormSpaceContext({ f, u, formSpaceType: DEMO_TEST_FORM_SPACE_TYPE }, (fsp) => {
          async function uploadFolderFiles(count: number) {
            for (let i = 0; i < count; i += 1) {
              await fsp.uploadFileToSlot({ slot: DEMO_TEST_FORM_SPACE_FOLDER_SLOT, filename: `doc-${i}.pdf`, content: `document ${i}`, contentType: 'application/pdf' });
            }

            return fsp.initializeUploads();
          }

          it('should accumulate up to its maximum rather than superseding', async () => {
            const initResult = await uploadFolderFiles(DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES);
            expect(initResult.initializationsSuccessCount).toBe(DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.f).toHaveLength(DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES);
            expect(formSpace.f.map((x) => x.n).sort()).toEqual(['doc-0.pdf', 'doc-1.pdf', 'doc-2.pdf', 'doc-3.pdf']);
          });

          it('should refuse an upload once full, without burning budget', async () => {
            await uploadFolderFiles(DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES);
            await fsp.uploadFileToSlot({ slot: DEMO_TEST_FORM_SPACE_FOLDER_SLOT, filename: 'one-too-many.pdf', content: 'extra', contentType: 'application/pdf' });

            const initResult = await fsp.initializeUploads();
            expect(initResult.initializationsSuccessCount).toBe(0);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.f).toHaveLength(DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES);
            expect(formSpace.uc).toBe(DEMO_TEST_FORM_SPACE_FOLDER_MAX_FILES);
          });

          it('should record the owner as each file uploader and keep every file reachable', async () => {
            await uploadFolderFiles(2);

            const formSpace = await assertSnapshotData(fsp.document);

            // the uploader is recorded on a single-user space too, so the field is never absent on anything
            // written after it existed — the `ub ?? u` fallback is for HISTORY, not for this shape
            expect(formSpace.f.every((x) => x.ub === u.uid)).toBe(true);

            // `demo_test` declares no fileAccess, so it resolves to 'space' and the owner reaches every file
            const config = DEMO_FORM_SPACE_TYPE_CONFIG_SERVICE.configForFormSpaceType(DEMO_TEST_FORM_SPACE_TYPE);
            expect(formSpaceSlotFileAccess({ config, slot: DEMO_TEST_FORM_SPACE_FOLDER_SLOT })).toBe('space');
            expect(formSpace.f.every((file) => isFormSpaceFileAccessibleByUser({ formSpace, config, file, uid: u.uid }))).toBe(true);
          });

          it('should let the owner remove a file the uploader fallback covers', async () => {
            await uploadFolderFiles(1);

            const before = await assertSnapshotData(fsp.document);
            const [target] = before.f;

            // an entry written before `ub` existed: the owner must still be able to take it back out
            await fsp.document.update({ f: [{ ...target, ub: null }] });
            await fsp.removeFile({ slot: DEMO_TEST_FORM_SPACE_FOLDER_SLOT, storageFileId: target.sf });

            const after = await assertSnapshotData(fsp.document);
            expect(after.f).toHaveLength(0);
          });

          it('should remove one file and flag only that file', async () => {
            await uploadFolderFiles(2);

            const before = await assertSnapshotData(fsp.document);
            const [removed, kept] = before.f;

            await fsp.removeFile({ slot: DEMO_TEST_FORM_SPACE_FOLDER_SLOT, storageFileId: removed.sf });

            const after = await assertSnapshotData(fsp.document);
            expect(after.f.map((x) => x.sf)).toEqual([kept.sf]);

            const storageFiles = await fsp.loadStorageFiles();
            const removedStorageFile = await assertSnapshotData(storageFiles.find((x) => x.id === removed.sf) as (typeof storageFiles)[0]);
            const keptStorageFile = await assertSnapshotData(storageFiles.find((x) => x.id === kept.sf) as (typeof storageFiles)[0]);

            expect(removedStorageFile.fs).toBe(StorageFileState.QUEUED_FOR_DELETE);
            expect(keptStorageFile.fs).toBe(StorageFileState.OK);
          });
        });
      });

      describe('submission', () => {
        demoFormSpaceContext({ f, u, formSpaceType: DEMO_TEST_FORM_SPACE_TYPE, data: { title: 'A Test' } as DemoTestFormSpaceData }, (fsp) => {
          itShouldFail('to submit while the required cover slot is empty', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_TEST_FORM_SPACE_FOLDER_SLOT, filename: 'doc.pdf', content: 'a document', contentType: 'application/pdf' });
            await fsp.initializeUploads();

            await expectFail(() => fsp.submit());
          });

          it('should submit, lock, and run to SUCCESS through the registered handler', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_TEST_FORM_SPACE_COVER_SLOT, filename: 'cover.pdf', content: 'a cover', contentType: 'application/pdf' });
            await fsp.initializeUploads();

            const submitResult = await fsp.submit();
            expect(submitResult.processingTaskCreated).toBe(true);

            const submitted = await assertSnapshotData(fsp.document);
            expect(submitted.s).toBe(FormSpaceState.SUBMITTED);
            expect(submitted.ps).toBe(FormSpaceProcessingState.QUEUED_FOR_PROCESSING);
            // cleared so the expiration sweep cannot retire a space that is being processed
            expect(submitted.eat).toBeUndefined();

            // the record checkpoint, plus the cleanup step the subtask framework adds after the flow ends
            for (let i = 0; i < 3; i += 1) {
              await clearProcessingTaskThrottle(submitResult.processingNotificationKey as NotificationKey);
              await runNotificationTasks();
            }

            const processed = await assertSnapshotData(fsp.document);
            expect(processed.ps).toBe(FormSpaceProcessingState.SUCCESS);
            expect(processed.cpat).toBeDefined();
            expect(processed.pn).toBeUndefined();
          });
        });
      });

      describe('reopen and resubmission', () => {
        demoFormSpaceContext({ f, u, formSpaceType: DEMO_TEST_FORM_SPACE_TYPE, data: { title: 'A Test' } as DemoTestFormSpaceData }, (fsp) => {
          beforeEach(async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_TEST_FORM_SPACE_COVER_SLOT, filename: 'cover.pdf', content: 'a cover', contentType: 'application/pdf' });
            await fsp.initializeUploads();
          });

          it('should run the submission handler AGAIN on a resubmission, against a task of its own', async () => {
            const firstSubmit = await fsp.submit();
            await processSubmission(firstSubmit.processingNotificationKey as NotificationKey);

            const processed = await assertSnapshotData(fsp.document);
            expect(processed.ps).toBe(FormSpaceProcessingState.SUCCESS);

            await fsp.reopen();

            const reopened = await assertSnapshotData(fsp.document);
            expect(reopened.s).toBe(FormSpaceState.DRAFT);
            expect(reopened.rc).toBe(1);
            // cleared: the attempt this handle pointed at is over
            expect(reopened.pn).toBeUndefined();
            expect(reopened.cpat).toBeUndefined();

            const updateParams: DemoTestFormSpaceData = { title: 'Revised' };
            const update = await f.formSpaceServerActions.updateFormSpace({ key: fsp.documentKey, data: updateParams });
            await update(fsp.document);

            const secondSubmit = await fsp.submit();

            // THE REGRESSION PIN. A unique task's document id is derived and permanent, and a completed
            // task is only marked done — it lingers until the cleanup sweep. Keyed by the space alone, this
            // resubmission would resolve to the FINISHED task of the first one, be left exactly as it was
            // found (`processingTaskCreated: false`), and sit in QUEUED_FOR_PROCESSING pointing at a dead
            // document forever. Keying by the attempt is what makes this a new task.
            expect(secondSubmit.processingTaskCreated).toBe(true);
            expect(secondSubmit.processingNotificationKey).not.toBe(firstSubmit.processingNotificationKey);

            await processSubmission(secondSubmit.processingNotificationKey as NotificationKey);

            const reprocessed = await assertSnapshotData(fsp.document);
            expect(reprocessed.ps).toBe(FormSpaceProcessingState.SUCCESS);
            expect(reprocessed.cpat).toBeDefined();
            expect(reprocessed.pn).toBeUndefined();
            expect(reprocessed.d).toEqual({ title: 'Revised' });
            // preserved across both rounds — it is the record the reopen exists in order not to destroy
            expect(reprocessed.fsat).toBeDefined();
          });

          it('should fence off the superseded attempt when a space is reopened before its task runs', async () => {
            const submitResult = await fsp.submit();
            await fsp.reopen();

            // the first attempt's task is still queued and will be picked up. Left unfenced it would
            // process the reopened draft and its cleanup would write ps / cpat / pn over it.
            await processSubmission(submitResult.processingNotificationKey as NotificationKey);

            const reopened = await assertSnapshotData(fsp.document);
            expect(reopened.s).toBe(FormSpaceState.DRAFT);
            expect(reopened.ps).toBe(FormSpaceProcessingState.INIT_OR_NONE);
            expect(reopened.cpat).toBeUndefined();
            expect(reopened.pn).toBeUndefined();
          });
        });
      });

      describe('another user', () => {
        demoAuthorizedUserContext({ f }, (other) => {
          demoFormSpaceContext({ f, u, formSpaceType: DEMO_TEST_FORM_SPACE_TYPE }, (fsp) => {
            it("should be refused an upload into someone else's single-user space", async () => {
              const uploadPath = await fsp.uploadFileToSlotAsUser(other.uid, { slot: DEMO_TEST_FORM_SPACE_COVER_SLOT, filename: 'cover.pdf', content: 'a cover', contentType: 'application/pdf' });

              const initResult = await fsp.initializeUploads();
              expect(initResult.initializationsSuccessCount).toBe(0);

              // NOTHING moved. This is the regression pin on the shared-space delegate: `demo_test` is not
              // a shared type, so the delegate must never even be consulted for it.
              const formSpace = await assertSnapshotData(fsp.document);
              expect(formSpace.uc).toBe(0);
              expect(formSpace.fi).toBe(0);
              expect(await fsp.loadStorageFiles()).toHaveLength(0);

              // permanently refused, so the stray upload is discarded rather than retried forever
              expect(await f.storageContext.file(uploadPath).exists()).toBe(false);
            });
          });
        });
      });
    });
  });
});
