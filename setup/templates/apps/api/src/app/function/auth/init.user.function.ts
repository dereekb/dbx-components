import { UserRecord } from 'firebase-admin/auth';
import * as functions from 'firebase-functions/v1';
import { onGen1EventWithAPP_CODE_PREFIXNestContext } from '../function';

export const initUserOnCreate = onGen1EventWithAPP_CODE_PREFIXNestContext<UserRecord>((withNest) =>
  functions.auth.user().onCreate(withNest(async (request) => {
    const { nest, data } = request;
    const uid = data.uid;

    // TODO: Do something

  }))
);
