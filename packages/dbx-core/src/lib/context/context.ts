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

export const DBX_INIT_APP_CONTEXT_STATE = 'init';
/**
 *
 */
export const DBX_PUBLIC_APP_CONTEXT_STATE = 'public';
/**
 *
 */
export const DBX_AUTH_APP_CONTEXT_STATE = 'auth';
/**
 *
 */
export const DBX_ONBOARDING_APP_CONTEXT_STATE = 'onboarding';
/**
 *
 */
export const DBX_APP_APP_CONTEXT_STATE = 'app';

/**
 * Default AppContextStates.
 *
 * Your app may not use these, but this type is available for convenience.
 */
export type DbxKnownAppContextState = typeof DBX_INIT_APP_CONTEXT_STATE | typeof DBX_PUBLIC_APP_CONTEXT_STATE | typeof DBX_AUTH_APP_CONTEXT_STATE | typeof DBX_ONBOARDING_APP_CONTEXT_STATE | typeof DBX_APP_APP_CONTEXT_STATE;

/**
 * Array of all DbxKnownAppContextState values, minus the init state.
 */
export const DBX_KNOWN_APP_CONTEXT_STATES: DbxKnownAppContextState[] = [DBX_PUBLIC_APP_CONTEXT_STATE, DBX_AUTH_APP_CONTEXT_STATE, DBX_ONBOARDING_APP_CONTEXT_STATE, DBX_APP_APP_CONTEXT_STATE];
