import { type OnCallModelAnalyticsService, type OnCallModelAnalyticsEvent } from './analytics.handler';
import { type AuthData } from '../../type';
import { type NestContextCallableRequestWithAuth } from '../function/nest';
import { type ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';

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
export interface OnCallAnalyticsContext<I = any> {
  /** The CRUD operation type (e.g., `'create'`, `'update'`). */
  readonly call: string;
  /** The model type being operated on (e.g., `'guestbook'`). */
  readonly modelType: string;
  /** Optional operation specifier for variant handlers. */
  readonly specifier: string | undefined;
  /** The Firebase Auth UID of the calling user. */
  readonly uid?: string;
  /** The full Firebase Auth context. */
  readonly auth?: AuthData | undefined;
  /** The typed request data. */
  readonly data?: I;
  /** The full NestContext callable request with auth and specifier. */
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
export type OnCallAnalyticsCompleteFn<R, O> = (emitter: OnCallAnalyticsEmitter, request: R, result?: O, error?: unknown) => void;
