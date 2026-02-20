import { Directive, EmbeddedViewRef, Injector, TemplateRef, ViewContainerRef, OnDestroy, OnInit, inject, effect, input } from '@angular/core';
import { DbxInjectionContext, DbxInjectionContextConfig, provideDbxInjectionContext } from './injection.context';
import { DbxInjectionInstance } from './injection.instance';
import { DbxInjectionComponentConfig } from './injection';
import { PromiseOrValue, PromiseReference, promiseReference, type Maybe } from '@dereekb/util';
import { clean } from '../rxjs';

/**
 * DbxInjectedViewContext implementation. Acts similar to *ngIf, but instead switches to a different view without destroying the original child view.
 */
@Directive({
  selector: '[dbxInjectionContext]',
  providers: provideDbxInjectionContext(DbxInjectionContextDirective),
  standalone: true
})
export class DbxInjectionContextDirective<O = unknown> implements DbxInjectionContext, OnInit, OnDestroy {
  private readonly _injector = inject(Injector);
  private readonly _templateRef = inject(TemplateRef<O>);
  private readonly _viewContainer = inject(ViewContainerRef);

  private readonly _instance = new DbxInjectionInstance(this._injector);

  private _currentPromise: Maybe<PromiseReference<unknown>>;
  private _embeddedView!: EmbeddedViewRef<O>;
  private _isDetached = false;

  readonly config = input<Maybe<DbxInjectionComponentConfig<unknown>>>();

  protected readonly _configEffect = effect(() => {
    this.setConfig(this.config());

    // NOTE: we have/call setConfig() because the effect() may not respond to all value changes,
    // especially when setConfig() ends up being called twice quickly in quick succession.
  });

  ngOnInit() {
    this._instance.content = this._viewContainer;
    this._instance.init();
    this._embeddedView = this._viewContainer.createEmbeddedView(this._templateRef);

    // detach the embedded view
    this._viewContainer.detach();

    // reattach it through the template configuration.
    // the template configuration acts as the default.
    this._instance.template = {
      viewRef: this._embeddedView
    };
  }

  ngOnDestroy(): void {
    this._instance.destroy();
    this._embeddedView?.destroy(); // destroy our embedded view too if it is set.
  }

  async showContext<T, O>(config: DbxInjectionContextConfig<T>): Promise<O> {
    // clear the current context before showing something new.
    this.resetContext();

    let promiseRef: Maybe<PromiseReference<O>>;

    let result: Maybe<O>;
    let error: unknown;

    // wait for the promise to resolve and use to finish using that instance.
    try {
      promiseRef = promiseReference(async (resolve, reject) => {
        const injectionConfig: DbxInjectionComponentConfig<T> = {
          ...config.config,
          init: async (instance: T) => {
            // init if available in the base config.
            if (config.config.init) {
              config.config.init(instance);
            }

            try {
              const result = (await config.use(instance)) as PromiseOrValue<O>;
              resolve(result);
            } catch (e) {
              reject(e);
            }
          }
        };

        this.setConfig(injectionConfig as DbxInjectionComponentConfig<unknown>);
      });

      this._currentPromise = promiseRef as PromiseReference<unknown>;

      // await the promise
      await promiseRef.promise;
    } catch (e) {
      error = e;
    }

    // if we're still using the same promiseRef
    if (promiseRef && promiseRef === this._currentPromise) {
      // clear the config to reshow the view
      this.setConfig(undefined);

      // clear the current promise
      this._currentPromise = undefined;
    }

    if (error != null) {
      return Promise.reject(error);
    } else {
      return result as O;
    }
  }

  resetContext(): boolean {
    let clearedValue = false;

    if (this._currentPromise) {
      const promise = this._currentPromise;

      // clear the current promise too
      this._currentPromise = undefined;

      // clear the config.
      this.setConfig(undefined);

      // send a rejection signal to bail out.
      promise.reject(new Error('dbxInjectionContext bailout'));

      clearedValue = true;
    }

    return clearedValue;
  }

  setConfig(config: Maybe<DbxInjectionComponentConfig<unknown>>) {
    let reattach = false;

    if (config) {
      if (!this._isDetached) {
        // detach the original view before setting config.
        this._viewContainer.detach();
        this._isDetached = true;
      }
    } else if (this._isDetached) {
      reattach = true;
    }

    this._instance.config = config;

    if (reattach) {
      this._viewContainer.insert(this._embeddedView);
      this._isDetached = false;
    }
  }
}
