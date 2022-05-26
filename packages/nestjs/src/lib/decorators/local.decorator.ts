import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Returns true if the request is from localhost:4200.
 */
export const IsRequestFromLocalHost = createParamDecorator((data: unknown, context: ExecutionContext) => {
  return isLocalhost(context);
});

export function isLocalhost(context: ExecutionContext): boolean {
  const req: Request = context.switchToHttp().getRequest();
  const origin = req.headers['origin'] ?? '';
  return origin.startsWith('http://localhost') || origin.startsWith('https://localhost');
}
