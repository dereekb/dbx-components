import { type HasAuthStateData, redirectBasedOnAuthUserState } from '@dereekb/dbx-core';

export const DEMO_AUTH_STATE_DATA: HasAuthStateData = {
  authStates: 'none', // User who aren't logged in.
  redirectTo: redirectBasedOnAuthUserState({
    new: { ref: 'demo.onboard' },
    user: { ref: 'demo.app' }
  })
};
