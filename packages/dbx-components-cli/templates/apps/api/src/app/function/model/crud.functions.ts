import { inAuthContext, onCallCreateModel, onCallDeleteModel, onCallUpdateModel, onCallSpecifierHandler, onCallReadModel, onCallModel, type OnCallModelMap } from '@dereekb/firebase-server';
import { type APP_CODE_PREFIXOnCallCreateModelMap, type APP_CODE_PREFIXOnCallReadModelMap, type APP_CODE_PREFIXOnCallUpdateModelMap, type APP_CODE_PREFIXOnCallDeleteModelMap, onCallWithAPP_CODE_PREFIXNestContext } from '../function';
import { updateProfile, updateProfleOnboarding } from '../profile/profile.update';
import { storageFileUpdate, storageFileProcess } from '../storagefile/storagefile.update';
import { storageFileCreate, storageFileInitializeFromUpload, storageFileInitializeAllFromUploads } from '../storagefile/storagefile.create';
import { APP_CODE_PREFIX_CAMELCallModelConfig } from './crud.config';
// @dbx-addon:oidc:api-crud:imports

// MARK: Create
export const APP_CODE_PREFIX_CAMELCreateModelMap: APP_CODE_PREFIXOnCallCreateModelMap = {
  storageFile: onCallSpecifierHandler({
    _: storageFileCreate,
    fromUpload: storageFileInitializeFromUpload,
    allFromUpload: storageFileInitializeAllFromUploads
  })
  // @dbx-addon:oidc:api-crud:create
};

// MARK: Read
export const APP_CODE_PREFIX_CAMELReadModelMap: APP_CODE_PREFIXOnCallReadModelMap = {};

// MARK: Update
export const APP_CODE_PREFIX_CAMELUpdateModelMap: APP_CODE_PREFIXOnCallUpdateModelMap = {
  profile: onCallSpecifierHandler({
    _: updateProfile,
    onboard: updateProfleOnboarding
  }),
  storageFile: onCallSpecifierHandler({
    _: storageFileUpdate,
    process: storageFileProcess
  })
  // @dbx-addon:oidc:api-crud:update
};

// MARK: Delete
export const APP_CODE_PREFIX_CAMELDeleteModelMap: APP_CODE_PREFIXOnCallDeleteModelMap = {
  // @dbx-addon:oidc:api-crud:delete
};

// MARK: Call
export const APP_CODE_PREFIX_CAMELCallModelMap: OnCallModelMap = {
  create: onCallCreateModel(APP_CODE_PREFIX_CAMELCreateModelMap),
  read: onCallReadModel(APP_CODE_PREFIX_CAMELReadModelMap),
  update: onCallUpdateModel(APP_CODE_PREFIX_CAMELUpdateModelMap),
  delete: onCallDeleteModel(APP_CODE_PREFIX_CAMELDeleteModelMap)
};

/**
 * The raw onCallModel dispatch function (with _apiDetails attached). Split out so
 * the Model API + MCP controllers can dispatch + introspect it directly. The
 * `oidc` add-on overwrites {@link APP_CODE_PREFIX_CAMELCallModelConfig} to wire
 * `oidcCallModelScopePreAssert()` so OIDC-bearer callers must hold the matching
 * `model.<call>` scope.
 */
export const APP_CODE_PREFIX_CAMELCallModelFn = onCallModel(APP_CODE_PREFIX_CAMELCallModelMap, APP_CODE_PREFIX_CAMELCallModelConfig);

export const APP_CODE_PREFIX_CAMELCallModel = onCallWithAPP_CODE_PREFIXNestContext(inAuthContext(APP_CODE_PREFIX_CAMELCallModelFn));
