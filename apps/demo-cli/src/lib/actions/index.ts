import { type ActionCommandSpec } from '@dereekb/dbx-cli';
import { queryAllPublishedGuestbookEntriesAction, queryGuestbookEntriesForGuestbookAction } from './guestbook.actions';

export * from './guestbook.actions';

/**
 * Action specs registered for the demo CLI.
 */
export const DEMO_CLI_ACTION_COMMANDS: ReadonlyArray<ActionCommandSpec> = [queryGuestbookEntriesForGuestbookAction, queryAllPublishedGuestbookEntriesAction];
