import { type AsyncFirebaseFunctionCreateAction, type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionUpdateAction } from '@dereekb/firebase';
import { type GuestbookDocument, type GuestbookEntryDocument } from './guestbook';

export type AsyncGuestbookCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, GuestbookDocument>;
export type AsyncGuestbookUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, GuestbookDocument>;

export type GuestbookEntryUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, GuestbookEntryDocument>;
export type AsyncGuestbookEntryUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, GuestbookEntryDocument>;
export type AsyncGuestbookEntryAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, GuestbookEntryDocument>;
