import { Component, ComponentFactoryResolver, Inject, Input, NgZone, Type, ViewChild, ViewContainerRef, OnInit, OnDestroy, ComponentRef, ElementRef } from '@angular/core';
import { HookMatchCriteria, TransitionService } from '@uirouter/core';
import { NgOverlayContainerConfiguration, NgPopoverRef } from 'ng-overlay-container';
import { AbstractTransitionWatcherDirective } from '@dereekb/ngx-core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { PopoverPositionStrategy } from './popover.position.strategy';
import { filter, first, map, shareReplay, startWith } from 'rxjs/operators';
import { Overlay } from '@angular/cdk/overlay';
import { LockSet } from '@dereekb/util-rxjs';

export type DbNgxPopoverKey = string;

export abstract class DbNgxPopoverController<I = any, O = any> {
  readonly key: DbNgxPopoverKey;
  readonly data?: I;
  readonly closing$: Observable<boolean>;
  /**
   * Signals for the popover to close.
   */
  abstract close(): void;
  /**
   * Closes the popover and returns the input value.
   */
  abstract return(value?: O): void;
}

export abstract class DbNgxPopoverComponentController<I, O> extends DbNgxPopoverController<I, O> {
  getClosingValueFn?: (value?: I) => Promise<O>;
}

export interface DbNgxPopoverComponentConfig<I, O, T> {
  /**
   * Key used for uniquely identifying a limited instance.
   *
   * Only one popover should exist at a time given a certain key.
   */
  key: DbNgxPopoverKey;
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
  componentClass: Type<T>;
  data?: I;
  init?: (component: T, controller: DbNgxPopoverController<I, O>) => void;
}

export interface FullDbNgxPopoverComponentConfig<I, O, T> extends DbNgxPopoverComponentConfig<I, O, T> {
  configuration: NgOverlayContainerConfiguration;
}

/**
 * Popover component.
 */
@Component({
  template: `
  <dbx-popover-coordinator (appWindowKeyDownListener)="handleKeydown($event)" [appWindowKeyDownFilter]="triggerCloseKeys">
    <div class="dbx-popover-component">
      <ng-template #content></ng-template>
    </div>
  </dbx-popover-coordinator>
  `,
  styleUrls: ['./popover.scss'],
  providers: [{
    provide: DbNgxPopoverController,
    useExisting: DbNgxPopoverComponent
  }, {
    provide: CompactContextStore
  }]
})
export class DbNgxPopoverComponent<I = any, O = any, T = any> extends AbstractTransitionWatcherDirective implements DbNgxPopoverController<I, O>, OnInit, OnDestroy {

  readonly lockSet = new LockSet();

  @ViewChild('content', { static: true, read: ViewContainerRef })
  private _content: ViewContainerRef;
  private _componentRef: ComponentRef<T>;

  private _startedClosing = false;
  private readonly _closing = new Subject<void>();

  private _triggerCloseKeys: string[] = [];

  readonly isClosing$ = this._closing.pipe(first(), map(x => true), startWith(false), shareReplay(1));
  readonly closing$ = this.isClosing$.pipe(filter(x => x));

  getClosingValueFn?: (value?: I) => Promise<O>;

  constructor(
    private popoverRef: NgPopoverRef<FullDbNgxPopoverComponentConfig<I, O, T>, O>,
    private compactContextState: CompactContextStore,
    private resolver: ComponentFactoryResolver,
    transitionService: TransitionService,
    ngZone: NgZone) {
    super(transitionService, ngZone);

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

    const overlay = (popoverRef as any)._overlay as Overlay;
    const elementRef = this.config.origin;
    const configuration = this.config.configuration;

    this.compactContextState.setMode(CompactMode.COMPACT);
    const position = PopoverPositionStrategy.make(overlay, elementRef, configuration);
    this.popoverRef.overlay.updatePositionStrategy(position);
  }

  get config(): FullDbNgxPopoverComponentConfig<I, O, T> {
    return this.popoverRef.data;
  }

  get key(): DbNgxPopoverKey {
    return this.config.key;
  }

  get data(): I {
    return this.config.data;
  }

  get triggerCloseKeys(): string[] {
    return this._triggerCloseKeys;
  }

  ngOnInit(): void {
    super.ngOnInit();
    this._content.clear();
    const componentClass = this.config.componentClass;
    const factory = this.resolver.resolveComponentFactory(componentClass);
    this._componentRef = this._content.createComponent(factory);

    if (this.config.init) {
      this.config.init(this._componentRef.instance, this);
    }

    if (this.config.closeOnEscape) {
      this._triggerCloseKeys = ['Escape'];
    }
  }

  ngOnDestroy(): void {
    this.lockSet.destroyOnNextUnlock(() => {
      super.ngOnDestroy();
      this._closing.complete();
    });
  }

  protected getHookMatchCriteria(): HookMatchCriteria | false {
    return (this.config.closeOnTransition === false) ? false : super.getHookMatchCriteria();
  }

  protected updateForSuccessfulTransition(): void {
    this.close();
  }

  // Popover Controls
  public close(): void {
    if (!this._startedClosing && this.getClosingValueFn) {
      this.getClosingValueFn().then((x) => {
        this.return(x);
      }, () => {
        this.return();
      });
    } else {
      this.return();
    }
  }

  public return(value?: O): void {
    this._closing.next();
    this.popoverRef.close(value);
  }

  // Keypresses
  handleKeydown(key: KeyboardEvent) {
    this.close();
  }

}
