import { AsyncFirebaseFunctionUpdateAction, FirebaseFunctionUpdateAction } from "@dereekb/firebase";
import { GuestbookEntryDocument } from "./guestbook";

export type GuestbookEntryUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, GuestbookEntryDocument>;
export type AsyncGuestbookEntryUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, GuestbookEntryDocument>;
export type AsyncGuestbookEntryAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, GuestbookEntryDocument>;
