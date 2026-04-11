import { type ComponentRef, type Provider, type Type, forwardRef } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';

/**
 * Unique key used to identify a detach instance.
 */
export type DbxDetachKey = string;

/**
 * Default key used when no key is specified.
 */
export const DBX_DETACH_DEFAULT_KEY: DbxDetachKey = 'default';

/**
 * Possible display states for a detach instance.
 */
export const DbxDetachWindowState = {
  /**
   * Content renders at an outlet location in the page.
   */
  ATTACHED: 'attached' as const,
  /**
   * Content renders in a floating overlay (via ng-overlay-container).
   */
  DETACHED: 'detached' as const,
  /**
   * Content is in the floating overlay but body is hidden (only controls visible).
   */
  MINIMIZED: 'minimized' as const
} as const;

/**
 * Union type of all possible detach window state values.
 */
export type DbxDetachWindowStateType = (typeof DbxDetachWindowState)[keyof typeof DbxDetachWindowState];

/**
 * Overlay-specific configuration for a detach instance.
 */
export interface DbxDetachOverlayConfig {
  readonly width?: string;
  readonly height?: string;
  readonly isDraggable?: boolean;
}

/**
 * Configuration for initializing a detach instance.
 *
 * Extends {@link DbxInjectionComponentConfig} with an optional key and overlay settings.
 */
export interface DbxDetachConfig<T = unknown> extends DbxInjectionComponentConfig<T> {
  readonly key?: DbxDetachKey;
  readonly overlay?: DbxDetachOverlayConfig;
}

/**
 * Tracks a single detached component managed by {@link DbxDetachService}.
 *
 * The component is created imperatively and lives in the service.
 * Outlets and overlays are just display locations — this instance
 * tracks which location currently hosts the component.
 */
export interface DbxDetachInstance<T = unknown> {
  readonly key: DbxDetachKey;
  readonly componentRef: ComponentRef<T>;
  readonly windowState$: Observable<DbxDetachWindowStateType>;
  readonly closing$: Observable<boolean>;
  /**
   * Moves content to an outlet in the page (if one exists for this key).
   */
  attach(): void;
  /**
   * Moves content to the floating overlay.
   */
  detach(): void;
  /**
   * Collapses the floating overlay so only controls are visible.
   */
  minimize(): void;
  /**
   * Destroys the detached component entirely.
   */
  close(): void;
}

/**
 * Abstract controller that content components can inject to
 * trigger state changes without being aware of the underlying mechanism.
 */
export abstract class DbxDetachController<I = unknown> {
  abstract readonly key: DbxDetachKey;
  abstract readonly data?: Maybe<I>;
  abstract readonly windowState$: Observable<DbxDetachWindowStateType>;
  abstract readonly closing$: Observable<boolean>;
  abstract attach(): void;
  abstract detach(): void;
  abstract minimize(): void;
  abstract close(): void;
}

/**
 * Creates Angular providers that register a {@link DbxDetachController} implementation for DI.
 *
 * @param sourceType - The concrete class to provide as the controller.
 * @returns An array of Angular providers that bind the source type to {@link DbxDetachController}.
 *
 * @example
 * ```typescript
 * @Component({
 *   providers: provideDbxDetachController(MyDetachController),
 * })
 * export class MyComponent {}
 * ```
 */
export function provideDbxDetachController<S extends DbxDetachController>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxDetachController,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
