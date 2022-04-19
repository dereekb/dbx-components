import { Maybe } from '@dereekb/util';
import { filterMaybe, tapFirst } from '@dereekb/rxjs';
import { Observable, BehaviorSubject, switchMap, shareReplay, from, firstValueFrom } from 'rxjs';
import { Inject, Injectable, OnDestroy, Optional } from '@angular/core';

/**
 * Used for loading services in the browser that are imported from other scripts, such as Facebook, Segment, Stripe, etc.
 */
@Injectable()
export abstract class AbstractAsyncWindowLoadedService<T> implements OnDestroy {

  private _loading = new BehaviorSubject<Maybe<Promise<T>>>(undefined);

  readonly loading$: Observable<Promise<T>> = this._loading.pipe(tapFirst(() => this.loadService()), filterMaybe(), shareReplay(1));
  readonly service$: Observable<T> = this.loading$.pipe(switchMap(x => from(x)), shareReplay(1));

  /**
   * @param _windowKey Key that is attached to the window for the object that is the service when finished loading.
   * @param _callbackKey Optional key attached to window that is a function that is executed when the setup is complete.
   */
  constructor(
    @Inject(null) private _windowKey: string,
    @Inject(null) private _callbackKey?: string,
    @Inject(null) private _serviceName: string = _windowKey,
    @Inject(null) preload: boolean = true) {
    if (preload) {
      // Begin loading the service immediately.
      setTimeout(() => this.loadService().catch());
    }
  }

  ngOnDestroy(): void {
    this._loading.complete();
  }

  getService(): Promise<T> {
    return firstValueFrom(this.service$);
  }

  // MARK: Loading
  protected loadService(): Promise<T> {
    if (!this._loading.value) {
      const loadingPromise = new Promise<T>((resolve, reject) => {
        let loadTry = 0;

        const rejectWithError = () => {
          reject(new Error(`Service "${this._serviceName}" failed loading with windowKey "${this._windowKey}"`));
        }

        const tryLoad = () => {
          const windowRef = (window as any);

          // Loaded before the promise.
          if (windowRef[this._windowKey]) {
            // Not yet finished loading async. Intercept the function.
            // console.log('Window key.');
            return resolve(this.completeLoadingService());
          } else if (this._callbackKey && windowRef[this._callbackKey]) {
            // console.log('Callback key.');
            windowRef[this._callbackKey] = () => resolve(this.completeLoadingService());
          } else if (loadTry < 10) {
            loadTry += 1;
            // console.log('Try reload...');
            setTimeout(() => tryLoad(), 1000);
          } else {
            const retry = this._onLoadServiceFailure();

            if (retry) {
              retry.then(x => resolve(x)).catch(() => rejectWithError());
            } else {
              rejectWithError();
            }
          }
        };

        tryLoad();
      });

      this._loading.next(loadingPromise);
    }

    return this._loading.value!;
  }

  protected _onLoadServiceFailure(): Promise<T> | void {

  }

  private async completeLoadingService(): Promise<T> {
    await this._prepareCompleteLoadingService();
    const service: T = window[this._windowKey as any] as any;

    if (!service) {
      throw new Error(`Service "${this._serviceName}" could not complete loading.`);
    }

    // Init the API
    const initializedService = await this._initService(service);
    return initializedService ?? service;
  }

  protected _prepareCompleteLoadingService(): Promise<any> {
    return Promise.resolve();
  }

  protected _initService(service: T): Promise<T | void> {
    return Promise.resolve(service);
  }

}
