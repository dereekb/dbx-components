import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type Request } from 'express';

/**
 * Returns true if the request is from localhost.
 */
export const IsRequestFromLocalHost = createParamDecorator((data: unknown, context: ExecutionContext) => {
  return isLocalhost(context);
});

/**
 * Returns true if the request's origin header indicates the request came from localhost.
 *
 * Checks for both http://localhost and https://localhost origins.
 *
 * @param context - the NestJS execution context containing the HTTP request
 * @returns true if the request origin is localhost
 */
export function isLocalhost(context: ExecutionContext): boolean {
  const req: Request = context.switchToHttp().getRequest();
  const origin = req.headers['origin'] ?? '';
  return origin.startsWith('http://localhost') || origin.startsWith('https://localhost');
}
