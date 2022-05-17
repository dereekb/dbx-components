import { UserRecord } from 'firebase-admin/lib/auth/user-record';
import * as functions from 'firebase-functions';
import { onEventWithAPP_CODE_PREFIXNestContext } from '../function';

export const initUserOnCreate = onEventWithAPP_CODE_PREFIXNestContext<UserRecord>((withNest) =>
  functions.auth.user().onCreate(withNest(async (nest, data: UserRecord, context) => {
    const uid = data.uid;

    // TODO: Do something

  }))
);
