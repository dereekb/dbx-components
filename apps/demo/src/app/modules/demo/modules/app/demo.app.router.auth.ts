import { type HasAuthStateData, redirectBasedOnAuthUserState } from '@dereekb/dbx-core';

export const DEMO_APP_STATE_DATA: HasAuthStateData = {
  authStates: 'user', // Onboarded users only.
  redirectTo: redirectBasedOnAuthUserState({
    // other states default to demo.auth, per configuration in the root module.
    new: { ref: 'demo.onboard' }
  })
};
