import { createParamDecorator, type ExecutionContext, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { type Request } from 'express';
import rawbody from 'raw-body';
import { parse as parseQueryString, type ParsedUrlQuery } from 'querystring';

/**
 * Buffer type alias representing a raw HTTP request body before any parsing.
 */
export type RawBodyBuffer = Buffer;

/**
 * NestJS parameter decorator that reads the raw request body directly from the incoming stream.
 *
 * Requires the request to still be readable (i.e., no prior body-parsing middleware has consumed it).
 *
 * @throws {BadRequestException} When the request stream is not readable
 *
 * @example
 * ```typescript
 * @Post('webhook')
 * handleWebhook(@ParseRawBody() body: RawBodyBuffer) { ... }
 * ```
 */
export const ParseRawBody = createParamDecorator(async (_, context: ExecutionContext) => {
  const req: Request = context.switchToHttp().getRequest();
  if (!req.readable) {
    console.error('RawBody request was not readable. This is generally due to bad configuration.');
    throw new BadRequestException('Invalid body');
  }

  const body = await rawbody(req);
  return body as RawBodyBuffer;
});

/**
 * NestJS parameter decorator that retrieves the already-parsed raw body buffer from `req.body`.
 *
 * Expects that a prior middleware (e.g., raw body middleware) has already set `req.body` to a Buffer.
 *
 * @throws {InternalServerErrorException} When `req.body` is not a Buffer
 *
 * @example
 * ```typescript
 * @Post('webhook')
 * handleWebhook(@RawBody() body: RawBodyBuffer) { ... }
 * ```
 */
export const RawBody = createParamDecorator(async (_, context: ExecutionContext) => {
  const req: Request = context.switchToHttp().getRequest();
  const body = req.body as RawBodyBuffer;

  if (!Buffer.isBuffer(body)) {
    console.error('RawBody expected a buffer set to req.body.');
    throw new InternalServerErrorException('failed parsing body');
  }

  return body;
});

/**
 * NestJS parameter decorator that parses the raw body buffer as a URL-encoded query string
 * and replaces `req.body` with the parsed result.
 *
 * @example
 * ```typescript
 * @Post('form')
 * handleForm(@ParsedQueryRawBody() body: ParsedUrlQuery) { ... }
 * ```
 */
export const ParsedQueryRawBody = createParamDecorator(async (_, context: ExecutionContext) => {
  const req: Request = context.switchToHttp().getRequest();
  req.body = RawBodyToParsedQueryString(req.body as RawBodyBuffer);
  return req.body;
});

/**
 * Parses a raw body buffer as JSON.
 *
 * @param rawBody - The raw body buffer to parse
 * @returns The parsed JSON object
 * @throws {SyntaxError} When the body is not valid JSON
 *
 * @example
 * ```typescript
 * const data = RawBodyToJson<{ id: string }>(rawBody);
 * ```
 */
export function RawBodyToJson<T extends object>(rawBody: RawBodyBuffer): T {
  const string = RawBodyToString(rawBody);
  return JSON.parse(string);
}

/**
 * Parses a raw body buffer as a URL-encoded query string.
 *
 * @param rawBody - The raw body buffer to parse
 * @returns The parsed query parameters
 *
 * @example
 * ```typescript
 * const params = RawBodyToParsedQueryString(rawBody); // { key: "value" }
 * ```
 */
export function RawBodyToParsedQueryString(rawBody: RawBodyBuffer): ParsedUrlQuery {
  const string = RawBodyToString(rawBody);
  return parseQueryString(string);
}

/**
 * Converts a raw body buffer to a trimmed UTF-8 string.
 *
 * @param rawBody - The raw body buffer to convert
 * @returns The decoded and trimmed string content
 *
 * @example
 * ```typescript
 * const text = RawBodyToString(rawBody);
 * ```
 */
export function RawBodyToString(rawBody: RawBodyBuffer): string {
  return rawBody.toString('utf8').trim();
}
