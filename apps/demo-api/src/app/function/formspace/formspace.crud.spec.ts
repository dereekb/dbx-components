import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import {
  type OnCallCreateModelResult,
  type CreateFormSpaceParams,
  type DeleteFormSpaceParams,
  FORM_SPACE_NOT_EDITABLE_ERROR_CODE,
  FORM_SPACE_NOT_REOPENABLE_ERROR_CODE,
  FORM_SPACE_NOT_SUBMITTED_ERROR_CODE,
  FORM_SPACE_TYPE_NOT_REGISTERED_ERROR_CODE,
  formSpaceIdentity,
  FormSpaceProcessingState,
  FormSpaceState,
  FORBIDDEN_ERROR_CODE,
  type LockFormSpaceParams,
  onCallCreateModelParams,
  onCallDeleteModelParams,
  onCallUpdateModelParams,
  type ReopenFormSpaceParams,
  type SubmitFormSpaceParams,
  type UpdateFormSpaceParams
} from '@dereekb/firebase';
import { DEMO_EXAMPLE_FORM_SPACE_TYPE, DEMO_TEST_FORM_SPACE_COVER_SLOT, DEMO_TEST_FORM_SPACE_TYPE } from 'demo-firebase';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext, demoFormSpaceContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('formspace.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      describe('FormSpace', () => {
        describe('create', () => {
          it('should create a draft owned by the caller', async () => {
            const params: CreateFormSpaceParams = {
              formSpaceType: DEMO_EXAMPLE_FORM_SPACE_TYPE,
              displayName: 'My Application',
              data: { fullName: 'Ada' }
            };

            const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(formSpaceIdentity, params))) as OnCallCreateModelResult;
            expect(result.modelKeys).toHaveLength(1);

            const formSpace = await assertSnapshotData(f.demoFirestoreCollections.formSpaceCollection.documentAccessor().loadDocumentForKey(result.modelKeys[0]));

            expect(formSpace.t).toBe(DEMO_EXAMPLE_FORM_SPACE_TYPE);
            expect(formSpace.n).toBe('My Application');
            expect(formSpace.s).toBe(FormSpaceState.DRAFT);
            expect(formSpace.ps).toBe(FormSpaceProcessingState.INIT_OR_NONE);
            expect(formSpace.uc).toBe(0);
            expect(formSpace.u).toBe(u.uid);
            // the owner is the CALLER, never a value in the request body
            expect(formSpace.o).toBe(`pr/${u.uid}`);
            expect(formSpace.d).toEqual({ fullName: 'Ada' });
            // the demo type declares a 7-day expiresIn
            expect(formSpace.eat).toBeDefined();
          });

          itShouldFail('when the FormSpaceType is not registered', async () => {
            const params: CreateFormSpaceParams = { formSpaceType: 'not_a_registered_type' };
            await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(formSpaceIdentity, params)), expectFailAssertHttpErrorServerErrorCode(FORM_SPACE_TYPE_NOT_REGISTERED_ERROR_CODE));
          });
        });

        demoFormSpaceContext({ f, u }, (fsp) => {
          describe('update', () => {
            it('should replace the stored form data', async () => {
              const params: UpdateFormSpaceParams = { key: fsp.documentKey, data: { fullName: 'Grace' }, displayName: 'Renamed' };
              await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, params));

              const formSpace = await assertSnapshotData(fsp.document);
              expect(formSpace.d).toEqual({ fullName: 'Grace' });
              expect(formSpace.n).toBe('Renamed');
            });
          });

          describe('delete', () => {
            it('should delete the space', async () => {
              const params: DeleteFormSpaceParams = { key: fsp.documentKey };
              await u.callWrappedFunction(demoCallModelWrappedFn, onCallDeleteModelParams(formSpaceIdentity, params));

              const exists = await fsp.document.exists();
              expect(exists).toBe(false);
            });
          });
        });

        describe('after submission', () => {
          demoFormSpaceContext({ f, u, formSpaceType: DEMO_EXAMPLE_FORM_SPACE_TYPE }, (fsp) => {
            beforeEach(async () => {
              // the demo type requires a resume, so submit through the action after satisfying it
              await fsp.uploadFileToSlot({ slot: 'resume', filename: 'resume.pdf', content: 'resume', contentType: 'application/pdf' });
              await fsp.initializeUploads();
              await fsp.submit();
            });

            itShouldFail('to update an already-submitted space', async () => {
              const params: UpdateFormSpaceParams = { key: fsp.documentKey, data: { fullName: 'Too Late' } };
              await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, params)), expectFailAssertHttpErrorServerErrorCode(FORM_SPACE_NOT_EDITABLE_ERROR_CODE));
            });

            itShouldFail('to submit an already-submitted space', async () => {
              const params: SubmitFormSpaceParams = { key: fsp.documentKey };
              await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, params, 'submit')), expectFailAssertHttpErrorServerErrorCode(FORM_SPACE_NOT_EDITABLE_ERROR_CODE));
            });

            // The pin on reopening being OPT-IN. `demo_example` declares no reopen policy, so it behaves
            // exactly as it did before reopening existed — which is what every type in every downstream app
            // gets until it says otherwise.
            itShouldFail('to reopen a space whose type never opted in', async () => {
              const params: ReopenFormSpaceParams = { key: fsp.documentKey };
              await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, params, 'reopen')), expectFailAssertHttpErrorServerErrorCode(FORM_SPACE_NOT_REOPENABLE_ERROR_CODE));
            });
          });
        });

        describe('reopen', () => {
          demoFormSpaceContext({ f, u, formSpaceType: DEMO_TEST_FORM_SPACE_TYPE }, (fsp) => {
            beforeEach(async () => {
              await fsp.uploadFileToSlot({ slot: DEMO_TEST_FORM_SPACE_COVER_SLOT, filename: 'cover.pdf', content: 'a cover', contentType: 'application/pdf' });
              await fsp.initializeUploads();
              await fsp.submit();
            });

            it('should return the space to an editable draft and record the round', async () => {
              const params: ReopenFormSpaceParams = { key: fsp.documentKey };
              await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, params, 'reopen'));

              const reopened = await assertSnapshotData(fsp.document);
              expect(reopened.s).toBe(FormSpaceState.DRAFT);
              expect(reopened.ps).toBe(FormSpaceProcessingState.INIT_OR_NONE);
              expect(reopened.sat).toBeUndefined();
              expect(reopened.pn).toBeUndefined();
              expect(reopened.rc).toBe(1);
              expect(reopened.rat).toBeDefined();
              expect(reopened.rby).toBe(u.uid);
              // the record the reopen exists in order NOT to destroy
              expect(reopened.fsat).toBeDefined();
              // re-armed, or the reopened draft would sit outside the expiration sweep forever
              expect(reopened.eat).toBeDefined();
              // the upload budget is spent, not refunded
              expect(reopened.uc).toBe(1);

              // the point of the whole feature: the space is writable again
              const updateParams: UpdateFormSpaceParams = { key: fsp.documentKey, data: { title: 'Fixed' } };
              await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, updateParams));
              expect((await assertSnapshotData(fsp.document)).d).toEqual({ title: 'Fixed' });
            });

            itShouldFail('to reopen once the submission has been locked', async () => {
              const lockParams: LockFormSpaceParams = { key: fsp.documentKey };
              await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, lockParams, 'lock'));

              const params: ReopenFormSpaceParams = { key: fsp.documentKey };
              await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, params, 'reopen')), expectFailAssertHttpErrorServerErrorCode(FORM_SPACE_NOT_REOPENABLE_ERROR_CODE));
            });

            itShouldFail('to reopen past the type maxReopens', async () => {
              // demo_test caps the count at 3. Driven through the actions rather than the callable because
              // what is under test is the cap, not the dispatch, and three rounds of both would be noise.
              for (let round = 0; round < 3; round += 1) {
                await fsp.reopen();
                await fsp.submit();
              }

              expect((await assertSnapshotData(fsp.document)).rc).toBe(3);

              const params: ReopenFormSpaceParams = { key: fsp.documentKey };
              await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, params, 'reopen')), expectFailAssertHttpErrorServerErrorCode(FORM_SPACE_NOT_REOPENABLE_ERROR_CODE));
            });
          });
        });

        describe('lock', () => {
          demoFormSpaceContext({ f, u, formSpaceType: DEMO_TEST_FORM_SPACE_TYPE }, (fsp) => {
            itShouldFail('to lock a space that was never submitted', async () => {
              const params: LockFormSpaceParams = { key: fsp.documentKey };
              await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, params, 'lock')), expectFailAssertHttpErrorServerErrorCode(FORM_SPACE_NOT_SUBMITTED_ERROR_CODE));
            });

            it('should record who made the submission final', async () => {
              await fsp.uploadFileToSlot({ slot: DEMO_TEST_FORM_SPACE_COVER_SLOT, filename: 'cover.pdf', content: 'a cover', contentType: 'application/pdf' });
              await fsp.initializeUploads();
              await fsp.submit();

              const params: LockFormSpaceParams = { key: fsp.documentKey };
              await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, params, 'lock'));

              const locked = await assertSnapshotData(fsp.document);
              expect(locked.lby).toBe(u.uid);
              expect(locked.lat).toBeDefined();
              // a lock is not a state transition — the submission itself is untouched
              expect(locked.s).toBe(FormSpaceState.SUBMITTED);
              expect(locked.sat).toBeDefined();
            });
          });
        });

        describe('non-owner access', () => {
          demoAuthorizedUserContext({ f }, (other) => {
            demoFormSpaceContext({ f, u }, (fsp) => {
              itShouldFail('to update someone else’s space', async () => {
                const params: UpdateFormSpaceParams = { key: fsp.documentKey, data: { fullName: 'Mallory' } };
                await expectFail(() => other.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, params)), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
              });

              itShouldFail('to delete someone else’s space', async () => {
                const params: DeleteFormSpaceParams = { key: fsp.documentKey };
                await expectFail(() => other.callWrappedFunction(demoCallModelWrappedFn, onCallDeleteModelParams(formSpaceIdentity, params)), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
              });

              itShouldFail('to reopen someone else’s space', async () => {
                const params: ReopenFormSpaceParams = { key: fsp.documentKey };
                await expectFail(() => other.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, params, 'reopen')), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
              });

              itShouldFail('to lock someone else’s space', async () => {
                const params: LockFormSpaceParams = { key: fsp.documentKey };
                await expectFail(() => other.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, params, 'lock')), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
              });
            });
          });
        });
      });
    });
  });
});
