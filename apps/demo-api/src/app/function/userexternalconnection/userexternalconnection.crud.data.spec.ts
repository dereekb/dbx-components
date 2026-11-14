import { demoCallModel } from './../model/crud.functions';
import {
  MICROSOFT_MAIL_SIGNATURE_MAX_VALUE_BYTES,
  MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE as MAIL_SIGNATURE,
  type ReadUserExternalConnectionDataParams,
  type ReadUserExternalConnectionDataResult,
  type UpdateUserExternalConnectionDataParams,
  type UpdateUserExternalConnectionDataResult,
  USER_EXTERNAL_CONNECTION_DATA_ITEM_KEY_INVALID_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_DATA_MAX_OPERATIONS,
  USER_EXTERNAL_CONNECTION_DATA_SELF_ITEM_KEY as ME,
  USER_EXTERNAL_CONNECTION_DATA_TOO_LARGE_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_DATA_TYPE_NOT_ALLOWED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_DATA_VALUE_INVALID_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE,
  type UserExternalConnectionDataSetOperation,
  ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as ZOHO,
  onCallReadModelParams,
  onCallUpdateModelParams,
  userExternalConnectionIdentity
} from '@dereekb/firebase';
import { mcpMethodIdForDispatch } from '@dereekb/firebase-server/mcp';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { type Maybe } from '@dereekb/util';
import { DEMO_MICROSOFT_EXTERNAL_CONNECTION_PROVIDER_TYPE as MICROSOFT } from 'demo-firebase';
import { type DemoApiAuthorizedUserTestContextFixture, type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoUserExternalConnectionContext } from '../../../test/fixture';
import { describeMcpMethod, mcpCompactToolNames } from '../../../test/mcp';

/**
 * A value no error, log or response may ever echo back.
 */
const SENTINEL = 'uecd-sentinel-7f3a9c';

/**
 * What a rejected HttpsError carried: its server code, and everything it would show a caller.
 */
interface RejectedCall {
  readonly code: Maybe<string>;
  readonly shown: string;
}

/**
 * Runs a call that must reject and reads back what the error carried.
 *
 * @param fn - The call expected to reject.
 * @returns The error's code and its message + details serialized.
 */
async function rejectedCall(fn: () => Promise<unknown>): Promise<RejectedCall> {
  let rejected: Maybe<RejectedCall>;

  try {
    await fn();
  } catch (e) {
    const error = e as { readonly message?: string; readonly details?: { readonly code?: string } };
    rejected = { code: error.details?.code, shown: `${error.message ?? ''} ${JSON.stringify(error.details ?? null)}` };
  }

  if (rejected == null) {
    throw new Error('expected the call to reject, but it resolved');
  }

  return rejected;
}

/**
 * Builds a mail signature set operation.
 *
 * @param itemKey - The item key.
 * @param html - The signature HTML.
 * @returns The set operation.
 */
function signatureSet(itemKey: string, html: string): UserExternalConnectionDataSetOperation {
  return { dataType: MAIL_SIGNATURE, itemKey, value: { html } };
}

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('userExternalConnection', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    /**
     * The read/update data callables, bound to one caller.
     *
     * @param u - The calling user.
     * @returns The bound callables.
     */
    function dataCallables(u: DemoApiAuthorizedUserTestContextFixture) {
      return {
        readData: (params: ReadUserExternalConnectionDataParams) => u.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(userExternalConnectionIdentity, params, 'data')) as Promise<ReadUserExternalConnectionDataResult>,
        updateData: (params: UpdateUserExternalConnectionDataParams) => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(userExternalConnectionIdentity, params, 'data')) as Promise<UpdateUserExternalConnectionDataResult>
      };
    }

    describe('admin owner', () => {
      demoAuthorizedUserAdminContext({ f }, (au) => {
        const { readData, updateData } = dataCallables(au);

        demoUserExternalConnectionContext({ f, u: au, createIfNeeded: true }, (uec) => {
          describe('update:data and read:data', () => {
            it('should set a microsoft mail signature and read it back', async () => {
              const result = await updateData({ providerType: MICROSOFT, set: [signatureSet(ME, '<p>Regards</p>')] });

              expect(result.items.length).toBe(1);
              expect(result.items[0].providerType).toBe(MICROSOFT);
              expect(result.items[0].dataType).toBe(MAIL_SIGNATURE);
              expect(result.items[0].itemKey).toBe(ME);
              expect(result.items[0].bytes).toBeGreaterThan(0);
              expect(JSON.stringify(result)).not.toContain('Regards');

              const read = await readData({ providerType: MICROSOFT });

              expect(read.data?.[MICROSOFT]?.[MAIL_SIGNATURE]?.[ME]).toEqual({ html: '<p>Regards</p>' });
              expect(read.items.map((x) => x.itemKey)).toEqual([ME]);
              expect(read.dataTypes.some((x) => x.providerType === MICROSOFT && x.dataType === MAIL_SIGNATURE && x.acceptsFile)).toBe(true);
            });

            it('should normalize a mailbox item key', async () => {
              await updateData({ providerType: MICROSOFT, set: [signatureSet('Support@Example.COM', '<p>Support</p>')] });

              const read = await readData({ providerType: MICROSOFT, dataType: MAIL_SIGNATURE });

              expect(read.data?.[MICROSOFT]?.[MAIL_SIGNATURE]?.['support@example.com']).toEqual({ html: '<p>Support</p>' });
            });

            it('should store a text signature', async () => {
              await updateData({ providerType: MICROSOFT, set: [{ dataType: MAIL_SIGNATURE, itemKey: ME, value: { text: 'Regards' } }] });

              const read = await readData({ providerType: MICROSOFT });

              expect(read.data?.[MICROSOFT]?.[MAIL_SIGNATURE]?.[ME]).toEqual({ text: 'Regards' });
            });

            it('should return summaries without values when keysOnly is set', async () => {
              await updateData({ providerType: MICROSOFT, set: [signatureSet(ME, '<p>Hidden</p>')] });

              const read = await readData({ providerType: MICROSOFT, keysOnly: true });

              expect(read.data).toBeUndefined();
              expect(read.items.map((x) => x.itemKey)).toEqual([ME]);
              expect(JSON.stringify(read)).not.toContain('Hidden');
            });

            it('should read one item when an item key is named', async () => {
              await updateData({ providerType: MICROSOFT, set: [signatureSet(ME, '<p>Mine</p>'), signatureSet('shared@example.com', '<p>Shared</p>')] });

              const read = await readData({ providerType: MICROSOFT, dataType: MAIL_SIGNATURE, itemKey: 'shared@example.com' });

              expect(read.items.map((x) => x.itemKey)).toEqual(['shared@example.com']);
              expect(read.data?.[MICROSOFT]?.[MAIL_SIGNATURE]?.[ME]).toBeUndefined();
            });

            it('should unset one item and keep the rest', async () => {
              await updateData({ providerType: MICROSOFT, set: [signatureSet(ME, '<p>Mine</p>'), signatureSet('shared@example.com', '<p>Shared</p>')] });

              const result = await updateData({ providerType: MICROSOFT, unset: [{ dataType: MAIL_SIGNATURE, itemKey: 'shared@example.com' }] });

              expect(result.items.map((x) => x.itemKey)).toEqual([ME]);
            });

            it('should unset a whole data type when no item key is named', async () => {
              await updateData({ providerType: MICROSOFT, set: [signatureSet(ME, '<p>Mine</p>'), signatureSet('shared@example.com', '<p>Shared</p>')] });

              const result = await updateData({ providerType: MICROSOFT, unset: [{ dataType: MAIL_SIGNATURE }] });

              expect(result.items).toEqual([]);
              expect((await readData({ providerType: MICROSOFT })).items).toEqual([]);
            });

            it('should clear the provider data', async () => {
              await updateData({ providerType: MICROSOFT, set: [signatureSet(ME, '<p>Mine</p>')] });

              const result = await updateData({ providerType: MICROSOFT, clear: true });

              expect(result.items).toEqual([]);
            });

            it('should apply clear before set in one write', async () => {
              await updateData({ providerType: MICROSOFT, set: [signatureSet('old@example.com', '<p>Old</p>')] });

              const result = await updateData({ providerType: MICROSOFT, clear: true, set: [signatureSet(ME, '<p>New</p>')] });

              expect(result.items.map((x) => x.itemKey)).toEqual([ME]);
            });

            it('should keep the data when the provider is disconnected', async () => {
              await updateData({ providerType: MICROSOFT, set: [signatureSet(ME, '<p>Kept</p>')] });
              await uec.connect({ providerType: MICROSOFT });
              await uec.disconnect({ providerType: MICROSOFT });

              const read = await readData({ providerType: MICROSOFT });

              expect(read.data?.[MICROSOFT]?.[MAIL_SIGNATURE]?.[ME]).toEqual({ html: '<p>Kept</p>' });
            });

            it('should delete the data with deleteAllUserExternalConnectionsForUser', async () => {
              await updateData({ providerType: MICROSOFT, set: [signatureSet(ME, '<p>Gone</p>')] });
              await uec.deleteAllUserExternalConnections();

              const providerData = await f.instance.userExternalConnectionDataServerActions.readUserExternalConnectionProviderData({ uid: au.uid, providerType: MICROSOFT });

              expect(providerData).toEqual({});
            });
          });

          describe('validation', () => {
            it('should refuse a data type the provider does not register', async () => {
              const rejected = await rejectedCall(() => updateData({ providerType: MICROSOFT, set: [{ dataType: 'not_registered', itemKey: ME, value: { html: SENTINEL } }] }));

              expect(rejected.code).toBe(USER_EXTERNAL_CONNECTION_DATA_TYPE_NOT_ALLOWED_ERROR_CODE);
              expect(rejected.shown).not.toContain(SENTINEL);
            });

            it('should refuse an invalid item key', async () => {
              const rejected = await rejectedCall(() => updateData({ providerType: MICROSOFT, set: [signatureSet('not a mailbox', SENTINEL)] }));

              expect(rejected.code).toBe(USER_EXTERNAL_CONNECTION_DATA_ITEM_KEY_INVALID_ERROR_CODE);
              expect(rejected.shown).not.toContain(SENTINEL);
            });

            it('should refuse a value with both html and text, without echoing it', async () => {
              const rejected = await rejectedCall(() => updateData({ providerType: MICROSOFT, set: [{ dataType: MAIL_SIGNATURE, itemKey: ME, value: { html: SENTINEL, text: SENTINEL } }] }));

              expect(rejected.code).toBe(USER_EXTERNAL_CONNECTION_DATA_VALUE_INVALID_ERROR_CODE);
              expect(rejected.shown).not.toContain(SENTINEL);
            });

            it('should refuse a value with an unknown key, without echoing it', async () => {
              const rejected = await rejectedCall(() => updateData({ providerType: MICROSOFT, set: [{ dataType: MAIL_SIGNATURE, itemKey: ME, value: { html: SENTINEL, [SENTINEL]: SENTINEL } }] }));

              expect(rejected.code).toBe(USER_EXTERNAL_CONNECTION_DATA_VALUE_INVALID_ERROR_CODE);
              expect(rejected.shown).not.toContain(SENTINEL);
            });

            it('should leave the stored data unchanged when a write is refused', async () => {
              await updateData({ providerType: MICROSOFT, set: [signatureSet(ME, '<p>Before</p>')] });
              await rejectedCall(() => updateData({ providerType: MICROSOFT, set: [signatureSet('shared@example.com', '<p>After</p>'), signatureSet('not a mailbox', '<p>Bad</p>')] }));

              const read = await readData({ providerType: MICROSOFT });

              expect(read.items.map((x) => x.itemKey)).toEqual([ME]);
            });
          });

          describe('limits', () => {
            it('should refuse a value over the data type byte limit', async () => {
              const rejected = await rejectedCall(() => updateData({ providerType: MICROSOFT, set: [signatureSet(ME, SENTINEL + 'x'.repeat(MICROSOFT_MAIL_SIGNATURE_MAX_VALUE_BYTES))] }));

              expect(rejected.code).toBe(USER_EXTERNAL_CONNECTION_DATA_TOO_LARGE_ERROR_CODE);
              expect(rejected.shown).not.toContain(SENTINEL);
            });

            it('should refuse more operations than one update allows', async () => {
              const set = Array.from({ length: USER_EXTERNAL_CONNECTION_DATA_MAX_OPERATIONS + 1 }, (_, i) => signatureSet(`user${i}@example.com`, '<p>x</p>'));
              const rejected = await rejectedCall(() => updateData({ providerType: MICROSOFT, set }));

              expect(rejected.code).toBe(USER_EXTERNAL_CONNECTION_DATA_TOO_LARGE_ERROR_CODE);
            });

            it('should refuse more items than the data type allows', async () => {
              const set = Array.from({ length: USER_EXTERNAL_CONNECTION_DATA_MAX_OPERATIONS }, (_, i) => signatureSet(`user${i}@example.com`, '<p>x</p>'));
              await updateData({ providerType: MICROSOFT, set });

              const rejected = await rejectedCall(() => updateData({ providerType: MICROSOFT, set: [signatureSet(ME, '<p>One too many</p>')] }));

              expect(rejected.code).toBe(USER_EXTERNAL_CONNECTION_DATA_TOO_LARGE_ERROR_CODE);
            });
          });
        });
      });
    });

    // kept out of the 'admin owner' describe: a fixture context registers its hooks on the enclosing describe, so a
    // sibling createIfNeeded context there would create the /uec document for these tests too
    describe('admin owner without a /uec document', () => {
      demoAuthorizedUserAdminContext({ f }, (au) => {
        const { readData, updateData } = dataCallables(au);

        it('should refuse read:data, which checks the data role on it', async () => {
          await expect(readData({ providerType: MICROSOFT })).rejects.toThrow();
        });

        it('should refuse update:data, which checks the data role on it', async () => {
          await expect(updateData({ providerType: MICROSOFT, set: [signatureSet(ME, '<p>x</p>')] })).rejects.toThrow();
        });
      });
    });

    describe('non-admin owner', () => {
      demoAuthorizedUserContext({ f }, (u) => {
        const { readData, updateData } = dataCallables(u);

        demoUserExternalConnectionContext({ f, u, createIfNeeded: true }, () => {
          it('should refuse update:data for the admin-only microsoft provider', async () => {
            const rejected = await rejectedCall(() => updateData({ providerType: MICROSOFT, set: [signatureSet(ME, SENTINEL)] }));

            expect(rejected.code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE);
            expect(rejected.shown).not.toContain(SENTINEL);
          });

          it('should refuse read:data for the admin-only microsoft provider', async () => {
            const rejected = await rejectedCall(() => readData({ providerType: MICROSOFT }));

            expect(rejected.code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE);
          });

          it('should refuse a data type an open provider does not register', async () => {
            const rejected = await rejectedCall(() => updateData({ providerType: ZOHO, set: [signatureSet(ME, SENTINEL)] }));

            expect(rejected.code).toBe(USER_EXTERNAL_CONNECTION_DATA_TYPE_NOT_ALLOWED_ERROR_CODE);
            expect(rejected.shown).not.toContain(SENTINEL);
          });

          it('should hide the data and data types of providers the caller cannot connect when no provider is named', async () => {
            // staged around the callable, which would refuse it: data the user can no longer reach (e.g. after losing admin)
            await f.instance.userExternalConnectionDataServerActions.updateUserExternalConnectionData({ uid: u.uid, params: { providerType: MICROSOFT, set: [signatureSet(ME, SENTINEL)] } });

            const read = await readData({});

            expect(read.data?.[MICROSOFT]).toBeUndefined();
            expect(read.items.some((x) => x.providerType === MICROSOFT)).toBe(false);
            expect(read.dataTypes.some((x) => x.providerType === MICROSOFT)).toBe(false);
            expect(JSON.stringify(read)).not.toContain(SENTINEL);
          });
        });
      });
    });

    describe('MCP surface', () => {
      demoAuthorizedUserContext({ f }, (u) => {
        const readDataMethod = mcpMethodIdForDispatch({ modelType: userExternalConnectionIdentity.modelType, call: 'read', specifier: 'data' });
        const updateDataMethod = mcpMethodIdForDispatch({ modelType: userExternalConnectionIdentity.modelType, call: 'update', specifier: 'data' });

        it('should list read:data as a read method', async () => {
          const { details } = await describeMcpMethod({ f, u, method: readDataMethod });

          expect(details?.kind).toBe('read');
          expect(details?.invokeWith).toBe(mcpCompactToolNames(f).read);
        });

        it('should list update:data as a write method whose unset and clear escalate to destructive', async () => {
          const names = mcpCompactToolNames(f);
          const { details } = await describeMcpMethod({ f, u, method: updateDataMethod });

          expect(details?.kind).toBe('write');
          expect(details?.invokeWith).toBe(names.write);
          expect(details?.escalatingParams?.['unset']?.kind).toBe('destructive');
          expect(details?.escalatingParams?.['clear']?.kind).toBe('destructive');
          expect(details?.escalatingParams?.['set']).toBeUndefined();
        });
      });
    });
  });
});
