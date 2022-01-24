
import { QueryDocumentSnapshot, query, startAt, CollectionReference, getDocs, QueryConstraint, limit } from '@angular/fire/firestore';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject, combineLatest, Observable } from "rxjs";
import { exhaustMap, first, switchMap, shareReplay, map, startWith, scan, delay, filter } from "rxjs/operators";

export abstract class AbstractDatastoreCollectionIterator<T> {

  private readonly _next = new BehaviorSubject(0);

  limit = 100;

  constructor(readonly collection: CollectionReference<T>) { }

  readonly pageResults$: Observable<QueryDocumentSnapshot<T>[]> = this._next.pipe(
    exhaustMap(() => {
      return combineLatest([this.hasNext$, this.pageResultsCursorDocument$]).pipe(
        first(),
        filter(([hasNext]) => hasNext),
        switchMap(async ([_, cursor]) => {
          const startsAtFilter = (cursor) ? startAt(cursor) : undefined;
          const filters = [...this.buildQueryContraints()];

          filters.push(limit(this.limit + ((cursor) ? 1 : 0)));

          if (startsAtFilter) {
            filters.push(startsAtFilter);
          }

          const batchQuery = query<T>(this.collection, ...filters);
          let docs = await getDocs(batchQuery).then(x => x.docs);

          if (cursor && docs[0].id === cursor.id) {
            docs = docs.slice(1);
          }

          return docs;
        })
      );
    }),
    shareReplay(1)
  );

  /**
   * The last document from pageResults$. It is used as a cursor.
   */
  readonly pageResultsCursorDocument$: Observable<Maybe<QueryDocumentSnapshot<T>>> = this.pageResults$.pipe(
    map(x => x[x.length - 1]),
    startWith(undefined as Maybe<QueryDocumentSnapshot<T>>),   // StartWith is provided to prevent waiting on pageResults$
    shareReplay(1)
  );

  readonly hasNext$ = this.pageResultsCursorDocument$.pipe(
    startWith(true),
    scan((prev: QueryDocumentSnapshot<T> | false, curr: QueryDocumentSnapshot<T>) => {
      if (prev === false || ((prev as any) !== true && curr == null)) {
        return false;
      } else if (prev && curr && prev.id === curr.id) {
        return false;
      } else {
        return curr;
      }
    }),
    map(x => x !== false),
    shareReplay(1)
  );

  readonly loadedAll$ = this.hasNext$.pipe(map(x => !x), shareReplay(1));

  readonly currentPageResultsData$: Observable<T[]> = this.pageResults$.pipe(
    map(x => x.map(y => ({ ...y.data(), id: y.id }))),
    shareReplay(1)
  );

  readonly results = this.pageResults$.pipe(
    scan((acc, next) => acc.concat(next), [] as T[]),
    shareReplay(1)
  );

  readonly resultsData$ = this.currentPageResultsData$.pipe(
    scan((acc, next) => acc.concat(next), [] as T[]),
    shareReplay(1)
  );

  buildQueryContraints(): QueryConstraint[] {
    return [];
  }

  next(): void {
    this._next.next(this._next.value + 1);
  }

  async loadAll(): Promise<void> {
    this.limit = 1000;
    return new Promise((resolve) => {
      const sub = this.hasNext$.pipe(delay(50)).subscribe((x) => {
        if (x) {
          this.next();
        } else {
          sub.unsubscribe();
          resolve();
        }
      });
    });
  }

  destroy() {
    this._next.complete();
  }

}
