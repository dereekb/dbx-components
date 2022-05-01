import { Observable } from 'rxjs';
import { FirestoreCollection, FirestoreDocument, FirestoreQueryConstraint } from '@dereekb/firebase';
import { Directive, Input, OnDestroy, OnInit } from "@angular/core";
import { ArrayOrValue, Maybe } from '@dereekb/util';
import { DbxFirebaseModelLoader } from './model.loader';
import { dbxFirebaseModelLoaderInstance, DbxFirebaseModelLoaderInstance } from './model.loader.instance';
import { SubscriptionObject } from '@dereekb/rxjs';

/**
 * Abstract directive DbxFirebaseModelLoader implementation that wraps a DbxFirebaseModelLoaderInstance.
 */
@Directive()
export abstract class AbstractDbxFirebaseModelLoaderInstanceDirective<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> implements DbxFirebaseModelLoader<T>, OnInit, OnDestroy {

  readonly constraints$ = this.instance.constraints$;;
  readonly firestoreIteration$ = this.instance.firestoreIteration$;
  readonly pageLoadingState$ = this.instance.pageLoadingState$;

  ngOnInit(): void {
    this.instance.init();
  }

  ngOnDestroy(): void {
    this.instance.destroy();
  }

  constructor(readonly instance: DbxFirebaseModelLoaderInstance<T, D>) { }

  // MARK: Inputs
  @Input()
  get maxPages(): Maybe<number> {
    return this.instance.maxPages;
  }

  set maxPages(maxPages: Maybe<number>) {
    this.instance.maxPages = maxPages;
  }

  @Input()
  get itemsPerPage(): Maybe<number> {
    return this.instance.itemsPerPage;
  }

  set itemsPerPage(itemsPerPage: Maybe<number>) {
    this.instance.itemsPerPage = itemsPerPage;
  }

  @Input()
  set constraints(constraints: Maybe<ArrayOrValue<FirestoreQueryConstraint>>) {
    this.instance.setConstraints(constraints);
  }

  // MARK: DbxFirebaseModelList
  next() {
    this.instance.next();
  }

  reset() {
    this.instance.reset();
  }

  setConstraints(constraints: Maybe<ArrayOrValue<FirestoreQueryConstraint>>) {
    this.instance.setConstraints(constraints);
  }

}

/**
 * AbstractDbxFirebaseModelLoaderInstanceDirective extension with a constructor that is more simple to use.
 */
@Directive()
export abstract class AbstractDbxFirebaseModelLoaderDirective<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends AbstractDbxFirebaseModelLoaderInstanceDirective<T, D>{

  constructor(collection: FirestoreCollection<T, D>) {
    super(dbxFirebaseModelLoaderInstance(collection));
  }

}

/**
 * AbstractDbxFirebaseModelLoaderInstanceDirective extension with a constructor that is more simple to use.
 */
@Directive()
export abstract class AbstractDbxFirebaseAsyncModelLoaderInstanceDirective<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends AbstractDbxFirebaseModelLoaderInstanceDirective<T, D>{

  abstract readonly collection$: Observable<FirestoreCollection<T, D>>;
  private readonly _collectionSub = new SubscriptionObject();

  constructor() {
    super(dbxFirebaseModelLoaderInstance(undefined));
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this._collectionSub.subscription = this.collection$.subscribe((collection) => {
      this.instance.setCollection(collection);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._collectionSub.destroy();
  }

}
