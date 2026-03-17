import { type HandlerBindAccessor, type HandlerMappedSetFunction, type Handler, handlerFactory, handlerConfigurerFactory, handlerMappedSetFunctionFactory, type EmailAddress } from '@dereekb/util';
import { type ZohoSignRequestId, type ZohoSignDocumentId, type ZohoSignActionId, type ZohoSignRequestStatus, type ZohoSignRequestTypeId } from '@dereekb/zoho';

// MARK: Operation Types
/**
 * Zoho Sign webhook operation type constants.
 *
 * These correspond to the `operation_type` field in the webhook `notifications` payload.
 */
export type ZohoSignWebhookOperationType = 'RequestSubmitted' | 'RequestViewed' | 'RequestSigningSuccess' | 'RequestCompleted' | 'RequestRejected' | 'RequestRecalled' | 'RequestForwarded' | 'RequestExpired';

// MARK: Notification
/**
 * The `notifications` portion of a Zoho Sign webhook payload.
 *
 * Contains details about the action performed on the document.
 */
export interface ZohoSignWebhookNotification {
  /**
   * Email address of the person who performed the operation.
   */
  readonly performed_by_email: EmailAddress;
  /**
   * Name of the person who performed the operation.
   */
  readonly performed_by_name: string;
  /**
   * Timestamp of the operation in Java milliseconds.
   */
  readonly performed_at: number;
  /**
   * Reason stated for the operation, if applicable.
   */
  readonly reason?: string;
  /**
   * Short description of the activity performed.
   */
  readonly activity: string;
  /**
   * The type of operation that triggered this webhook.
   */
  readonly operation_type: ZohoSignWebhookOperationType;
  /**
   * Sign action ID of the signer.
   *
   * Present for signer-related actions: RequestViewed, RequestSigningSuccess,
   * RequestRejected, and RequestForwarded.
   */
  readonly action_id?: ZohoSignActionId;
  /**
   * IP address captured during this operation.
   */
  readonly ip_address?: string;
}

// MARK: Request Data
/**
 * A document reference within the webhook request data.
 */
export interface ZohoSignWebhookDocumentRef {
  readonly document_name: string;
  readonly document_id: ZohoSignDocumentId;
}

/**
 * The `requests` portion of a Zoho Sign webhook payload.
 *
 * Contains details about the document for which the webhook was triggered.
 */
export interface ZohoSignWebhookRequestData {
  readonly request_status: ZohoSignRequestStatus;
  readonly request_name: string;
  readonly request_id: ZohoSignRequestId;
  readonly org_id?: string;
  readonly request_type_id?: ZohoSignRequestTypeId;
  readonly document_ids: ZohoSignWebhookDocumentRef[];
}

// MARK: Payload
/**
 * The complete webhook payload from Zoho Sign.
 *
 * Contains two top-level keys: `notifications` (the action details) and
 * `requests` (the document details).
 *
 * @example
 * ```json
 * {
 *   "notifications": {
 *     "performed_by_email": "testuser@zoho.com",
 *     "performed_at": 1555062604837,
 *     "activity": "Document has been signed",
 *     "operation_type": "RequestSigningSuccess",
 *     "action_id": "1000000000090",
 *     "performed_by_name": "test user"
 *   },
 *   "requests": {
 *     "request_name": "NDA Document",
 *     "request_id": "1000000000000",
 *     "request_status": "inprogress",
 *     "document_ids": [{ "document_name": "CommonNDA.pdf", "document_id": "100000000000050" }]
 *   }
 * }
 * ```
 */
export interface ZohoSignWebhookPayload {
  readonly notifications: ZohoSignWebhookNotification;
  readonly requests: ZohoSignWebhookRequestData;
}

// MARK: Event
/**
 * A parsed Zoho Sign webhook event, providing convenient access to the operation type.
 */
export type ZohoSignWebhookEvent<T extends ZohoSignWebhookOperationType = ZohoSignWebhookOperationType> = ZohoSignWebhookPayload & {
  readonly operationType: T;
};

/**
 * Creates a {@link ZohoSignWebhookEvent} from a raw payload.
 */
export function zohoSignWebhookEvent(payload: ZohoSignWebhookPayload): ZohoSignWebhookEvent {
  return {
    ...payload,
    operationType: payload.notifications.operation_type
  };
}

// MARK: Handler
export type ZohoSignEventHandler = Handler<ZohoSignWebhookEvent, ZohoSignWebhookOperationType>;
export const zohoSignEventHandlerFactory = handlerFactory<ZohoSignWebhookEvent, ZohoSignWebhookOperationType>((x) => x.operationType);

export type ZohoSignHandlerMappedSetFunction<T extends ZohoSignWebhookOperationType = ZohoSignWebhookOperationType> = HandlerMappedSetFunction<ZohoSignWebhookEvent<T>>;

export interface ZohoSignEventHandlerConfigurer extends HandlerBindAccessor<ZohoSignWebhookEvent, ZohoSignWebhookOperationType> {
  readonly handleRequestSubmitted: ZohoSignHandlerMappedSetFunction<'RequestSubmitted'>;
  readonly handleRequestViewed: ZohoSignHandlerMappedSetFunction<'RequestViewed'>;
  readonly handleRequestSigningSuccess: ZohoSignHandlerMappedSetFunction<'RequestSigningSuccess'>;
  readonly handleRequestCompleted: ZohoSignHandlerMappedSetFunction<'RequestCompleted'>;
  readonly handleRequestRejected: ZohoSignHandlerMappedSetFunction<'RequestRejected'>;
  readonly handleRequestRecalled: ZohoSignHandlerMappedSetFunction<'RequestRecalled'>;
  readonly handleRequestForwarded: ZohoSignHandlerMappedSetFunction<'RequestForwarded'>;
  readonly handleRequestExpired: ZohoSignHandlerMappedSetFunction<'RequestExpired'>;
}

export const zohoSignEventHandlerConfigurerFactory = handlerConfigurerFactory<ZohoSignEventHandlerConfigurer, ZohoSignWebhookEvent, ZohoSignWebhookOperationType>({
  configurerForAccessor: (accessor: HandlerBindAccessor<ZohoSignWebhookEvent, ZohoSignWebhookOperationType>) => {
    // eslint-disable-next-line
    const fnWithKey = handlerMappedSetFunctionFactory<ZohoSignWebhookEvent<any>, any, ZohoSignWebhookOperationType>(accessor, (x) => x as ZohoSignWebhookEvent<any>);

    const configurer: ZohoSignEventHandlerConfigurer = {
      ...accessor,
      handleRequestSubmitted: fnWithKey('RequestSubmitted'),
      handleRequestViewed: fnWithKey('RequestViewed'),
      handleRequestSigningSuccess: fnWithKey('RequestSigningSuccess'),
      handleRequestCompleted: fnWithKey('RequestCompleted'),
      handleRequestRejected: fnWithKey('RequestRejected'),
      handleRequestRecalled: fnWithKey('RequestRecalled'),
      handleRequestForwarded: fnWithKey('RequestForwarded'),
      handleRequestExpired: fnWithKey('RequestExpired')
    };

    return configurer;
  }
});
