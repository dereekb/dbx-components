import { FirebaseAuthUserId } from '@dereekb/firebase';

export type GuestbookId = string;
export type GuestbookKey = string;

/**
 * Corresponds to the user that create the entry.
 */
export type GuestbookEntryId = FirebaseAuthUserId;
export type GuestbookEntryKey = string;
