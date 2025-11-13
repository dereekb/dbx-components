import { type MaybeMap, type Maybe } from '@dereekb/util';
import { type OpenAI } from 'openai';

// MARK: OpenAI Json Response
export interface OpenAIJsonResponse {
  /**
   * The parsed fields array, if applicable.
   */
  readonly fields: OpenAIJsonResponseField[];
}

export type OpenAIJsonResponseFieldName = string;
export type OpenAIJsonResponseFieldValue = string;

export interface OpenAIJsonResponseField {
  readonly field_name: OpenAIJsonResponseFieldName;
  readonly field_value: OpenAIJsonResponseFieldValue;
}

// MARK: Parsed JSON Response
/**
 * The parsed json response data.
 */
export interface ParsedOpenAIJsonResponseData {
  /**
   * Parsed json response, if applicable.
   */
  readonly jsonResponse: OpenAIJsonResponse;
  /**
   * Parsed json response field map, if applicable.
   */
  readonly jsonResponseFieldMap: OpenAIJsonResponseFieldMap;
}

/**
 * A parsed OpenAI response.
 */
export interface ParsedOpenAIJsonResponse extends Partial<MaybeMap<ParsedOpenAIJsonResponseData>> {
  /**
   * The parsed output text.
   */
  readonly output_text: string;
  /**
   * If true, the response was parsed as JSON successfully.
   */
  readonly isJsonResponse: boolean;
}

/**
 * ParsedOpenAIJsonResponse with a json response successfully parsed.
 */
export type ParsedOpenAIJsonResponseWithJson = ParsedOpenAIJsonResponse & ParsedOpenAIJsonResponseData;

/**
 * Returns true if the response has a json response.
 *
 * @param response
 * @returns
 */
export function isParsedOpenAIJsonResponseWithJson(response: ParsedOpenAIJsonResponse): response is ParsedOpenAIJsonResponseWithJson {
  return response.isJsonResponse && Boolean(response.jsonResponse) && Boolean(response.jsonResponseFieldMap);
}

/**
 * Parses the OpenAI response into a ParsedOpenAIJsonResponse.
 *
 * @param response The OpenAI response to parse.
 * @returns The parsed OpenAI response.
 */
export function parseOpenAIJsonResponse(response: string | OpenAI.Responses.Response): ParsedOpenAIJsonResponse {
  const output_text = typeof response === 'string' ? response : response.output_text;
  let jsonResponse: Maybe<OpenAIJsonResponse> = undefined;
  let jsonResponseFieldMap: Maybe<OpenAIJsonResponseFieldMap> = undefined;

  try {
    jsonResponse = JSON.parse(output_text) as OpenAIJsonResponse;
    jsonResponseFieldMap = openAIJsonResponseFieldsMap(jsonResponse);
  } catch (e) {
    // ignore
  }

  return {
    output_text,
    isJsonResponse: Boolean(jsonResponse),
    jsonResponse,
    jsonResponseFieldMap
  };
}

// MARK: Field Map
/**
 * Map of OpenAI json response values mapped with their corresponding field name.
 */
export type OpenAIJsonResponseFieldMap = Map<OpenAIJsonResponseFieldName, OpenAIJsonResponseFieldValue>;

/**
 * Creates a map of the OpenAI json response fields.
 *
 * @param response The OpenAI json response to create a map from.
 * @returns The map of the OpenAI json response fields.
 */
export function openAIJsonResponseFieldsMap(response: OpenAIJsonResponse): OpenAIJsonResponseFieldMap {
  return new Map(response.fields.map((x) => [x.field_name, x.field_value]));
}
