import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { FORM_SPACE_PURPOSE, FormSpaceFileValidationState, FormSpaceProcessingState, FormSpaceState, formSpaceStorageFileGroupId, type NotificationKey, type StorageFileDocument, StorageFileProcessingState, StorageFileState } from '@dereekb/firebase';
import { DEMO_EXAMPLE_FORM_SPACE_ATTACHMENT_SLOT, DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_MAX_FILES, DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT } from 'demo-firebase';
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

      /**
       * Drives every one of a space's accepted files through the `SFP` task that validates them.
       *
       * The processor sets `allowRunMultipleParts`, so register and validate share a pass and the subtask
       * framework's cleanup step takes one more. The remaining passes are slack, not a requirement.
       */
      async function runFileProcessing(fsp: { loadStorageFiles: () => Promise<StorageFileDocument[]> }) {
        const processAll = await f.storageFileServerActions.processAllQueuedStorageFiles({});
        await processAll();

        for (let i = 0; i < 5; i += 1) {
          const storageFiles = await fsp.loadStorageFiles();

          await Promise.all(
            storageFiles.map(async (x) => {
              const storageFile = await x.snapshotData();

              if (storageFile?.pn) {
                await clearProcessingTaskThrottle(storageFile.pn as NotificationKey);
              }
            })
          );

          await runNotificationTasks();
        }
      }

      /**
       * A file whose bytes actually are a PDF, which is what the documents slot's validator checks for.
       */
      const VALID_PDF_CONTENT = '%PDF-1.7\nthe body of the document\n%%EOF';

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

            // the object is keyed by the claimed index, NOT by the uploaded name
            expect(storageFile.pathString).toBe(`/fsp/${fsp.documentId}/${DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT}/0.pdf`);
            // ...so the name rides on the StorageFile's display name instead, untyped by contract
            expect(storageFile.n).toBe('resume');

            // the monotonic accepted-upload counter, not a live file count
            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.uc).toBe(1);
            // the index counter advanced past the one it handed out
            expect(formSpace.fi).toBe(1);

            // ...and the live file list, written in the same transaction as the counter
            expect(formSpace.f).toHaveLength(1);
            expect(formSpace.f[0].sl).toBe(DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT);
            expect(formSpace.f[0].sf).toBe(storageFiles[0].id);
            // the entry still reads as the name the user uploaded, even though no object is called that
            expect(formSpace.f[0].n).toBe('resume.pdf');
            // the slot declares no validator, so there is nothing to check
            expect(formSpace.f[0].v).toBe(FormSpaceFileValidationState.NONE);
          });

          it('should download an accepted file under the name it was uploaded with, not its index', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'resume.pdf', content: 'a resume', contentType: 'application/pdf' });
            await fsp.initializeUploads();

            const [storageFileDocument] = await fsp.loadStorageFiles();
            const storageFile = await assertSnapshotData(storageFileDocument);

            const download = await f.storageFileServerActions.downloadStorageFile({ key: storageFileDocument.key });
            const result = await download(storageFileDocument);

            // the object really is called `0.pdf`...
            expect(storageFile.pathString.endsWith('/0.pdf')).toBe(true);
            // ...and the download still comes back as the user's own name
            expect(result.fileName).toBe('resume.pdf');
          });

          it('should reject a file the slot does not allow, leaving the counter untouched', async () => {
            const uploadPath = await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'notes.txt', content: 'plain text', contentType: 'text/plain' });

            const initResult = await fsp.initializeUploads();
            expect(initResult.initializationsSuccessCount).toBe(0);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.uc).toBe(0);
            // a refusal is caught in the claim transaction, which aborts before writing — so it burns
            // neither the upload budget nor an index
            expect(formSpace.fi).toBe(0);
            expect(await fsp.loadStorageFiles()).toHaveLength(0);

            // the stray upload is DISCARDED, which is what separates a refusal from an infrastructure
            // failure: only a permanent result deletes the source, and a misclassified refusal would leave
            // this file to be retried forever
            expect(await f.storageContext.file(uploadPath).exists()).toBe(false);
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

            // the slot holds one file, and it is the new one
            expect(formSpace.f).toHaveLength(1);
            expect(formSpace.f[0].n).toBe('resume-v2.pdf');
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

      describe('two concurrent spaces', () => {
        demoFormSpaceContext({ f, u }, (first) => {
          demoFormSpaceContext({ f, u }, (second) => {
            it("should not supersede the other space's file in the same slot", async () => {
              await first.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'first.pdf', content: 'first resume', contentType: 'application/pdf' });
              await first.initializeUploads();

              const [firstStorageFile] = await first.loadStorageFiles();

              await second.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'second.pdf', content: 'second resume', contentType: 'application/pdf' });
              await second.initializeUploads();

              // supersede is scoped to the space, not to (purpose, user, slot): the same user holding two
              // drafts that both declare `resume` must not lose the first one by filling the second.
              const untouched = await assertSnapshotData(firstStorageFile);
              expect(untouched.sdat).toBeUndefined();
              expect(untouched.fs).toBe(StorageFileState.OK);

              expect((await assertSnapshotData(first.document)).f).toHaveLength(1);
              expect((await assertSnapshotData(second.document)).f).toHaveLength(1);
            });
          });
        });
      });

      describe('folder slots', () => {
        demoFormSpaceContext({ f, u }, (fsp) => {
          /**
           * Fills the documents folder with `count` distinct, genuinely-PDF files.
           */
          async function uploadDocuments(count: number) {
            for (let i = 0; i < count; i += 1) {
              await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, filename: `doc-${i}.pdf`, content: VALID_PDF_CONTENT, contentType: 'application/pdf' });
            }

            return fsp.initializeUploads();
          }

          it('should accumulate files rather than supersede them', async () => {
            const initResult = await uploadDocuments(DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_MAX_FILES);
            expect(initResult.initializationsSuccessCount).toBe(DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_MAX_FILES);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.f).toHaveLength(DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_MAX_FILES);
            expect(formSpace.uc).toBe(DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_MAX_FILES);
            expect(formSpace.f.map((x) => x.n).sort()).toEqual(['doc-0.pdf', 'doc-1.pdf', 'doc-2.pdf']);

            // every accepted file is still live: a folder evicts nothing
            const storageFiles = await Promise.all((await fsp.loadStorageFiles()).map((x) => assertSnapshotData(x)));
            expect(storageFiles.filter((x) => x.sdat != null)).toHaveLength(0);
          });

          it('should refuse an upload once the folder is full', async () => {
            await uploadDocuments(DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_MAX_FILES);

            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, filename: 'one-too-many.pdf', content: VALID_PDF_CONTENT, contentType: 'application/pdf' });

            const initResult = await fsp.initializeUploads();
            expect(initResult.initializationsSuccessCount).toBe(0);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.f).toHaveLength(DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_MAX_FILES);
            // a refused upload consumes no budget
            expect(formSpace.uc).toBe(DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_MAX_FILES);
          });

          it('should accept a filename the folder already holds, keying the two objects apart by index', async () => {
            await uploadDocuments(1);

            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, filename: 'doc-0.pdf', content: VALID_PDF_CONTENT, contentType: 'application/pdf' });

            const initResult = await fsp.initializeUploads();
            expect(initResult.initializationsSuccessCount).toBe(1);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.f).toHaveLength(2);
            // both entries read as the same name to the owner...
            expect(formSpace.f.map((x) => x.n)).toEqual(['doc-0.pdf', 'doc-0.pdf']);

            // ...but they are two distinct objects, which is what makes deleting either one safe
            const storageFiles = await Promise.all((await fsp.loadStorageFiles()).map((x) => assertSnapshotData(x)));
            const paths = storageFiles.map((x) => x.pathString);
            expect(new Set(paths).size).toBe(2);
          });

          it('should not let a re-uploaded name destroy the file that replaced a removed one', async () => {
            await uploadDocuments(1);

            const [removedEntry] = (await assertSnapshotData(fsp.document)).f;
            const removedDocument = (await fsp.loadStorageFiles()).find((x) => x.id === removedEntry.sf) as StorageFileDocument;
            const removedFile = await assertSnapshotData(removedDocument);

            // the entry leaves `f` and the StorageFile is flagged, but the OBJECT stays until the sweep runs
            await fsp.removeFile({ slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, storageFileId: removedEntry.sf });

            // re-uploading the very same name is what used to overwrite that still-present object
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, filename: 'doc-0.pdf', content: VALID_PDF_CONTENT, contentType: 'application/pdf' });
            await fsp.initializeUploads();

            const after = await assertSnapshotData(fsp.document);
            expect(after.f).toHaveLength(1);

            const [keptEntry] = after.f;
            expect(keptEntry.sf).not.toBe(removedEntry.sf);
            expect(keptEntry.n).toBe('doc-0.pdf'); // same NAME...

            const keptDocument = (await fsp.loadStorageFiles()).find((x) => x.id === keptEntry.sf) as StorageFileDocument;
            const keptFile = await assertSnapshotData(keptDocument);
            expect(keptFile.pathString).not.toBe(removedFile.pathString); // ...different OBJECT

            // sweeping the removed file resolves the object from ITS OWN pathString, which is exactly how
            // a shared path used to destroy the survivor's bytes
            const deleteRemoved = await f.storageFileServerActions.deleteStorageFile({ key: removedDocument.key, force: true });
            await deleteRemoved(removedDocument);

            const survivor = f.storageContext.file(keptFile);
            expect(await survivor.exists()).toBe(true);
            expect(Buffer.from(await survivor.getBytes()).toString()).toBe(VALID_PDF_CONTENT);
          });

          it('should remove one file from the folder and flag only that file', async () => {
            await uploadDocuments(2);

            const before = await assertSnapshotData(fsp.document);
            const [removed, kept] = before.f;

            await fsp.removeFile({ slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, storageFileId: removed.sf });

            const after = await assertSnapshotData(fsp.document);
            expect(after.f.map((x) => x.sf)).toEqual([kept.sf]);
            // removing a file does NOT refund the counter: it bounds uploads accepted, not files retained
            expect(after.uc).toBe(2);

            const storageFiles = await fsp.loadStorageFiles();
            const removedStorageFile = await assertSnapshotData(storageFiles.find((x) => x.id === removed.sf) as (typeof storageFiles)[0]);
            const keptStorageFile = await assertSnapshotData(storageFiles.find((x) => x.id === kept.sf) as (typeof storageFiles)[0]);

            expect(removedStorageFile.fs).toBe(StorageFileState.QUEUED_FOR_DELETE);
            expect(removedStorageFile.sdat).toBeDefined();
            expect(keptStorageFile.fs).toBe(StorageFileState.OK);
            expect(keptStorageFile.sdat).toBeUndefined();
          });

          itShouldFail('to remove a file the slot does not hold', async () => {
            await uploadDocuments(1);
            await expectFail(() => fsp.removeFile({ slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, storageFileId: 'nope' }));
          });

          itShouldFail('to remove without naming a file when the folder holds several', async () => {
            await uploadDocuments(2);
            await expectFail(() => fsp.removeFile({ slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT }));
          });
        });
      });

      describe('uploaded file validation', () => {
        demoFormSpaceContext({ f, u }, (fsp) => {
          /**
           * Uploads one file into the validated documents slot and runs it all the way through validation.
           */
          async function uploadAndValidate(filename: string, content: string) {
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, filename, content, contentType: 'application/pdf' });
            await fsp.initializeUploads();
            await runFileProcessing(fsp);
          }

          it('should queue an accepted file for processing and mark it pending', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, filename: 'proof.pdf', content: VALID_PDF_CONTENT, contentType: 'application/pdf' });
            await fsp.initializeUploads();

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.f[0].v).toBe(FormSpaceFileValidationState.PENDING);

            const storageFile = await assertSnapshotData((await fsp.loadStorageFiles())[0]);
            expect(storageFile.ps).toBe(StorageFileProcessingState.QUEUED_FOR_PROCESSING);
          });

          it('should mark a genuine PDF valid', async () => {
            await uploadAndValidate('proof.pdf', VALID_PDF_CONTENT);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.f[0].v).toBe(FormSpaceFileValidationState.VALID);
            expect(formSpace.f[0].r).toBeUndefined();
            expect(formSpace.f[0].vat).toBeDefined();

            const storageFile = await assertSnapshotData((await fsp.loadStorageFiles())[0]);
            expect(storageFile.ps).toBe(StorageFileProcessingState.SUCCESS);
          });

          it('should flag a file whose bytes are not a PDF, with a reason the owner can act on', async () => {
            await uploadAndValidate('proof.pdf', 'this is definitely not a pdf');

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.f[0].v).toBe(FormSpaceFileValidationState.INVALID);
            expect(formSpace.f[0].r).toBeDefined();

            // the file is kept, not discarded: the owner has to see what was rejected to replace it
            const storageFile = await assertSnapshotData((await fsp.loadStorageFiles())[0]);
            expect(storageFile.sdat).toBeUndefined();
            expect(storageFile.ps).toBe(StorageFileProcessingState.FAILED);
          });

          it('should leave a slot that declares no validator alone', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'resume.pdf', content: 'not a pdf at all', contentType: 'application/pdf' });
            await fsp.initializeUploads();
            await runFileProcessing(fsp);

            const formSpace = await assertSnapshotData(fsp.document);
            expect(formSpace.f[0].v).toBe(FormSpaceFileValidationState.NONE);

            // nothing ran, so nothing failed
            const storageFile = await assertSnapshotData((await fsp.loadStorageFiles())[0]);
            expect(storageFile.ps).toBe(StorageFileProcessingState.SUCCESS);
          });

          itShouldFail('to submit while a validated slot holds an invalid file', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'resume.pdf', content: 'a resume', contentType: 'application/pdf' });
            await uploadAndValidate('proof.pdf', 'this is definitely not a pdf');

            await expectFail(() => fsp.submit());
          });

          it('should submit once the invalid file is removed', async () => {
            await fsp.uploadFileToSlot({ slot: DEMO_EXAMPLE_FORM_SPACE_RESUME_SLOT, filename: 'resume.pdf', content: 'a resume', contentType: 'application/pdf' });
            await uploadAndValidate('proof.pdf', 'this is definitely not a pdf');

            // a plain `it()` cannot use expectFail: it signals a verified failure by throwing, which only
            // itShouldFail catches
            await expect(fsp.submit()).rejects.toThrow();

            const invalid = (await assertSnapshotData(fsp.document)).f.find((x) => x.v === FormSpaceFileValidationState.INVALID);
            expect(invalid).toBeDefined();

            await fsp.removeFile({ slot: DEMO_EXAMPLE_FORM_SPACE_DOCUMENTS_SLOT, storageFileId: invalid?.sf });

            const submitResult = await fsp.submit();
            expect(submitResult.processingNotificationKey).toBeDefined();
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
