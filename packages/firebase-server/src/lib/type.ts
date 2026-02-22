import { type CallableRequest } from 'firebase-functions/v2/https';

/**
 * CallableRequest auth data.
 */
export type AuthData = NonNullable<CallableRequest['auth']>;

/**
 * CallableRequest context data (omits data and stream configs).
 */
export type CallableContext = Omit<CallableRequest<any>, 'data' | 'acceptsStreaming'>;
