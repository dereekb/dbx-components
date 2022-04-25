import { itemAccumulator, iterationCurrentPageListLoadingState, PageListLoadingState } from '@dereekb/rxjs';
import { cleanupDestroyable, filterMaybe, listLoadingStateContext, useFirst } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, map, shareReplay, distinctUntilChanged, first, Subject, debounce, debounceTime, throttleTime, switchMap, Observable } from 'rxjs';
import { Directive, OnDestroy, OnInit } from "@angular/core";
import { DbxListView } from "@dereekb/dbx-web";
import { FirestoreCollection, FirestoreQueryConstraint } from '@dereekb/firebase';
import { ArrayOrValue, Maybe } from '@dereekb/util';
import { DbxFirebaseModelList } from './model.list';

/**
 * Directive that hooks into a DbxListView to pass data for rendering models.
 */
@Directive({
  selector: 'dbxFirebaseModelList'
})
export class DbxFirebaseModelListDirective<T> implements DbxFirebaseModelList<T>, OnInit, OnDestroy {

  private _collection = new BehaviorSubject<Maybe<FirestoreCollection<T>>>(undefined);

  private _limit = new BehaviorSubject<Maybe<number>>(undefined);
  private _constraints = new BehaviorSubject<Maybe<ArrayOrValue<FirestoreQueryConstraint>>>(undefined);
  private _reset = new Subject<void>();

  readonly collection$ = this._collection.pipe(filterMaybe());
  readonly constraints$ = this._constraints.pipe(distinctUntilChanged());

  readonly iteratorFilter$ = combineLatest([this._limit.pipe(distinctUntilChanged()), this.constraints$]).pipe(
    map(([limit, constraints]) => ({ limit, constraints })),
    shareReplay(1)
  );

  readonly firestoreIteration$ = combineLatest([this.collection$, this.iteratorFilter$, this._reset]).pipe(
    throttleTime(100, undefined, { trailing: true }),  // prevent rapid changes and executing filters too quickly.
    map(([collection, iteratorFilter]) => collection.firestoreIteration(iteratorFilter)),
    cleanupDestroyable(), // cleanup the iteration
    shareReplay(1)
  );

  readonly accumulator$ = this.firestoreIteration$.pipe(
    map(x => itemAccumulator(x)),
    cleanupDestroyable(),
    shareReplay(1)
  );

  readonly pageLoadingState$: Observable<PageListLoadingState<T>> = this.accumulator$.pipe(
    switchMap(x => iterationCurrentPageListLoadingState(x) as Observable<PageListLoadingState<T>>),
    shareReplay(1)
  );

  readonly stateContext = listLoadingStateContext({ obs: this.pageLoadingState$, showLoadingOnNoValue: false });

  constructor(readonly dbxListView: DbxListView<T>) { }

  ngOnInit(): void {
    this.dbxListView.setListContext(this.stateContext);
  }

  ngOnDestroy(): void {
    this._collection.complete();
    this._constraints.complete();
    this._limit.complete();
    this._reset.complete();
  }

  // MARK: DbxFirebaseModelList
  next() {
    useFirst(this.firestoreIteration$, (x) => x.next());
  }

  reset() {
    this._reset.next();
  }

}
