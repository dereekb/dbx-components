import { HandlerBindAccessor, HandlerMappedSetFunction, Handler, handlerFactory, handlerConfigurerFactory, handlerMappedSetFunctionFactory, Maybe } from '@dereekb/util';
import '../vapiai.type';
import { AssistantRequestPayload, EndOfCallReportPayload, FunctionCallPayload, HangPayload, SpeechUpdatePayload, StatusUpdatePayload, TranscriptPayload, VapiPayload, VapiResponse, VapiWebhookEnum } from './webhook.vapiai.types';

export type VapiAiWebhookEventType = VapiWebhookEnum | string;

export interface VapiAiWebhookResult {
  readonly handled: boolean;
  /**
   * Response to return to the vapi server.
   */
  readonly response?: VapiResponse;
}

export interface RawVapiAiWebhookEvent {
  readonly message: UntypedVapiAiWebhookEvent;
}

/**
 * A parsed VapiWebhookEventType that contains the relevant data and the original event.
 */
export type VapiAiWebhookEvent<T extends VapiPayload = VapiPayload, ET extends VapiAiWebhookEventType = VapiAiWebhookEventType> = T & {
  /**
   * The event type
   */
  readonly type: ET;
};

export type UntypedVapiAiWebhookEvent = VapiAiWebhookEvent;

/**
 * Creates a ZoomWebhookEvent and treats the data as the input type.
 *
 * @param event
 * @returns
 */
export function vapiAiWebhookEvent<T extends VapiPayload>(event: UntypedVapiAiWebhookEvent): VapiAiWebhookEvent<T> {
  return event as VapiAiWebhookEvent<T>;
}

// MARK: Handler
export type VapiAiEventHandler = Handler<UntypedVapiAiWebhookEvent, VapiAiWebhookEventType>;
export const vapiaiEventHandlerFactory = handlerFactory<UntypedVapiAiWebhookEvent, VapiAiWebhookEventType, VapiAiWebhookResult>((x) => x.type, {
  defaultResult: {
    handled: true,
    response: undefined
  },
  negativeResult: {
    handled: true,
    response: undefined
  }
});

export type VapiAiHandlerMappedSetFunction<T extends VapiPayload> = HandlerMappedSetFunction<VapiAiWebhookEvent<T>, Maybe<VapiAiWebhookResult>>;

export interface VapiAiEventHandlerConfigurer extends HandlerBindAccessor<UntypedVapiAiWebhookEvent, VapiAiWebhookEventType, VapiAiWebhookResult> {
  readonly handleAssistantRequest: VapiAiHandlerMappedSetFunction<AssistantRequestPayload>;
  readonly handleStatusUpdate: VapiAiHandlerMappedSetFunction<StatusUpdatePayload>;
  readonly handleFunctionCall: VapiAiHandlerMappedSetFunction<FunctionCallPayload>;
  readonly handleEndOfCallReport: VapiAiHandlerMappedSetFunction<EndOfCallReportPayload>;
  readonly handleHang: VapiAiHandlerMappedSetFunction<HangPayload>;
  /**
   * @deprecated
   */
  readonly handleSpeechUpdate: VapiAiHandlerMappedSetFunction<SpeechUpdatePayload>;
  /**
   * @deprecated
   */
  readonly handleTranscript: VapiAiHandlerMappedSetFunction<TranscriptPayload>;
}

export const vapiaiEventHandlerConfigurerFactory = handlerConfigurerFactory<VapiAiEventHandlerConfigurer, UntypedVapiAiWebhookEvent, VapiAiWebhookEventType, VapiAiWebhookResult>({
  configurerForAccessor: (accessor: HandlerBindAccessor<UntypedVapiAiWebhookEvent, VapiAiWebhookEventType, VapiAiWebhookResult>) => {
    // eslint-disable-next-line
    const fnWithKey = handlerMappedSetFunctionFactory<VapiAiWebhookEvent<any>, any, VapiAiWebhookEventType, Maybe<VapiAiWebhookResult>>(accessor, vapiAiWebhookEvent);

    const configurer: VapiAiEventHandlerConfigurer = {
      ...accessor,
      handleAssistantRequest: fnWithKey(VapiWebhookEnum.ASSISTANT_REQUEST),
      handleStatusUpdate: fnWithKey(VapiWebhookEnum.STATUS_UPDATE),
      handleFunctionCall: fnWithKey(VapiWebhookEnum.FUNCTION_CALL),
      handleEndOfCallReport: fnWithKey(VapiWebhookEnum.END_OF_CALL_REPORT),
      handleHang: fnWithKey(VapiWebhookEnum.HANG),
      handleSpeechUpdate: fnWithKey(VapiWebhookEnum.SPEECH_UPDATE),
      handleTranscript: fnWithKey(VapiWebhookEnum.TRANSCRIPT)
    };

    return configurer;
  }
});
