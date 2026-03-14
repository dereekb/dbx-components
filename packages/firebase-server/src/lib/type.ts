import { type CallableRequest } from 'firebase-functions/v2/https';

/**
 * The authenticated user's data from a Firebase v2 {@link CallableRequest}.
 *
 * Non-nullable — use this type when auth is guaranteed to be present.
 */
export type AuthData = NonNullable<CallableRequest['auth']>;

/**
 * The request context from a Firebase v2 callable function, excluding the payload and streaming fields.
 *
 * Used throughout `@dereekb/firebase-server` as the standard callable context type
 * passed to auth services and function handlers.
 */
export type CallableContext = Omit<CallableRequest<any>, 'data' | 'acceptsStreaming'>;
