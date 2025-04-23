import { onCallModel, type OnCallModelMap, onCallReadModel, onCallCreateModel, onCallDeleteModel, onCallUpdateModel,inAuthContext } from '@dereekb/firebase-server';
import { APP_CODE_PREFIXOnCallCreateModelMap, APP_CODE_PREFIXOnCallReadModelMap, APP_CODE_PREFIXOnCallUpdateModelMap, APP_CODE_PREFIXOnCallDeleteModelMap, onCallWithAPP_CODE_PREFIXNestContext } from '../function';
import { updateProfile, updateProfileCreateTestNotification, updateProfileUsername, updateProfleOnboarding } from '../profile/profile.update';

// MARK: Create
export const APP_CODE_PREFIX_LOWERCreateModelMap: APP_CODE_PREFIXOnCallCreateModelMap = {};

// MARK: Read
export const APP_CODE_PREFIX_LOWERReadModelMap: APP_CODE_PREFIXOnCallReadModelMap = {};

// MARK: Update
export const APP_CODE_PREFIX_LOWERUpdateModelMap: APP_CODE_PREFIXOnCallUpdateModelMap = {
  profile: onCallSpecifierHandler({
    _: updateProfile,
    onboard: updateProfleOnboarding,
  })
};

// MARK: Delete
export const APP_CODE_PREFIX_LOWERDeleteModelMap: APP_CODE_PREFIXOnCallDeleteModelMap = {};

// MARK: Call
export const APP_CODE_PREFIX_LOWERCallModelMap: OnCallModelMap = {
  create: onCallCreateModel(APP_CODE_PREFIX_LOWERCreateModelMap),
  read: onCallReadModel(APP_CODE_PREFIX_LOWERReadModelMap),
  update: onCallUpdateModel(APP_CODE_PREFIX_LOWERUpdateModelMap),
  delete: onCallDeleteModel(APP_CODE_PREFIX_LOWERDeleteModelMap)
};

export const APP_CODE_PREFIX_LOWERCallModel = onCallWithAPP_CODE_PREFIXNestContext(inAuthContext(onCallModel(APP_CODE_PREFIX_LOWERCallModelMap)));
