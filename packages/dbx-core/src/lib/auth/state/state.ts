import type * as fromDbxAppAuth from './reducer';

/**
 * Top-level NgRx state interface that includes the dbx-core auth feature state.
 *
 * This type extends the root NgRx store state with the auth feature slice keyed by
 * the `'app.auth'` feature key. Use this type when injecting the NgRx `Store` in services
 * or effects that need access to the auth state selectors.
 *
 * @see {@link fromDbxAppAuth.DbxAppAuthFeatureState} for the shape of the auth feature slice.
 * @see {@link DbxAppAuthStateService} for a convenience service wrapping store access.
 */
export type DbxAppAuthFullState = fromDbxAppAuth.State;
