import { type DollarAmount, type ISO8601DateStringUTCFull, type JSONEncodedString, type UnixDateTimeNumber, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { type VapiAssistantId, type VapiCostsItem, type VapiTranscriptRef } from '../vapiai.type';
import { type Vapi } from '@vapi-ai/server-sdk';

export type BaseVapiPayloadCall = Required<Pick<Vapi.Call, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'type' | 'monitor' | 'transport' | 'status' | 'assistantId' | 'assistantOverrides'>>;

interface BaseVapiPayload {
  readonly call: BaseVapiPayloadCall & Partial<Vapi.Call>;
}

/**
 * Assistant request event payload
 *
 * https://docs.vapi.ai/server-url/events#retrieving-assistants
 */
export type AssistantRequestPayload = BaseVapiPayload & Omit<Vapi.ServerMessageAssistantRequest, 'call'>;

/**
 * Status update event payload
 *
 * https://docs.vapi.ai/server-url/events#call-status-updates
 */
export type StatusUpdatePayload = BaseVapiPayload & Omit<Vapi.ServerMessageStatusUpdate, 'call'>;

/**
 * Function call event payload
 *
 * https://docs.vapi.ai/server-url/events#function-calling
 */
export interface FunctionCallPayload extends BaseVapiPayload {
  readonly type: 'function-call';
  readonly functionCall: Vapi.FunctionCall;
}

/**
 * End of call report event payload
 *
 * https://docs.vapi.ai/server-url/events#end-of-call-report
 */
export interface EndOfCallReportPayload extends BaseVapiPayload, Omit<Vapi.ServerMessageEndOfCallReport, 'call'>, VapiTranscriptRef {
  readonly timestamp: UnixDateTimeNumber;
  readonly startedAt: ISO8601DateStringUTCFull;
  readonly endedAt: ISO8601DateStringUTCFull;
  readonly cost: DollarAmount;
  readonly costBreakdown: Vapi.CostBreakdown;
  readonly costs: VapiCostsItem[];
  readonly transcript: string;
  readonly messages: Vapi.Chat.Messages.Item[];
  readonly summary: string;
  readonly recordingUrl?: WebsiteUrlWithPrefix;
  readonly stereoRecordingUrl?: WebsiteUrlWithPrefix;
}

/**
 * Hang event payload
 *
 * https://docs.vapi.ai/server-url/events#hang-notifications
 */
export type HangPayload = BaseVapiPayload & Omit<Vapi.ServerMessageHang, 'call'>;

/**
 * @deprecated needs documentation link
 */
export type SpeechUpdatePayload = BaseVapiPayload & Omit<Vapi.ServerMessageSpeechUpdate, 'call'>;

/**
 * @deprecated needs documentation link
 */
export type TranscriptPayload = BaseVapiPayload & Omit<Vapi.ServerMessageTranscript, 'call'>;

export type VapiPayload = AssistantRequestPayload | StatusUpdatePayload | FunctionCallPayload | EndOfCallReportPayload | SpeechUpdatePayload | TranscriptPayload | HangPayload;

export type VapiPayloadType = VapiPayload['type'];

/**
 * Response returned when a function is called.
 *
 * https://docs.vapi.ai/server-url/events#function-calling
 */
export type FunctionCallMessageResponse = {
  readonly result: string | JSONEncodedString;
};

/**
 * Response returned when an assistant request is received.
 *
 * https://docs.vapi.ai/server-url/events#retrieving-assistants
 */
export type AssistantRequestMessageResponse = AssistantRequestMessageSuccessResponse | AssistantRequestMessageErrorResponse;
export type AssistantRequestMessageSuccessResponse = AssistantRequestMessageSuccessIdResponse | AssistantRequestMessageSuccessObjectResponse;

export interface AssistantRequestMessageSuccessIdResponse {
  readonly assistantId: VapiAssistantId;
}

export interface AssistantRequestMessageSuccessObjectResponse {
  readonly assistant: Vapi.Assistant;
}

export interface AssistantRequestMessageErrorResponse {
  readonly error?: string;
}

/**
 * Response that does not return any data.
 */
export type VapiVoidResponse = void;

export type StatusUpdateMessageResponse = VapiVoidResponse;
export type SpeechUpdateMessageResponse = VapiVoidResponse;
export type TranscriptMessageResponse = VapiVoidResponse;
export type HangMessageResponse = VapiVoidResponse;
export type EndOfCallReportMessageResponse = VapiVoidResponse;

export type VapiResponse = AssistantRequestMessageResponse | FunctionCallMessageResponse | EndOfCallReportMessageResponse | HangMessageResponse | StatusUpdateMessageResponse | SpeechUpdateMessageResponse | TranscriptMessageResponse;

// MARK: Compat

/**
 * @deprecated use VapiWebhookPayloadType instead.
 */
export enum VapiWebhookEnum {
  ASSISTANT_REQUEST = 'assistant-request',
  FUNCTION_CALL = 'function-call',
  STATUS_UPDATE = 'status-update',
  END_OF_CALL_REPORT = 'end-of-call-report',
  HANG = 'hang',
  // TODO: speech update and transcript are not implemented or have documentation. They might be deprecated
  /**
   * @deprecated needs documentation link
   */
  SPEECH_UPDATE = 'speech-update',
  /**
   * @deprecated needs documentation link
   */
  TRANSCRIPT = 'transcript'
}
