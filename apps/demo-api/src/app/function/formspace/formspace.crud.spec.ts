import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { type OnCallCreateModelResult, type CreateFormSpaceParams, type DeleteFormSpaceParams, FORM_SPACE_NOT_EDITABLE_ERROR_CODE, FORM_SPACE_TYPE_NOT_REGISTERED_ERROR_CODE, formSpaceIdentity, FormSpaceProcessingState, FormSpaceState, FORBIDDEN_ERROR_CODE, onCallCreateModelParams, onCallDeleteModelParams, onCallUpdateModelParams, type SubmitFormSpaceParams, type UpdateFormSpaceParams } from '@dereekb/firebase';
import { DEMO_EXAMPLE_FORM_SPACE_TYPE } from 'demo-firebase';
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
            });
          });
        });
      });
    });
  });
});
