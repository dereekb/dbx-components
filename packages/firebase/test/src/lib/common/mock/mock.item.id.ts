import { type FirestoreModelKey } from '@dereekb/firebase';

/**
 * Type alias for a {@link FirestoreModelKey} identifying a {@link MockItemUser} document.
 *
 * Provides semantic clarity when a function parameter specifically expects a MockItemUser key
 * rather than a generic model key.
 */
export type MockItemUserKey = FirestoreModelKey;
