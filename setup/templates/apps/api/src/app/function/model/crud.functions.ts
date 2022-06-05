import { inAuthContext, onCallCreateModel, onCallDeleteModel, onCallUpdateModel } from '@dereekb/firebase-server';
import { APP_CODE_PREFIXOnCallCreateModelMap, APP_CODE_PREFIXOnCallUpdateModelMap, APP_CODE_PREFIXOnCallDeleteModelMap, onCallWithAPP_CODE_PREFIXNestContext } from '../function';

// MARK: Create
export const APP_CODE_PREFIX_LOWERCreateModelMap: APP_CODE_PREFIXOnCallCreateModelMap = {};
export const APP_CODE_PREFIX_LOWERCreateModel = onCallWithAPP_CODE_PREFIXNestContext(inAuthContext(onCallCreateModel(APP_CODE_PREFIX_LOWERCreateModelMap)));

// MARK: Update
export const APP_CODE_PREFIX_LOWERUpdateModelMap: APP_CODE_PREFIXOnCallUpdateModelMap = {};
export const APP_CODE_PREFIX_LOWERUpdateModel = onCallWithAPP_CODE_PREFIXNestContext(inAuthContext(onCallUpdateModel(APP_CODE_PREFIX_LOWERUpdateModelMap)));

// MARK: Delete
export const APP_CODE_PREFIX_LOWERDeleteModelMap: APP_CODE_PREFIXOnCallDeleteModelMap = {};
export const APP_CODE_PREFIX_LOWERDeleteModel = onCallWithAPP_CODE_PREFIXNestContext(inAuthContext(onCallDeleteModel(APP_CODE_PREFIX_LOWERDeleteModelMap)));
