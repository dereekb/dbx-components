import { type UserRecord } from 'firebase-admin/lib/auth/user-record';
import * as functions from 'firebase-functions/v1';
import { onGen1EventWithDemoNestContext } from '../function';

/**
 * Listens for users to be created and initializes them.
 */
export const initUserOnCreate = onGen1EventWithDemoNestContext<UserRecord>((withNest) =>
  functions.auth.user().onCreate(
    withNest(async (request) => {
      const { nest, data } = request;
      const uid = data.uid;

      if (uid) {
        await nest.profileActions.initProfileForUid(uid);
      }
    })
  )
);
