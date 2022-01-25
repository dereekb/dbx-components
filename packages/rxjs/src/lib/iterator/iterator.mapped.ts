import { mapLoadingStateResults, PageLoadingState } from "../loading";
import { Destroyable } from "@dereekb/util";
import { map, Observable, shareReplay } from "rxjs";
import { ItemIteratorNextRequest, PageItemIteration } from "./iteration";
import { ItemPageIteratorIterationInstance } from "./iterator.page";


export abstract class AbstractMappedPageItemIteration<I, O, M extends ItemPageIteratorIterationInstance<I, any, any>> implements PageItemIteration<O>, Destroyable {

  constructor(private readonly _instance: M) { }

  get maxPageLoadLimit() {
    return this._instance.maxPageLoadLimit;
  }

  set maxPageLoadLimit(maxPageLoadLimit: number) {
    this._instance.maxPageLoadLimit = maxPageLoadLimit;
  }

  readonly hasNext$: Observable<boolean> = this._instance.hasNext$;
  readonly canLoadMore$: Observable<boolean> = this._instance.canLoadMore$;
  readonly latestLoadedPage$: Observable<number> = this._instance.latestLoadedPage$;

  readonly latestState$: Observable<PageLoadingState<O>> = this._instance.latestState$.pipe(
    map(state => mapLoadingStateResults(state, {
      mapValue: (v: I) => this._mapStateValue(v)
    })),
    shareReplay(1)
  );

  readonly currentState$: Observable<PageLoadingState<O>> = this._instance.currentState$.pipe(
    map(state => mapLoadingStateResults(state, {
      mapValue: (v: I) => this._mapStateValue(v)
    })),
    shareReplay(1)
  );

  nextPage(request?: ItemIteratorNextRequest): Promise<number> {
    return this._instance.nextPage(request);
  }

  next(request?: ItemIteratorNextRequest): void {
    return this._instance.next(request);
  }

  destroy() {
    this._instance.destroy();
  }

  protected abstract _mapStateValue(input: I): O;

}
