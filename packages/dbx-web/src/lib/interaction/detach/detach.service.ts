import { Injectable, ApplicationRef, type ComponentRef, EnvironmentInjector, Injector, inject, createComponent } from '@angular/core';
import { createInjectorForInjectionComponentConfig, initInjectionComponent } from '@dereekb/dbx-core';
import { NgOverlayContainerService, type NgPopoverRef } from 'ng-overlay-container';
import { Overlay } from '@angular/cdk/overlay';
import { BehaviorSubject, type Observable, map, distinctUntilChanged } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxDetachController, DbxDetachWindowState, type DbxDetachConfig, type DbxDetachInstance, type DbxDetachKey, type DbxDetachOverlayConfig, type DbxDetachWindowStateType, DBX_DETACH_DEFAULT_KEY } from './detach';
import { DbxDetachOverlayComponent, type DbxDetachOverlayData } from './detach.overlay.component';
import { PopupGlobalPositionStrategy } from '../popup/popup.position.strategy';

// MARK: Entry Controller
/**
 * Concrete {@link DbxDetachController} for a service-managed entry.
 *
 * Delegates all state changes back to the service.
 */
class DbxDetachEntryController<I = unknown> extends DbxDetachController<I> {
  private readonly _windowState = new BehaviorSubject<DbxDetachWindowStateType>(DbxDetachWindowState.DETACHED);
  private readonly _closing = new BehaviorSubject<boolean>(false);

  readonly windowState$ = this._windowState.asObservable();
  readonly closing$ = this._closing.asObservable();

  constructor(
    readonly key: DbxDetachKey,
    readonly data: Maybe<I>,
    private readonly _service: DbxDetachService
  ) {
    super();
  }

  get windowState(): DbxDetachWindowStateType {
    return this._windowState.value;
  }

  setWindowState(state: DbxDetachWindowStateType): void {
    this._windowState.next(state);
  }

  attach(): void {
    this._service.attachToOutlet(this.key);
  }

  detach(): void {
    this._service.detachToOverlay(this.key);
  }

  minimize(): void {
    this._service.minimizeToOverlay(this.key);
  }

  close(): void {
    this._service.closeOrReattach(this.key);
  }

  emitClosing(): void {
    this._closing.next(true);
  }
}

// MARK: Entry
/**
 * Internal tracked state for a detach entry.
 */
interface DbxDetachEntryState<T = unknown> {
  readonly key: DbxDetachKey;
  readonly componentRef: ComponentRef<T>;
  readonly controller: DbxDetachEntryController;
  readonly overlayConfig: DbxDetachOverlayConfig;
  overlayRef?: NgPopoverRef<DbxDetachOverlayData>;
  currentOutlet?: Element;
  lastOutlet?: Element;
}

// MARK: Instance
/**
 * Concrete {@link DbxDetachInstance} backed by a service entry.
 */
class DbxDetachInstanceImpl<T = unknown> implements DbxDetachInstance<T> {
  constructor(private readonly _entry: DbxDetachEntryState<T>) {}

  get key(): DbxDetachKey {
    return this._entry.key;
  }

  get componentRef(): ComponentRef<T> {
    return this._entry.componentRef;
  }

  get windowState$(): Observable<DbxDetachWindowStateType> {
    return this._entry.controller.windowState$;
  }

  get closing$(): Observable<boolean> {
    return this._entry.controller.closing$;
  }

  attach(): void {
    this._entry.controller.attach();
  }

  detach(): void {
    this._entry.controller.detach();
  }

  minimize(): void {
    this._entry.controller.minimize();
  }

  close(): void {
    this._entry.controller.close();
  }
}

// MARK: Service
/**
 * Root-level service that owns and manages detached components.
 *
 * Components are created imperatively via {@link createComponent} and kept alive
 * via {@link ApplicationRef.attachView}. They are not tied to any template.
 *
 * Outlets and overlays are just display locations — the service moves the component's
 * host element between them based on the current state.
 *
 * Multiple simultaneous detached components are supported via unique keys.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxDetachService {
  private readonly _appRef = inject(ApplicationRef);
  private readonly _injector = inject(Injector);
  private readonly _envInjector = inject(EnvironmentInjector);
  private readonly _overlay = inject(Overlay);
  private readonly _overlayContainerService = new NgOverlayContainerService(this._overlay, this._injector);

  private readonly _entries = new Map<DbxDetachKey, DbxDetachEntryState>();
  private readonly _entries$ = new BehaviorSubject<Map<DbxDetachKey, DbxDetachEntryState>>(this._entries);

  /**
   * Initializes a detached component for the given key. Returns the existing instance if one already exists.
   */
  init<T>(config: DbxDetachConfig<T>): DbxDetachInstance<T> {
    const key = config.key ?? DBX_DETACH_DEFAULT_KEY;

    const existing = this._entries.get(key);
    if (existing) {
      return new DbxDetachInstanceImpl(existing as DbxDetachEntryState<T>);
    }

    const controller = new DbxDetachEntryController(key, config.data, this);

    // Build injector using shared utility, adding DbxDetachController provider
    const elementInjector = createInjectorForInjectionComponentConfig({
      config: {
        ...config,
        providers: [{ provide: DbxDetachController, useValue: controller }, ...(config.providers ?? [])]
      },
      parentInjector: this._injector
    });

    // Create component imperatively (not in any VCR)
    const componentRef = createComponent(config.componentClass, {
      environmentInjector: this._envInjector,
      elementInjector
    });

    // Run init callback
    initInjectionComponent(componentRef, config);

    // Attach view to ApplicationRef for change detection
    this._appRef.attachView(componentRef.hostView);

    const overlayConfig: DbxDetachOverlayConfig = config.overlay ?? {};

    const entry: DbxDetachEntryState<T> = {
      key,
      componentRef,
      controller,
      overlayConfig
    };

    this._entries.set(key, entry as DbxDetachEntryState);
    this._entries$.next(this._entries);

    return new DbxDetachInstanceImpl(entry);
  }

  /**
   * Gets the instance for the given key, if it exists.
   */
  get<T = unknown>(key?: DbxDetachKey): Maybe<DbxDetachInstance<T>> {
    const entry = this._entries.get(key ?? DBX_DETACH_DEFAULT_KEY);
    return entry ? new DbxDetachInstanceImpl(entry as DbxDetachEntryState<T>) : undefined;
  }

  /**
   * Observable of whether an entry exists for the given key.
   */
  has$(key?: DbxDetachKey): Observable<boolean> {
    const k = key ?? DBX_DETACH_DEFAULT_KEY;
    return this._entries$.pipe(
      map((entries) => entries.has(k)),
      distinctUntilChanged()
    );
  }

  /**
   * Moves the component's host element into the given outlet element.
   *
   * If no outlet element is provided, falls back to the last known outlet
   * (for reattaching from the overlay to the previous location).
   */
  attachToOutlet(key: DbxDetachKey, outletElement?: Element): void {
    const entry = this._entries.get(key);
    if (!entry) {
      return;
    }

    const target = outletElement ?? entry.lastOutlet;
    if (!target || !target.isConnected) {
      // No outlet available or it's been removed from the DOM
      return;
    }

    this._closeOverlay(entry);
    this._moveDomTo(entry, target);
    entry.currentOutlet = target;
    entry.lastOutlet = target;
    entry.controller.setWindowState(DbxDetachWindowState.ATTACHED);
  }

  /**
   * Moves the component to the floating overlay.
   */
  detachToOverlay(key: DbxDetachKey): void {
    const entry = this._entries.get(key);
    if (!entry) {
      return;
    }

    this._openOverlay(entry);
    this._resizeOverlayForState(entry, DbxDetachWindowState.DETACHED);
    entry.controller.setWindowState(DbxDetachWindowState.DETACHED);
  }

  /**
   * Moves the component to the floating overlay in minimized state.
   */
  minimizeToOverlay(key: DbxDetachKey): void {
    const entry = this._entries.get(key);
    if (!entry) {
      return;
    }

    this._openOverlay(entry);
    this._resizeOverlayForState(entry, DbxDetachWindowState.MINIMIZED);
    entry.controller.setWindowState(DbxDetachWindowState.MINIMIZED);
  }

  /**
   * Called when an outlet is destroyed.
   *
   * @param detachToOverlay - When true, the component moves to the floating overlay.
   *   When false, the component's DOM is removed but it stays alive in the service (hidden).
   */
  outletDestroyed(key: DbxDetachKey, outletElement: Element, detachToOverlay: boolean): void {
    const entry = this._entries.get(key);
    if (entry?.currentOutlet === outletElement) {
      entry.currentOutlet = undefined;

      if (detachToOverlay) {
        this._openOverlay(entry);
        entry.controller.setWindowState(DbxDetachWindowState.DETACHED);
      } else {
        this._removeDom(entry);
      }
    }
  }

  /**
   * Destroys the component and removes it from the service.
   */
  /**
   * If the last outlet is still in the DOM, reattaches the component there.
   * Otherwise destroys the component.
   */
  closeOrReattach(key: DbxDetachKey): void {
    const entry = this._entries.get(key);
    if (!entry) {
      return;
    }

    if (entry.lastOutlet?.isConnected) {
      this.attachToOutlet(key, entry.lastOutlet);
    } else {
      entry.controller.emitClosing();
      this.remove(key);
    }
  }

  /**
   * Destroys the component and removes it from the service.
   */
  remove(key: DbxDetachKey): void {
    const entry = this._entries.get(key);
    if (!entry) {
      return;
    }

    this._closeOverlay(entry);
    this._appRef.detachView(entry.componentRef.hostView);
    entry.componentRef.destroy();
    this._entries.delete(key);
    this._entries$.next(this._entries);
  }

  // MARK: Internal
  private _openOverlay(entry: DbxDetachEntryState): void {
    if (entry.overlayRef) {
      return;
    }

    // Remove from current outlet
    this._removeDom(entry);
    entry.currentOutlet = undefined;

    const { overlayConfig } = entry;
    const width = overlayConfig.width ?? '400px';
    const height = overlayConfig.height ?? '500px';
    const isDraggable = overlayConfig.isDraggable ?? false;

    const data: DbxDetachOverlayData = {
      controller: entry.controller,
      hostElement: entry.componentRef.location.nativeElement
    };

    const ref = this._overlayContainerService.open<DbxDetachOverlayData>({
      content: DbxDetachOverlayComponent,
      data,
      configuration: {
        width,
        height,
        useGlobalPositionStrategy: true,
        hasBackdrop: false,
        isResizable: false,
        isDraggable
      }
    });

    const position = new PopupGlobalPositionStrategy('bottom_right', { x: '16px', y: '16px' });
    ref.overlay.updatePositionStrategy(position);

    entry.overlayRef = ref;
  }

  private _resizeOverlayForState(entry: DbxDetachEntryState, state: DbxDetachWindowStateType): void {
    if (!entry.overlayRef) {
      return;
    }

    const { overlayConfig } = entry;
    const width = overlayConfig.width ?? '400px';

    if (state === DbxDetachWindowState.MINIMIZED) {
      entry.overlayRef.resize(width, 'auto');
    } else {
      const height = overlayConfig.height ?? '500px';
      entry.overlayRef.resize(width, height);
    }

    entry.overlayRef.overlay.updatePosition();
  }

  private _closeOverlay(entry: DbxDetachEntryState): void {
    if (!entry.overlayRef) {
      return;
    }

    // Remove DOM from overlay before closing
    this._removeDom(entry);

    try {
      entry.overlayRef.close();
    } catch {
      // Overlay may already be closed
    }

    entry.overlayRef = undefined;
  }

  private _moveDomTo(entry: DbxDetachEntryState, target: Element): void {
    const hostEl = entry.componentRef.location.nativeElement as HTMLElement;
    target.appendChild(hostEl);
  }

  private _removeDom(entry: DbxDetachEntryState): void {
    const hostEl = entry.componentRef.location.nativeElement as HTMLElement;
    hostEl.parentElement?.removeChild(hostEl);
  }
}
