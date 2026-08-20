import { type ActionCommandSpec } from '@dereekb/dbx-cli';
import { ALL_PUBLISHED_GUESTBOOK_ENTRIES_INVOKE_ACTION, QUERY_ALL_PUBLISHED_GUESTBOOK_ENTRIES_ACTION, QUERY_GUESTBOOK_ENTRIES_FOR_GUESTBOOK_ACTION } from './guestbook.actions';
import { QUERY_PUBLISHED_GUESTBOOK_ENTRIES_DIRECT_ACTION } from './guestbook.firestore.actions';

export * from './guestbook.actions';
export * from './guestbook.firestore.actions';

/**
 * Action specs registered for the demo CLI.
 */
export const DEMO_CLI_ACTION_COMMANDS: ReadonlyArray<ActionCommandSpec> = [QUERY_GUESTBOOK_ENTRIES_FOR_GUESTBOOK_ACTION, QUERY_ALL_PUBLISHED_GUESTBOOK_ENTRIES_ACTION, ALL_PUBLISHED_GUESTBOOK_ENTRIES_INVOKE_ACTION, QUERY_PUBLISHED_GUESTBOOK_ENTRIES_DIRECT_ACTION];
