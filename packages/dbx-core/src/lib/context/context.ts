/**
 * A contextual state identifier for a specific section of the app.
 *
 * Some examples are:
 * - init: The default context that is initialized.
 * - public: A public part of the app.
 * - onboarding: The onboarding section of the app.
 * - app: The main portion of the app.
 *
 * More complex apps may have more sub-sections or app portions that could each have their own context state.
 */
export type DbxAppContextState = string;

/**
 * The init state of an app after the default context has been initialized.
 */
export const DBX_INIT_APP_CONTEXT_STATE = 'init';
/**
 * The public state of an app, typically when a user opens up the site to a public page.
 */
export const DBX_PUBLIC_APP_CONTEXT_STATE = 'public';
/**
 * The auth state of an app, typically when a user has not finished logging in.
 */
export const DBX_AUTH_APP_CONTEXT_STATE = 'auth';
/**
 * The onboarding state of an app, typically when a user has completed auth but not finished setting up their account.
 */
export const DBX_ONBOARD_APP_CONTEXT_STATE = 'onboard';
/**
 * The app state of an app, typically when a user has completed auth and onboarding.
 */
export const DBX_APP_APP_CONTEXT_STATE = 'app';

/**
 * Default AppContextStates.
 *
 * Your app may not use these, but this type is available for convenience.
 */
export type DbxKnownAppContextState = typeof DBX_INIT_APP_CONTEXT_STATE | typeof DBX_PUBLIC_APP_CONTEXT_STATE | typeof DBX_AUTH_APP_CONTEXT_STATE | typeof DBX_ONBOARD_APP_CONTEXT_STATE | typeof DBX_APP_APP_CONTEXT_STATE;

/**
 * Array of all DbxKnownAppContextState values, minus the init state.
 */
export const DBX_KNOWN_APP_CONTEXT_STATES: DbxKnownAppContextState[] = [DBX_PUBLIC_APP_CONTEXT_STATE, DBX_AUTH_APP_CONTEXT_STATE, DBX_ONBOARD_APP_CONTEXT_STATE, DBX_APP_APP_CONTEXT_STATE];
