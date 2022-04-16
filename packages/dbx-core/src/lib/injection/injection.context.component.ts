import { Directive, EmbeddedViewRef, Injector, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { DbxInjectionComponentConfig } from './injection';
import { DbxInjectionContext, DbxInjectionContextConfig, ProvideDbxInjectionContext } from './injection.context';
import { DbxInjectionInstance } from './injection.instance';
import { Maybe } from '@dereekb/util';

/**
 * DbxInjectedViewContext implementation. Acts similar to *ngIf, but instead switches to a different view without destroying the original child view.
 */
@Directive({
  selector: '[dbxInjectionContext]',
  providers: ProvideDbxInjectionContext(DbxInjectionContextDirective)
})
export class DbxInjectionContextDirective<O = any> implements DbxInjectionContext {

  private _instance = new DbxInjectionInstance(this._injector);
  private _embeddedView!: EmbeddedViewRef<O>;
  private _isDetached = false;

  constructor(
    private readonly _injector: Injector,
    private readonly _templateRef: TemplateRef<O>,
    private readonly _viewContainer: ViewContainerRef
  ) { }

  @Input()
  set config(config: Maybe<DbxInjectionComponentConfig<any>>) {
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
    }
  }

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
    this._embeddedView?.destroy(); // destroy our embedded view too.
  }

  async showContext<T, O>(config: DbxInjectionContextConfig<T>): Promise<O> {
    let result: O;
    let error: any;

    // wait for the promise to resolve and use to finish using that instance.
    try {
      result = await new Promise<O>((resolve, reject) => {
        const injectionConfig: DbxInjectionComponentConfig<T> = {
          ...config.config,
          init: (instance: T) => {

            // init if available in the base config.
            if (config.config.init) {
              config.config.init(instance);
            }

            try {
              resolve(config.use(instance));
            } catch (e) {
              reject(e);
            }
          }
        };

        this.config = injectionConfig as any;
      });
    } catch (e) {
      error = e;
    }

    // clear the config to show the template again.
    this.config = undefined;

    if (error != null) {
      return Promise.reject(error);
    } else {
      return result!;
    }
  }

}
