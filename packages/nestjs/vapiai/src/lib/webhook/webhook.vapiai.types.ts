import { DollarAmount, ISO8601DateStringUTCFull, JSONEncodedString, UnixDateTimeNumber, WebsiteUrlWithPrefix } from '@dereekb/util';
import { Analysis, Artifact, Assistant, Call, CallCostsItem, CallEndedReason, CallStatus, ChatCostsItem, ChatMessagesItem, CostBreakdown, ServerMessageEndOfCallReportCostsItem } from '@vapi-ai/server-sdk/api';
import { VapiAssistantId, VapiCostsItem } from '../vapiai.type';

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

interface BaseVapiPayload {
  readonly call: Call;
}

/**
 * Assistant request event payload
 *
 * https://docs.vapi.ai/server-url/events#retrieving-assistants
 */
export interface AssistantRequestPayload extends BaseVapiPayload {
  readonly type: VapiWebhookEnum.ASSISTANT_REQUEST;
}

/**
 * Status update event payload
 *
 * https://docs.vapi.ai/server-url/events#call-status-updates
 */
export interface StatusUpdatePayload extends BaseVapiPayload {
  readonly type: VapiWebhookEnum.STATUS_UPDATE;
  readonly status: CallStatus;
}

/**
 * Function call event payload
 *
 * https://docs.vapi.ai/server-url/events#function-calling
 */
export interface FunctionCallPayload extends BaseVapiPayload {
  readonly type: VapiWebhookEnum.FUNCTION_CALL;
  readonly functionCall: {
    readonly name: string;
    readonly parameters: JSONEncodedString;
  };
}

/**
 * End of call report event payload
 *
 * https://docs.vapi.ai/server-url/events#end-of-call-report
 */
export interface EndOfCallReportPayload extends BaseVapiPayload {
  readonly type: VapiWebhookEnum.END_OF_CALL_REPORT;
  readonly timestamp: UnixDateTimeNumber;
  readonly analysis: Analysis;
  readonly artifact: Artifact;
  readonly startedAt: ISO8601DateStringUTCFull;
  readonly endedAt: ISO8601DateStringUTCFull;
  readonly endedReason: CallEndedReason;
  readonly cost: DollarAmount;
  readonly costBreakdown: CostBreakdown;
  readonly costs: VapiCostsItem[];
  readonly transcript: string;
  readonly messages: ChatMessagesItem[];
  readonly summary: string;
  readonly recordingUrl?: WebsiteUrlWithPrefix;
  readonly stereoRecordingUrl?: WebsiteUrlWithPrefix;
  readonly assistant: Assistant;
}

/**
 * Hang event payload
 *
 * https://docs.vapi.ai/server-url/events#hang-notifications
 */
export interface HangPayload extends BaseVapiPayload {
  readonly type: VapiWebhookEnum.HANG;
}

/**
 * @deprecated needs documentation link
 */
export interface SpeechUpdatePayload extends BaseVapiPayload {
  readonly type: VapiWebhookEnum.SPEECH_UPDATE;
  readonly status: 'started' | 'stopped';
  readonly role: 'assistant' | 'user';
}

/**
 * @deprecated needs documentation link
 */
export interface TranscriptPayload {
  readonly type: VapiWebhookEnum.TRANSCRIPT;
  readonly role: 'assistant' | 'user';
  readonly transcriptType: 'partial' | 'final';
  readonly transcript: string;
}

export type VapiPayload = AssistantRequestPayload | StatusUpdatePayload | FunctionCallPayload | EndOfCallReportPayload | SpeechUpdatePayload | TranscriptPayload | HangPayload;

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
  readonly assistant: Assistant;
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
