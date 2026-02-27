import { type AuthBlockingEvent, beforeUserCreated } from 'firebase-functions/v2/identity';
import { blockingEventWithDemoNestContext } from '../function';

/**
 * Listens for users to be created and initializes them.
 */
export const initUserOnCreate = blockingEventWithDemoNestContext<AuthBlockingEvent, void>((withNest) =>
  beforeUserCreated(
    withNest(async (request) => {
      const { nest, data } = request;
      const uid = data?.uid;

      if (uid) {
        await nest.profileActions.initProfileForUid(uid);
      }
    })
  )
);
