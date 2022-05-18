import { createParamDecorator, ExecutionContext, BadRequestException } from "@nestjs/common";
import { Request } from "express";
import * as rawbody from 'raw-body';
import { parse as parseQueryString, ParsedUrlQuery } from "querystring";

export type RawBodyBuffer = Buffer;

export const ParseRawBody = createParamDecorator(async (_, context: ExecutionContext) => {
  // console.log('Reading rawbody...');

  const req: Request = context.switchToHttp().getRequest();
  if (!req.readable) {
    console.error('RawBody request was not readable. This is generally due to bad configuration.');
    throw new BadRequestException("Invalid body");
  }

  // console.log('Decoding body...');
  const body = (await rawbody(req));
  return body as RawBodyBuffer;
});

export const RawBody = createParamDecorator(async (_, context: ExecutionContext) => {
  const req: Request = context.switchToHttp().getRequest();
  return req.body as RawBodyBuffer;
});

export const ParsedQueryRawBody = createParamDecorator(async (_, context: ExecutionContext) => {
  const req: Request = context.switchToHttp().getRequest();
  req.body = RawBodyToParsedQueryString(req.body as RawBodyBuffer);
  return req.body;
});

export function RawBodyToJson<T extends object>(rawbody: RawBodyBuffer): T {
  const string = RawBodyToString(rawbody);
  return JSON.parse(string);
}

export function RawBodyToParsedQueryString(rawbody: RawBodyBuffer): ParsedUrlQuery {
  const string = RawBodyToString(rawbody);
  return parseQueryString(string);
}

export function RawBodyToString(rawbody: RawBodyBuffer): string {
  return rawbody.toString("utf8").trim();
}
