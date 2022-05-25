import { createParamDecorator, ExecutionContext, BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { Request } from "express";
import * as rawbody from 'raw-body';
import { parse as parseQueryString, ParsedUrlQuery } from "querystring";

export type RawBodyBuffer = Buffer;

export const ParseRawBody = createParamDecorator(async (_, context: ExecutionContext) => {
  const req: Request = context.switchToHttp().getRequest();
  if (!req.readable) {
    console.error('RawBody request was not readable. This is generally due to bad configuration.');
    throw new BadRequestException("Invalid body");
  }

  const body = (await rawbody(req));
  return body as RawBodyBuffer;
});

export const RawBody = createParamDecorator(async (_, context: ExecutionContext) => {
  const req: Request = context.switchToHttp().getRequest();
  const body = req.body as RawBodyBuffer;

  if (!Buffer.isBuffer(body)) {
    console.error('RawBody expected a buffer set to req.body.')
    throw new InternalServerErrorException('failed parsing body');
  }

  return body;
});

export const ParsedQueryRawBody = createParamDecorator(async (_, context: ExecutionContext) => {
  const req: Request = context.switchToHttp().getRequest();
  req.body = RawBodyToParsedQueryString(req.body as RawBodyBuffer);
  return req.body;
});

export function RawBodyToJson<T extends object>(rawBody: RawBodyBuffer): T {
  const string = RawBodyToString(rawBody);
  return JSON.parse(string);
}

export function RawBodyToParsedQueryString(rawBody: RawBodyBuffer): ParsedUrlQuery {
  const string = RawBodyToString(rawBody);
  return parseQueryString(string);
}

export function RawBodyToString(rawBody: RawBodyBuffer): string {
  return rawBody.toString("utf8").trim();
}
