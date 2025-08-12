import { HandlerBindAccessor, HandlerMappedSetFunction, Handler, handlerFactory, handlerConfigurerFactory, handlerMappedSetFunctionFactory } from '@dereekb/util';
import { TypeformWebhookFormResponse } from './webhook.typeform.type';

export type TypeformWebhookEventType = 'form_response';

export interface RawTypeformWebhookEvent {
  readonly event_id: string;
  readonly event_type: TypeformWebhookEventType;
  readonly form_response: TypeformWebhookFormResponse;
}

export type UntypedTypeformWebhookEvent = RawTypeformWebhookEvent;

/**
 * A parsed TypeformWebhookEventType that contains the relevant data and the original event.
 */
export type TypeformWebhookEvent<T extends UntypedTypeformWebhookEvent = UntypedTypeformWebhookEvent, ET extends TypeformWebhookEventType = TypeformWebhookEventType> = T & {
  /**
   * The event type
   */
  readonly event_type: ET;
};

/**
 * Creates a TypeformWebhookEvent and treats the data as the input type.
 *
 * @param event
 * @returns
 */
export function typeFormWebhookEvent<T extends UntypedTypeformWebhookEvent = UntypedTypeformWebhookEvent>(event: UntypedTypeformWebhookEvent): TypeformWebhookEvent<T> {
  return event as TypeformWebhookEvent<T>;
}

// MARK: Handler
export type TypeformEventHandler = Handler<UntypedTypeformWebhookEvent, TypeformWebhookEventType>;
export const typeformEventHandlerFactory = handlerFactory<UntypedTypeformWebhookEvent, TypeformWebhookEventType>((x) => x.event_type);

export type TypeformHandlerMappedSetFunction<T extends UntypedTypeformWebhookEvent = UntypedTypeformWebhookEvent> = HandlerMappedSetFunction<TypeformWebhookEvent<T>>;

export interface TypeformEventHandlerConfigurer extends HandlerBindAccessor<UntypedTypeformWebhookEvent, TypeformWebhookEventType> {
  readonly handleFormResponse: TypeformHandlerMappedSetFunction<RawTypeformWebhookEvent>;
}

export const typeformEventHandlerConfigurerFactory = handlerConfigurerFactory<TypeformEventHandlerConfigurer, UntypedTypeformWebhookEvent, TypeformWebhookEventType>({
  configurerForAccessor: (accessor: HandlerBindAccessor<UntypedTypeformWebhookEvent, TypeformWebhookEventType>) => {
    // eslint-disable-next-line
    const fnWithKey = handlerMappedSetFunctionFactory<TypeformWebhookEvent<any>, any, TypeformWebhookEventType>(accessor, typeFormWebhookEvent);

    const configurer: TypeformEventHandlerConfigurer = {
      ...accessor,
      handleFormResponse: fnWithKey('form_response')
    };

    return configurer;
  }
});
