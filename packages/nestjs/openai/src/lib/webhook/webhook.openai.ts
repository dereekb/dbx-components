import { type HandlerBindAccessor, type HandlerMappedSetFunction, type Handler, handlerFactory, handlerConfigurerFactory, handlerMappedSetFunctionFactory } from '@dereekb/util';
import '../openai.type';
import {
  type BatchCancelledWebhookEvent,
  type BatchCompletedWebhookEvent,
  type BatchExpiredWebhookEvent,
  type BatchFailedWebhookEvent,
  type EvalRunCanceledWebhookEvent,
  type EvalRunFailedWebhookEvent,
  type EvalRunSucceededWebhookEvent,
  type FineTuningJobCancelledWebhookEvent,
  type FineTuningJobFailedWebhookEvent,
  type FineTuningJobSucceededWebhookEvent,
  type ResponseCancelledWebhookEvent,
  type ResponseCompletedWebhookEvent,
  type ResponseFailedWebhookEvent,
  type ResponseIncompleteWebhookEvent,
  type UnwrapWebhookEvent
} from 'openai/resources/webhooks';

export type OpenAIWebhookEventType = UnwrapWebhookEvent['type'];

export interface RawOpenAIWebhookEvent {
  readonly message: UntypedOpenAIWebhookEvent;
}

/**
 * A parsed OpenAIWebhookEventType that contains the relevant data and the original event.
 */
export type OpenAIWebhookEvent<T extends UnwrapWebhookEvent = UnwrapWebhookEvent, ET extends OpenAIWebhookEventType = OpenAIWebhookEventType> = T & {
  /**
   * The event type
   */
  readonly type: ET;
};

export type UntypedOpenAIWebhookEvent = UnwrapWebhookEvent;

/**
 * Creates a OpenAIWebhookEvent and treats the data as the input type.
 *
 * @param event
 * @returns
 */
export function openAIWebhookEvent<T extends UnwrapWebhookEvent = UnwrapWebhookEvent>(event: UntypedOpenAIWebhookEvent): OpenAIWebhookEvent<T> {
  return event as OpenAIWebhookEvent<T>;
}

// MARK: Handler
export type OpenAIEventHandler = Handler<UntypedOpenAIWebhookEvent, OpenAIWebhookEventType>;
export const openaiEventHandlerFactory = handlerFactory<UntypedOpenAIWebhookEvent, OpenAIWebhookEventType>((x) => x.type);

export type OpenAIHandlerMappedSetFunction<T extends UnwrapWebhookEvent = UnwrapWebhookEvent> = HandlerMappedSetFunction<OpenAIWebhookEvent<T>>;

export interface OpenAIEventHandlerConfigurer extends HandlerBindAccessor<UntypedOpenAIWebhookEvent, OpenAIWebhookEventType> {
  readonly handleBatchCancelled: OpenAIHandlerMappedSetFunction<BatchCancelledWebhookEvent>;
  readonly handleBatchCompleted: OpenAIHandlerMappedSetFunction<BatchCompletedWebhookEvent>;
  readonly handleBatchExpired: OpenAIHandlerMappedSetFunction<BatchExpiredWebhookEvent>;
  readonly handleBatchFailed: OpenAIHandlerMappedSetFunction<BatchFailedWebhookEvent>;
  readonly handleEvalRunCanceled: OpenAIHandlerMappedSetFunction<EvalRunCanceledWebhookEvent>;
  readonly handleEvalRunFailed: OpenAIHandlerMappedSetFunction<EvalRunFailedWebhookEvent>;
  readonly handleEvalRunSucceeded: OpenAIHandlerMappedSetFunction<EvalRunSucceededWebhookEvent>;
  readonly handleFineTuningJobCancelled: OpenAIHandlerMappedSetFunction<FineTuningJobCancelledWebhookEvent>;
  readonly handleFineTuningJobFailed: OpenAIHandlerMappedSetFunction<FineTuningJobFailedWebhookEvent>;
  readonly handleFineTuningJobSucceeded: OpenAIHandlerMappedSetFunction<FineTuningJobSucceededWebhookEvent>;
  readonly handleResponseCancelled: OpenAIHandlerMappedSetFunction<ResponseCancelledWebhookEvent>;
  readonly handleResponseCompleted: OpenAIHandlerMappedSetFunction<ResponseCompletedWebhookEvent>;
  readonly handleResponseFailed: OpenAIHandlerMappedSetFunction<ResponseFailedWebhookEvent>;
  readonly handleResponseIncomplete: OpenAIHandlerMappedSetFunction<ResponseIncompleteWebhookEvent>;
}

export const openaiEventHandlerConfigurerFactory = handlerConfigurerFactory<OpenAIEventHandlerConfigurer, UntypedOpenAIWebhookEvent, OpenAIWebhookEventType>({
  configurerForAccessor: (accessor: HandlerBindAccessor<UntypedOpenAIWebhookEvent, OpenAIWebhookEventType>) => {
    // eslint-disable-next-line
    const fnWithKey = handlerMappedSetFunctionFactory<OpenAIWebhookEvent<any>, any, OpenAIWebhookEventType>(accessor, openAIWebhookEvent);

    const configurer: OpenAIEventHandlerConfigurer = {
      ...accessor,
      handleBatchCancelled: fnWithKey('batch.cancelled'),
      handleBatchCompleted: fnWithKey('batch.completed'),
      handleBatchExpired: fnWithKey('batch.expired'),
      handleBatchFailed: fnWithKey('batch.failed'),
      handleEvalRunCanceled: fnWithKey('eval.run.canceled'),
      handleEvalRunFailed: fnWithKey('eval.run.failed'),
      handleEvalRunSucceeded: fnWithKey('eval.run.succeeded'),
      handleFineTuningJobCancelled: fnWithKey('fine_tuning.job.cancelled'),
      handleFineTuningJobFailed: fnWithKey('fine_tuning.job.failed'),
      handleFineTuningJobSucceeded: fnWithKey('fine_tuning.job.succeeded'),
      handleResponseCancelled: fnWithKey('response.cancelled'),
      handleResponseCompleted: fnWithKey('response.completed'),
      handleResponseFailed: fnWithKey('response.failed'),
      handleResponseIncomplete: fnWithKey('response.incomplete')
    };

    return configurer;
  }
});
