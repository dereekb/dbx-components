import { AsyncFirebaseFunctionCreateAction, AsyncFirebaseFunctionUpdateAction, FirebaseFunctionUpdateAction } from '@dereekb/firebase';
import { GuestbookDocument, GuestbookEntryDocument } from './guestbook';

export type AsyncGuestbookCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, GuestbookDocument>;

export type GuestbookEntryUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, GuestbookEntryDocument>;
export type AsyncGuestbookEntryUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, GuestbookEntryDocument>;
export type AsyncGuestbookEntryAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, GuestbookEntryDocument>;
