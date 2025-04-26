import { inAuthContext, onCallCreateModel, onCallDeleteModel, onCallUpdateModel, onCallSpecifierHandler, onCallReadModel, onCallModel, OnCallModelMap } from '@dereekb/firebase-server';
import { APP_CODE_PREFIXOnCallCreateModelMap, APP_CODE_PREFIXOnCallReadModelMap, APP_CODE_PREFIXOnCallUpdateModelMap, APP_CODE_PREFIXOnCallDeleteModelMap, onCallWithAPP_CODE_PREFIXNestContext } from '../function';
import { updateProfile, updateProfleOnboarding } from '../profile/profile.update';

// MARK: Create
export const APP_CODE_PREFIX_CAMELCreateModelMap: APP_CODE_PREFIXOnCallCreateModelMap = {};

// MARK: Read
export const APP_CODE_PREFIX_CAMELReadModelMap: APP_CODE_PREFIXOnCallReadModelMap = {};

// MARK: Update
export const APP_CODE_PREFIX_CAMELUpdateModelMap: APP_CODE_PREFIXOnCallUpdateModelMap = {
  profile: onCallSpecifierHandler({
    _: updateProfile,
    onboard: updateProfleOnboarding,
  })
};

// MARK: Delete
export const APP_CODE_PREFIX_CAMELDeleteModelMap: APP_CODE_PREFIXOnCallDeleteModelMap = {};

// MARK: Call
export const APP_CODE_PREFIX_CAMELCallModelMap: OnCallModelMap = {
  create: onCallCreateModel(APP_CODE_PREFIX_CAMELCreateModelMap),
  read: onCallReadModel(APP_CODE_PREFIX_CAMELReadModelMap),
  update: onCallUpdateModel(APP_CODE_PREFIX_CAMELUpdateModelMap),
  delete: onCallDeleteModel(APP_CODE_PREFIX_CAMELDeleteModelMap)
};

export const APP_CODE_PREFIX_CAMELCallModel = onCallWithAPP_CODE_PREFIXNestContext(inAuthContext(onCallModel(APP_CODE_PREFIX_CAMELCallModelMap)));
