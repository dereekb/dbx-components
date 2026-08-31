import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { FORBIDDEN_ERROR_CODE, FORM_SPACE_PURPOSE, type OnCallCreateModelResult, formSpaceIdentity, formSpaceStorageFileGroupId, onCallCreateModelParams, onCallDeleteModelParams, onCallUpdateModelParams } from '@dereekb/firebase';
import { DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_SLOT, DEMO_GUESTBOOK_FORM_SPACE_TYPE, DEMO_TEST_FORM_SPACE_COVER_SLOT, DEMO_TEST_FORM_SPACE_TYPE, demoGuestbookFormSpaceId } from 'demo-firebase';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext, demoFormSpaceContext, demoGuestbookContext, demoGuestbookEntryContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

/**
 * The SHARED FormSpace shape: one album per Guestbook, filled by everyone who signed it.
 *
 * The whole point is the split between `u` and `o`. `u` is the guestbook's creator and carries
 * submit/delete; `o` is the guestbook's key and is what every signer reaches the space through. So a signer
 * can read it and upload into it and cannot end it, and a stranger cannot touch it at all — which is the
 * one thing `storage.rules` cannot enforce, because a stranger writes into their OWN uploads namespace.
 */
demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('formspace.scenario.guestbook', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (owner) => {
      demoGuestbookContext({ f, createdBy: owner }, (g) => {
        demoAuthorizedUserContext({ f }, (signer) => {
          demoAuthorizedUserContext({ f }, (stranger) => {
            demoGuestbookEntryContext({ f, u: owner, g }, () => {
              demoGuestbookEntryContext({ f, u: signer, g }, () => {
                describe('creating the album', () => {
                  it('should key the album to the guestbook and own it with the guestbook creator', async () => {
                    const params = { formSpaceType: DEMO_GUESTBOOK_FORM_SPACE_TYPE, targetModelKey: g.documentKey };
                    const result = (await signer.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(formSpaceIdentity, params))) as OnCallCreateModelResult;

                    expect(result.modelKeys).toHaveLength(1);

                    const formSpaceDocument = f.demoFirestoreCollections.formSpaceCollection.documentAccessor().loadDocumentForKey(result.modelKeys[0]);
                    const formSpace = await assertSnapshotData(formSpaceDocument);

                    // derived, not issued — this is what makes the create idempotent and lets a client read
                    // the album before anyone has called create
                    expect(formSpaceDocument.id).toBe(demoGuestbookFormSpaceId(g.documentKey));
                    expect(formSpace.o).toBe(g.documentKey);
                    expect(formSpace.m).toBe(g.documentKey);
                    // NOT the signer who opened it. `u` carries submit and delete.
                    expect(formSpace.u).toBe(owner.uid);
                    // a shared album is a fixture of the guestbook, so it never joins the expiration sweep
                    expect(formSpace.eat).toBeUndefined();
                  });

                  it('should resolve a second create to the SAME album rather than a duplicate', async () => {
                    const params = { formSpaceType: DEMO_GUESTBOOK_FORM_SPACE_TYPE, targetModelKey: g.documentKey };

                    const first = (await owner.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(formSpaceIdentity, params))) as OnCallCreateModelResult;
                    const second = (await signer.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(formSpaceIdentity, params))) as OnCallCreateModelResult;

                    expect(second.modelKeys[0]).toBe(first.modelKeys[0]);
                  });

                  itShouldFail('to create an album that names no guestbook', async () => {
                    await expectFail(() => signer.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(formSpaceIdentity, { formSpaceType: DEMO_GUESTBOOK_FORM_SPACE_TYPE })));
                  });

                  itShouldFail('to create an album whose target is not a guestbook', async () => {
                    await expectFail(() => signer.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(formSpaceIdentity, { formSpaceType: DEMO_GUESTBOOK_FORM_SPACE_TYPE, targetModelKey: `pr/${signer.uid}` })));
                  });

                  itShouldFail('to create an album for a guestbook the caller has not signed', async () => {
                    await expectFail(() => stranger.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(formSpaceIdentity, { formSpaceType: DEMO_GUESTBOOK_FORM_SPACE_TYPE, targetModelKey: g.documentKey })));
                  });
                });

                describe('an existing album', () => {
                  demoFormSpaceContext({ f, u: owner, g, formSpaceType: DEMO_GUESTBOOK_FORM_SPACE_TYPE }, (fsp) => {
                    it('should accept an upload from a signer who is not the album owner', async () => {
                      await fsp.uploadFileToSlotAsUser(signer.uid, { slot: DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_SLOT, filename: 'photo.png', content: 'a photo', contentType: 'image/png' });

                      const initResult = await fsp.initializeUploads();
                      expect(initResult.initializationsSuccessCount).toBe(1);

                      const storageFile = await assertSnapshotData((await fsp.loadStorageFiles())[0]);
                      expect(storageFile.p).toBe(FORM_SPACE_PURPOSE);
                      expect(storageFile.pg).toBe(DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_SLOT);
                      expect(storageFile.g).toContain(formSpaceStorageFileGroupId(fsp.documentKey));
                      // the two come APART on a shared space: the file belongs to the album's owner and
                      // records who actually put it there
                      expect(storageFile.u).toBe(owner.uid);
                      expect(storageFile.uby).toBe(signer.uid);
                      expect(storageFile.o).toBe(g.documentKey);

                      const formSpace = await assertSnapshotData(fsp.document);
                      expect(formSpace.f).toHaveLength(1);
                      expect(formSpace.uc).toBe(1);
                    });

                    it('should refuse an upload from someone who has not signed the guestbook', async () => {
                      const uploadPath = await fsp.uploadFileToSlotAsUser(stranger.uid, { slot: DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_SLOT, filename: 'photo.png', content: 'a photo', contentType: 'image/png' });

                      const initResult = await fsp.initializeUploads();
                      expect(initResult.initializationsSuccessCount).toBe(0);

                      // nothing moved — not the budget, not the index, not the file list
                      const formSpace = await assertSnapshotData(fsp.document);
                      expect(formSpace.uc).toBe(0);
                      expect(formSpace.fi).toBe(0);
                      expect(formSpace.f).toHaveLength(0);
                      expect(await fsp.loadStorageFiles()).toHaveLength(0);

                      // refused PERMANENTLY, so the stray upload is discarded rather than retried forever.
                      // A stranger can always place bytes — the path is inside their own namespace and
                      // `storage.rules` allows it — so this discard is the only thing cleaning up after them.
                      expect(await f.storageContext.file(uploadPath).exists()).toBe(false);
                    });

                    it('should refuse an upload from a signer whose entry was removed', async () => {
                      await f.demoFirestoreCollections.guestbookEntryCollectionFactory(g.document).documentAccessor().loadDocumentForId(signer.uid).accessor.delete();

                      const uploadPath = await fsp.uploadFileToSlotAsUser(signer.uid, { slot: DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_SLOT, filename: 'photo.png', content: 'a photo', contentType: 'image/png' });

                      const initResult = await fsp.initializeUploads();
                      expect(initResult.initializationsSuccessCount).toBe(0);
                      expect(await f.storageContext.file(uploadPath).exists()).toBe(false);
                    });

                    it('should accumulate uploads from several signers rather than superseding', async () => {
                      await fsp.uploadFileToSlotAsUser(owner.uid, { slot: DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_SLOT, filename: 'photo.png', content: 'the owner photo', contentType: 'image/png' });
                      await fsp.initializeUploads();

                      await fsp.uploadFileToSlotAsUser(signer.uid, { slot: DEMO_GUESTBOOK_FORM_SPACE_PHOTOS_SLOT, filename: 'photo.png', content: 'the signer photo', contentType: 'image/png' });
                      await fsp.initializeUploads();

                      const formSpace = await assertSnapshotData(fsp.document);
                      expect(formSpace.f).toHaveLength(2);

                      // the same NAME, two distinct objects — which is what makes deleting either one safe
                      const paths = (await Promise.all((await fsp.loadStorageFiles()).map((x) => assertSnapshotData(x)))).map((x) => x.pathString);
                      expect(new Set(paths).size).toBe(2);
                    });

                    describe('model permissions', () => {
                      it('should let the album owner update it', async () => {
                        await owner.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, { key: fsp.documentKey, data: { caption: 'Our day' } }));

                        const formSpace = await assertSnapshotData(fsp.document);
                        expect((formSpace.d as { caption?: string } | undefined)?.caption).toBe('Our day');
                      });

                      itShouldFail('to let a signer update the album', async () => {
                        // signers get read + upload, never update: `d` is the album's shared description
                        await expectFail(() => signer.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, { key: fsp.documentKey, data: { caption: 'Mine now' } })), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
                      });

                      itShouldFail('to let a signer submit the album', async () => {
                        await expectFail(() => signer.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, { key: fsp.documentKey }, 'submit')), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
                      });

                      itShouldFail('to let a signer delete the album', async () => {
                        await expectFail(() => signer.callWrappedFunction(demoCallModelWrappedFn, onCallDeleteModelParams(formSpaceIdentity, { key: fsp.documentKey })), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
                      });

                      itShouldFail('to let a stranger touch the album at all', async () => {
                        await expectFail(() => stranger.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(formSpaceIdentity, { key: fsp.documentKey, data: {} })), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
                      });
                    });
                  });
                });

                describe('a single-user space against the same guestbook', () => {
                  demoFormSpaceContext({ f, u: signer, formSpaceType: DEMO_TEST_FORM_SPACE_TYPE }, (fsp) => {
                    it('should not be reachable by another signer, even one on the same guestbook', async () => {
                      const uploadPath = await fsp.uploadFileToSlotAsUser(owner.uid, { slot: DEMO_TEST_FORM_SPACE_COVER_SLOT, filename: 'cover.pdf', content: 'a cover', contentType: 'application/pdf' });

                      // signing a guestbook grants nothing on a space owned by a PROFILE — the delegate
                      // reads the space's own type first, so the guestbook rule never applies here
                      const initResult = await fsp.initializeUploads();
                      expect(initResult.initializationsSuccessCount).toBe(0);
                      expect(await f.storageContext.file(uploadPath).exists()).toBe(false);
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
