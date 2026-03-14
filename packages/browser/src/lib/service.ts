/*eslint @typescript-eslint/no-explicit-any:"off"*/
// any is used with intent here. Proper typing with Window requires using the dynamic strings _windowKey and _callbackKey.
import { type Maybe, type Destroyable, stringToBoolean } from '@dereekb/util';
import { filterMaybe, tapFirst } from '@dereekb/rxjs';
import { type Observable, BehaviorSubject, switchMap, shareReplay, from, firstValueFrom } from 'rxjs';

/**
 * Record type representing a service instance attached to the `window` object, keyed by a string identifier.
 */
export type ServiceInWindow<T> = Record<string, Maybe<T>>;

/**
 * Record type representing a callback function attached to the `window` object, called when a service finishes loading.
 */
export type ServiceCallbackInWindow = Record<string, () => void>;

/**
 * Used for loading services in the browser that are imported from other scripts, such as Facebook, Segment, Stripe, etc.
 */
export abstract class AbstractAsyncWindowLoadedService<T> implements Destroyable {
  private readonly _loading = new BehaviorSubject<Maybe<Promise<T>>>(undefined);

  /**
   * Key that is attached to the window for the object that is the service when finished loading.
   */
  private readonly _windowKey: string;

  /**
   * Optional key attached to window that is a function that is executed when the setup is complete.
   */
  private readonly _callbackKey?: Maybe<string>;

  /**
   * Service name used in logging. Defaults to the windowKey.
   */
  private readonly _serviceName: string;

  /**
   * Observable that emits the loading promise. Subscribing triggers the initial load if not already started.
   */
  readonly loading$: Observable<Promise<T>> = this._loading.pipe(
    tapFirst(() => this.loadService()),
    filterMaybe(),
    shareReplay(1)
  );

  /**
   * Observable that emits the resolved service instance once loading completes. Replays the last value to new subscribers.
   */
  readonly service$: Observable<T> = this.loading$.pipe(
    switchMap((x) => from(x)),
    shareReplay(1)
  );

  /**
   * @param windowKey - Key on the `window` object where the loaded service is stored
   * @param callbackKey - Optional key on `window` for a callback invoked when the service script finishes loading
   * @param serviceName - Human-readable name for logging; defaults to `windowKey`
   * @param preload - When truthy, begins loading the service immediately on construction
   */
  constructor(windowKey: string, callbackKey?: string, serviceName?: Maybe<string>, preload?: Maybe<boolean | string>) {
    this._windowKey = windowKey;
    this._callbackKey = callbackKey;
    this._serviceName = serviceName ?? windowKey;

    if (stringToBoolean(preload)) {
      // Begin loading the service immediately.
      setTimeout(() => this.loadService().catch());
    }
  }

  /**
   * Completes the internal loading subject, stopping any pending service resolution.
   */
  destroy(): void {
    this._loading.complete();
  }

  /**
   * Returns a promise that resolves with the loaded service instance.
   *
   * Triggers loading if not already started.
   */
  getService(): Promise<T> {
    return firstValueFrom(this.service$);
  }

  // MARK: Loading
  /**
   * Initiates the service loading process by polling the `window` object for the service key.
   *
   * Retries up to 10 times at 1-second intervals before invoking `_onLoadServiceFailure()`.
   * Subsequent calls return the same promise without re-initiating.
   *
   * @returns Promise that resolves with the loaded service
   */
  protected loadService(): Promise<T> {
    if (!this._loading.value) {
      const loadingPromise = new Promise<T>((resolve, reject) => {
        let loadTry = 0;

        const rejectWithError = () => {
          reject(new Error(`Service "${this._serviceName}" failed loading with windowKey "${this._windowKey}"`));
        };

        const tryLoad = () => {
          const windowRef = window;

          // Loaded before the promise.
          if ((windowRef as unknown as ServiceInWindow<T>)[this._windowKey]) {
            // Not yet finished loading async. Intercept the function.
            // console.log('Window key.');
            return resolve(this.completeLoadingService());
          } else if (this._callbackKey && (windowRef as unknown as ServiceCallbackInWindow)[this._callbackKey]) {
            // console.log('Callback key.');
            (windowRef as unknown as ServiceCallbackInWindow)[this._callbackKey] = () => resolve(this.completeLoadingService());
          } else if (loadTry < 10) {
            loadTry += 1;
            // console.log('Try reload...');
            setTimeout(() => tryLoad(), 1000);
          } else {
            const retry = this._onLoadServiceFailure();

            if (retry) {
              retry.then((x) => resolve(x)).catch(() => rejectWithError());
            } else {
              rejectWithError();
            }
          }
        };

        tryLoad();
      });

      this._loading.next(loadingPromise);
    }

    return this._loading.value as Promise<T>;
  }

  /**
   * Hook called when the service fails to load after all retry attempts.
   *
   * Subclasses can override to attempt an alternative loading strategy or return a fallback promise.
   *
   * @returns A promise resolving with the service if recovery succeeds, or `void` to reject
   */
  protected _onLoadServiceFailure(): Promise<T> | void {
    // override in parent if needed.
  }

  private async completeLoadingService(): Promise<T> {
    await this._prepareCompleteLoadingService();
    const service: Maybe<T> = (window as unknown as ServiceInWindow<T>)[this._windowKey];

    if (!service) {
      throw new Error(`Service "${this._serviceName}" could not complete loading.`);
    }

    // Init the API
    const initializedService = await this._initService(service);
    return initializedService ?? service;
  }

  /**
   * Hook called before completing the service load. Subclasses can override to perform
   * additional async setup before the service reference is read from `window`.
   */
  protected _prepareCompleteLoadingService(): Promise<unknown> {
    return Promise.resolve();
  }

  /**
   * Hook called after the service is retrieved from `window` to perform initialization.
   *
   * Subclasses can override to configure or wrap the service before it is emitted to subscribers.
   *
   * @param service - The raw service instance from the window
   * @returns The initialized service, or void to use the original
   */
  protected _initService(service: T): Promise<T | void> {
    return Promise.resolve(service);
  }
}
