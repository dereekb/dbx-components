import { HandlerBindAccessor, HandlerMappedSetFunction, Handler, handlerFactory, handlerConfigurerFactory, handlerMappedSetFunctionFactory, MAP_IDENTITY } from '@dereekb/util';
import '../vapiai.type';
import { AssistantRequestPayload, EndOfCallReportPayload, FunctionCallPayload, HangPayload, SpeechUpdatePayload, StatusUpdatePayload, TranscriptPayload, VapiPayload, VapiWebhookEnum } from './webhook.vapiai.types';

export type VapiAiWebhookEventType = VapiWebhookEnum | string;

/**
 * A parsed VapiWebhookEventType that contains the relevant data and the original event.
 */
export interface VapiAiWebhookEvent<T extends VapiPayload = VapiPayload, ET extends VapiAiWebhookEventType = VapiAiWebhookEventType> {
  /**
   * The event type
   */
  readonly event: ET;
  /**
   * The relevant payload associated with the event.
   */
  readonly payload: T;
}

export type UntypedVapiAiWebhookEvent = VapiAiWebhookEvent<any>;

/**
 * Creates a ZoomWebhookEvent and treats the data as the input type.
 *
 * @param event
 * @returns
 */
export function vapiAiWebhookEvent<T extends VapiPayload>(event: UntypedVapiAiWebhookEvent): VapiAiWebhookEvent<T> {
  return {
    event: event.event,
    payload: event.payload as unknown as T
  };
}

// MARK: Handler
export type VapiAiEventHandler = Handler<UntypedVapiAiWebhookEvent, VapiAiWebhookEventType>;
export const vapiaiEventHandlerFactory = handlerFactory<UntypedVapiAiWebhookEvent>((x) => x.event);

export type VapiAiHandlerMappedSetFunction<T extends VapiPayload> = HandlerMappedSetFunction<VapiAiWebhookEvent<T>>;

export interface VapiAiEventHandlerConfigurer extends HandlerBindAccessor<UntypedVapiAiWebhookEvent, VapiAiWebhookEventType> {
  readonly handleAssistantRequest: VapiAiHandlerMappedSetFunction<AssistantRequestPayload>;
  readonly handleStatusUpdate: VapiAiHandlerMappedSetFunction<StatusUpdatePayload>;
  readonly handleFunctionCall: VapiAiHandlerMappedSetFunction<FunctionCallPayload>;
  readonly handleEndOfCallReport: VapiAiHandlerMappedSetFunction<EndOfCallReportPayload>;
  readonly handleSpeechUpdate: VapiAiHandlerMappedSetFunction<SpeechUpdatePayload>;
  readonly handleTranscript: VapiAiHandlerMappedSetFunction<TranscriptPayload>;
  readonly handleHang: VapiAiHandlerMappedSetFunction<HangPayload>;
}

export const vapiaiEventHandlerConfigurerFactory = handlerConfigurerFactory<VapiAiEventHandlerConfigurer, UntypedVapiAiWebhookEvent>({
  configurerForAccessor: (accessor: HandlerBindAccessor<UntypedVapiAiWebhookEvent, VapiAiWebhookEventType>) => {
    // eslint-disable-next-line
    const fnWithKey = handlerMappedSetFunctionFactory<VapiAiWebhookEvent<any>, any>(accessor, vapiAiWebhookEvent);

    const configurer: VapiAiEventHandlerConfigurer = {
      ...accessor,
      handleAssistantRequest: fnWithKey(VapiWebhookEnum.ASSISTANT_REQUEST),
      handleStatusUpdate: fnWithKey(VapiWebhookEnum.STATUS_UPDATE),
      handleFunctionCall: fnWithKey(VapiWebhookEnum.FUNCTION_CALL),
      handleEndOfCallReport: fnWithKey(VapiWebhookEnum.END_OF_CALL_REPORT),
      handleSpeechUpdate: fnWithKey(VapiWebhookEnum.SPEECH_UPDATE),
      handleTranscript: fnWithKey(VapiWebhookEnum.TRANSCRIPT),
      handleHang: fnWithKey(VapiWebhookEnum.HANG)
    };

    return configurer;
  }
});
