import { type Request } from 'express';

export interface AppCheckRequest extends Request {
  skipAppCheck?: boolean;
}
