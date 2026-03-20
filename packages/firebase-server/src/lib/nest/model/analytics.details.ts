import { type OnCallModelAnalyticsService, type OnCallModelAnalyticsEvent } from './analytics.handler';
import { type AuthData } from '../../type';
import { type NestContextCallableRequestWithAuth } from '../function/nest';
import { type ModelFirebaseCrudFunctionSpecifierRef, type FirebaseAuthUserId, type OnCallFunctionType, type FirestoreModelType, type ModelFirebaseCrudFunctionSpecifier } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

// MARK: Emitter
/**
 * Per-invocation analytics emitter passed to lifecycle callbacks.
 *
 * Pre-binds the analytics service, dispatch context, and lifecycle stage so callbacks
 * can send events with convenience methods without manually constructing full event objects.
 *
 * Analogous to how {@link DbxAnalyticsService} is passed to {@link DbxActionAnalyticsConfig} callbacks.
 */
export interface OnCallAnalyticsEmitter {
  readonly service: OnCallModelAnalyticsService;
  readonly context: OnCallAnalyticsContext;
  readonly lifecycle: OnCallModelAnalyticsEvent['lifecycle'];
  /**
   * Send a named event with optional properties.
   * Context (call, modelType, specifier, uid, lifecycle) is auto-filled from the dispatch context.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendEvent(event: string, properties?: Record<string, any>): void;
  /**
   * Send a named event type with no properties.
   */
  sendEventType(event: string): void;
}

// MARK: Details
/**
 * Analytics lifecycle configuration for a single onCall model handler.
 *
 * Mirrors the frontend {@link DbxActionAnalyticsConfig} pattern: lifecycle callbacks
 * receive an {@link OnCallAnalyticsEmitter} and the typed request, and are responsible
 * for deciding what analytics events to emit.
 *
 * @typeParam R - The request type passed to the handler function.
 * @typeParam O - The output/return type of the handler function.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface OnCallModelFunctionAnalyticsDetails<R = any, O = any> {
  /**
   * Called before handler executes.
   */
  readonly onTriggered?: OnCallAnalyticsLifecycleFn<R, void>;
  /**
   * Called after successful handler completion.
   */
  readonly onSuccess?: OnCallAnalyticsLifecycleFn<R, O>;
  /**
   * Called when handler throws.
   */
  readonly onError?: OnCallAnalyticsErrorFn<R>;
  /**
   * Called always after handler completes (success or error).
   */
  readonly onComplete?: OnCallAnalyticsCompleteFn<R, O>;
}

// MARK: Context
/**
 * Context available to the dispatch chain for building analytics emitters.
 *
 * Captured at the start of a handler invocation and used to auto-fill event fields
 * (call, modelType, specifier, uid, auth) on every emitted {@link OnCallModelAnalyticsEvent}.
 *
 * @typeParam I - The input/request data type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface OnCallAnalyticsContext<I = any> {
  /**
   * The CRUD operation type (e.g., `'create'`, `'update'`).
   */
  readonly call: OnCallFunctionType;
  /**
   * The model type being operated on (e.g., `'guestbook'`).
   */
  readonly modelType: FirestoreModelType;
  /**
   * Optional operation specifier for variant handlers.
   */
  readonly specifier: Maybe<ModelFirebaseCrudFunctionSpecifier>;
  /**
   * The Firebase Auth UID of the calling user.
   */
  readonly uid?: FirebaseAuthUserId;
  /**
   * The full Firebase Auth context.
   */
  readonly auth?: AuthData;
  /**
   * The typed request data.
   */
  readonly data?: I;
  /**
   * The full NestContext callable request with auth and specifier.
   */
  readonly request: NestContextCallableRequestWithAuth<unknown, I> & ModelFirebaseCrudFunctionSpecifierRef;
}

// MARK: Lifecycle Functions
/**
 * Lifecycle function for onTriggered/onSuccess.
 *
 * Receives the {@link OnCallAnalyticsEmitter} for sending events and the typed request.
 */
export type OnCallAnalyticsLifecycleFn<R, O> = (emitter: OnCallAnalyticsEmitter, request: R, result?: O) => void;

/**
 * Lifecycle function for onError.
 */
export type OnCallAnalyticsErrorFn<R> = (emitter: OnCallAnalyticsEmitter, request: R, error: unknown) => void;

/**
 * Lifecycle function for onComplete.
 */
// eslint-disable-next-line @typescript-eslint/max-params
export type OnCallAnalyticsCompleteFn<R, O> = (emitter: OnCallAnalyticsEmitter, request: R, result?: O, error?: unknown) => void;
