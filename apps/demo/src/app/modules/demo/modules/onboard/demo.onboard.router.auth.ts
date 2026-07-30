import { type HasAuthStateData, redirectBasedOnAuthUserState } from '@dereekb/dbx-core';

export const DEMO_ONBOARD_STATE_DATA: HasAuthStateData = {
  authStates: 'new', // New users only
  redirectTo: redirectBasedOnAuthUserState({
    user: { ref: 'demo.app' }
  })
};
