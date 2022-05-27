import { Request } from 'express';
import { AppCheckRequest } from './appcheck';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * nestjs decorator that will instruct FirebaseAppCheckMiddleware to skip AppCheck for related requests.
 */
export const SkipAppCheck = createParamDecorator(async (_, context: ExecutionContext) => {
  const req: Request = context.switchToHttp().getRequest<Request>();
  (req as AppCheckRequest).skipAppCheck = true;
});
