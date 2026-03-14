import { type Request } from 'express';

/**
 * Extended Express request with an optional flag to skip AppCheck verification.
 *
 * Set by the {@link SkipAppCheck} decorator to bypass verification for specific routes.
 */
export interface AppCheckRequest extends Request {
  skipAppCheck?: boolean;
}
