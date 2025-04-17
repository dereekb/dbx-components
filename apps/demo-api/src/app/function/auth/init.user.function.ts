import { UserRecord } from 'firebase-admin/lib/auth/user-record';
import * as functions from 'firebase-functions/v1';
import { onEventWithDemoNestContext } from '../function';

/**
 * Listens for users to be created and initializes them.
 */
export const initUserOnCreate = onEventWithDemoNestContext<UserRecord>((withNest) =>
  functions.auth.user().onCreate(
    withNest(async (request) => {
      const { nest, auth, data } = request;
      const uid = data.uid;

      if (uid) {
        await nest.profileActions.initProfileForUid(uid);
      }
    })
  )
);
