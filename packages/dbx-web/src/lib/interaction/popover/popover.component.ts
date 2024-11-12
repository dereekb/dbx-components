import { Component, NgZone, Type, OnInit, OnDestroy, ElementRef, inject } from '@angular/core';
import { NgOverlayContainerConfiguration, NgPopoverCloseType, NgPopoverRef } from 'ng-overlay-container';
import { AbstractTransitionWatcherDirective, DbxRouterTransitionService, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { Subject, filter, first, map, shareReplay, startWith } from 'rxjs';
import { PopoverPositionStrategy } from './popover.position.strategy';
import { Overlay } from '@angular/cdk/overlay';
import { LockSet } from '@dereekb/rxjs';
import { CompactContextStore, CompactMode } from '../../layout/compact';
import { asPromise, Maybe, PromiseOrValue, SpaceSeparatedCssClasses } from '@dereekb/util';
import { DbxPopoverController, DbxPopoverKey } from './popover';

export abstract class DbxPopoverComponentController<O, I> extends DbxPopoverController<O, I> {
  getClosingValueFn?: (value?: I) => Promise<O>;
}

export interface DbxPopoverComponentConfig<O, I, T> {
  /**
   * Key used for uniquely identifying a limited instance.
   *
   * Only one popover should exist at a time given a certain key.
   */
  key: DbxPopoverKey;
  /**
   * Origin element to position on.
   */
  origin: ElementRef;
  /**
   * Whether or not to close if a transition occurs.
   */
  closeOnTransition?: boolean;
  /**
   * Whether or not to dismiss when the escape button is pressed.
   *
   * False by default.
   */
  closeOnEscape?: boolean;
  /**
   * Component to inject into the popover.
   */
  componentClass: Type<T>;
  /**
   * Panel classes to add to the popover.
   */
  panelClass?: Maybe<SpaceSeparatedCssClasses>;
  /**
   * Data available to the popover.
   */
  data?: Maybe<I>;
  init?: (component: T, controller: DbxPopoverController<O, I>) => void;
}

export interface FullDbxPopoverComponentConfig<O, I, T> extends DbxPopoverComponentConfig<O, I, T> {
  configuration: NgOverlayContainerConfiguration;
}

/**
 * Popover component.
 */
@Component({
  template: `
    <dbx-popover-coordinator (dbxWindowKeyDownListener)="handleKeydown()" [appWindowKeyDownFilter]="triggerCloseKeys">
      <div dbxStyle class="dbx-popover-component" dbx-injection [config]="contentConfig"></div>
    </dbx-popover-coordinator>
  `,
  providers: [
    {
      provide: DbxPopoverController,
      useExisting: DbxPopoverComponent
    },
    {
      provide: CompactContextStore
    }
  ],
  host: {
    '[class]': 'config.panelClass'
  }
})
export class DbxPopoverComponent<O = unknown, I = unknown, T = unknown> extends AbstractTransitionWatcherDirective implements DbxPopoverController<O, I>, OnInit, OnDestroy {
  private readonly popoverRef = inject(NgPopoverRef<FullDbxPopoverComponentConfig<O, I, T>, O>);
  private readonly compactContextState = inject(CompactContextStore);

  readonly lockSet = new LockSet();

  readonly contentConfig: DbxInjectionComponentConfig = {
    componentClass: this.config.componentClass,
    init: this.config.init ? (instance) => (this.config as Required<FullDbxPopoverComponentConfig<O, I, T>>).init(instance as T, this) : undefined
  };

  private _startedClosing = false;
  private readonly _closing = new Subject<void>();

  private _triggerCloseKeys: string[] = [];

  readonly isClosing$ = this._closing.pipe(
    first(),
    map(() => true),
    startWith(false),
    shareReplay(1)
  );

  readonly closing$ = this.isClosing$.pipe(filter((x) => x));

  getClosingValueFn?: (value: Maybe<I>, closeType: NgPopoverCloseType) => PromiseOrValue<O | undefined>;

  constructor() {
    super();

    // Override Close to properly signal to listeners when a close is occuring.
    const originalClose = this.popoverRef.close;
    this.popoverRef.close = (x) => {
      if (!this._startedClosing) {
        this.lockSet.lockForSeconds(1);
        this._startedClosing = true;
        this.close();
        originalClose.call(this.popoverRef, x);
      }
    };

    // Also intercept the _close function to capture backdropClose, etc.
    const original_close = (this.popoverRef as any)._close;
    (this.popoverRef as any)._close = (closeType: NgPopoverCloseType, inputValue: O | undefined) => {
      const closeWithValue = (value?: O | undefined) => {
        original_close.call(this.popoverRef, closeType, value);
      };

      if (closeType === 'close' || inputValue != null) {
        closeWithValue(inputValue);
      } else {
        // expected to be a backdrop close. Get the closing value then close.
        this._useClosingValue(closeType, (x) => closeWithValue(x));
      }
    };

    // eslint-disable-next-line
    const overlay = (this.popoverRef as any)._overlay as Overlay; // overlay is not publically accessible
    const elementRef = this.config.origin;
    const configuration = this.config.configuration;

    this.compactContextState.setMode(CompactMode.COMPACT);
    const position = PopoverPositionStrategy.make(overlay, elementRef, configuration);
    this.popoverRef.overlay.updatePositionStrategy(position);
  }

  get config(): FullDbxPopoverComponentConfig<O, I, T> {
    return this.popoverRef.data;
  }

  get panelClass(): Maybe<SpaceSeparatedCssClasses> {
    return this.config.panelClass;
  }

  get key(): DbxPopoverKey {
    return this.config.key;
  }

  get data(): Maybe<I> {
    return this.config.data;
  }

  get triggerCloseKeys(): string[] {
    return this._triggerCloseKeys;
  }

  override ngOnInit(): void {
    super.ngOnInit();

    if (this.config.closeOnEscape) {
      this._triggerCloseKeys = ['Escape'];
    }
  }

  override ngOnDestroy(): void {
    this.lockSet.destroyOnNextUnlock(() => {
      super.ngOnDestroy();
      this._closing.complete();
    });
  }

  protected updateForSuccessfulTransition(): void {
    if (this.config.closeOnTransition !== false) {
      this.close();
    }
  }

  // Popover Controls
  public close(): void {
    if (!this._startedClosing && this.getClosingValueFn != null) {
      this._useClosingValue('close', (x) => this.return(x));
    } else {
      this.return();
    }
  }

  public return(value?: O | undefined): void {
    this._closing.next();
    this.popoverRef.close(value);
  }

  private _useClosingValue(closeType: NgPopoverCloseType, useValue: (value?: O | undefined) => void) {
    if (this.getClosingValueFn != null) {
      asPromise(this.getClosingValueFn(this.data, closeType)).then(
        (x) => {
          useValue(x);
        },
        () => {
          useValue();
        }
      );
    } else {
      useValue();
    }
  }

  // Keypresses
  handleKeydown() {
    this.close();
  }
}
