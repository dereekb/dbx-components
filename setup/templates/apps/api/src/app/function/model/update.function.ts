import { inAuthContext, onCallUpdateModel } from '@dereekb/firebase-server';
import { APP_CODE_PREFIXOnCallUpdateModelMap, onCallWithAPP_CODE_PREFIXNestContext } from '../function';

export const APP_CODE_PREFIX_LOWERUpdateModelMap: APP_CODE_PREFIXOnCallUpdateModelMap = {};

export const APP_CODE_PREFIX_LOWERUpdateModel = onCallWithAPP_CODE_PREFIXNestContext(inAuthContext(onCallUpdateModel(APP_CODE_PREFIX_LOWERUpdateModelMap)));
