import { distinctUntilChanged, map, type Observable, shareReplay, switchMap, combineLatest, of, catchError } from 'rxjs';
import { type FirestoreCollectionType, type FirestoreDocument, type FirestoreDocumentData, type FirestoreModelIdentity, type FirestoreModelKey } from '@dereekb/firebase';
import { type DbxModelTypeInfo, type DbxModelTypesMap, DbxModelTypesService } from '@dereekb/dbx-web';
import { type ArrayOrValue, asArray, type Configurable, type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type ClickableAnchorLinkSegueRef, type IconAndTitle, type SegueRef } from '@dereekb/dbx-core';
import { type ObservableOrValue, filterMaybe, filterMaybeArray } from '@dereekb/rxjs';
import { type GrantedRole } from '@dereekb/model';
import { Injectable, inject } from '@angular/core';
import { DbxFirebaseModelContextService } from '../../service/model.context.service';
import { type DbxFirebaseInContextFirebaseModelInfoServiceInstance } from '../../service/model.context';

/**
 * Configuration provided in the root module for configuring entries.
 */
export abstract class DbxFirebaseModelTypesServiceConfig {
  /**
   * Entries to register.
   */
  abstract entries: DbxFirebaseModelTypesServiceEntry[];
}

export interface DbxFirebaseModelTypesServiceEntry<T = unknown> extends Omit<DbxModelTypeInfo, 'canSegueToView' | 'modelType'> {
  /**
   * Identity of the item being registered.
   */
  readonly identity: FirestoreModelIdentity;
  /**
   * Creates the DbxFirebaseModelDisplayInfo for the input data.
   *
   * If no icon is provided, it uses the default icon configured in this entry.
   *
   * @param value
   * @returns
   */
  readonly displayInfoFactory: FactoryWithRequiredInput<DbxFirebaseModelDisplayInfo, T>;
}

export type DbxFirebaseModelDisplayInfo = IconAndTitle;

export interface DbxFirebaseModelTypeInfo<T = unknown> extends DbxModelTypeInfo, Pick<DbxFirebaseModelTypesServiceEntry<T>, 'identity' | 'displayInfoFactory'> {}

export type DbxFirebaseModelTypesMap = DbxModelTypesMap<DbxFirebaseModelTypeInfo>;

/**
 * Provides model type information about models registered within Firebase.
 *
 * Automatically configures the DbxModelTypesService.
 */
@Injectable()
export class DbxFirebaseModelTypesService {
  readonly dbxFirebaseModelContextService = inject(DbxFirebaseModelContextService);

  readonly dbxModelTypesService = inject(DbxModelTypesService<DbxFirebaseModelTypeInfo>);
  private readonly _initialConfig = inject(DbxFirebaseModelTypesServiceConfig);

  constructor() {
    if (this._initialConfig.entries) {
      this.register(this._initialConfig.entries);
    }
  }

  getDisplayInfo<T>(typeInfo: DbxFirebaseModelTypeInfo<T>, data: T): DbxFirebaseModelDisplayInfo {
    let displayInfo: Configurable<DbxFirebaseModelDisplayInfo>;

    if (data != null) {
      displayInfo = typeInfo.displayInfoFactory(data);
      displayInfo.icon = displayInfo.icon || typeInfo.icon; // set default icon
    } else {
      displayInfo = this.getDefaultDisplayInfo(typeInfo);
    }

    return displayInfo;
  }

  getDefaultDisplayInfo<T = unknown>(typeInfo: DbxFirebaseModelTypeInfo<T>) {
    // TODO: Make configurable
    return {
      title: typeInfo.label ?? '',
      icon: 'warning'
    };
  }

  // MARK: Register
  register(entries: ArrayOrValue<DbxFirebaseModelTypesServiceEntry>) {
    const typeConfigs = asArray(entries).map((x) => ({ ...x, modelType: x.identity.modelType }));
    this.dbxModelTypesService.addTypeConfigs(typeConfigs);
  }

  // MARK: Retrieval
  currentInfoForType(type: FirestoreCollectionType): Observable<Maybe<DbxFirebaseModelTypeInfo>> {
    return this.dbxModelTypesService.typesMap$.pipe(map((x) => x[type]));
  }

  infoForType(type: FirestoreCollectionType): Observable<DbxFirebaseModelTypeInfo> {
    return this.currentInfoForType(type).pipe(
      map((x) => {
        if (!x) {
          console.error(`DbxFirebaseModelTypesService: contained no info for type "${type}". Ensure the correct type was entered, and that the type is registered with the DbxFirebaseModelTypesService.`);
          throw x;
        }

        return x as DbxFirebaseModelTypeInfo;
      })
    );
  }

  instanceForKey<D extends FirestoreDocument<any> = any, R extends GrantedRole = GrantedRole>(key$: ObservableOrValue<FirestoreModelKey>): DbxFirebaseModelTypesServiceInstance<D, R> {
    return dbxFirebaseModelTypesServiceInstance<D, R>(this.dbxFirebaseModelContextService.modelInfoInstance<D, R>(key$), this);
  }

  instancePairsForKeys(keys: ArrayOrValue<ObservableOrValue<FirestoreModelKey>>) {
    return dbxFirebaseModelTypesServiceInstancePairForKeysFactory(this)(keys);
  }
}

/**
 * Information pair for an instance.
 */
export interface DbxFirebaseModelTypesServiceInstancePair<D extends FirestoreDocument<any> = any, R extends GrantedRole = GrantedRole> {
  readonly key: FirestoreModelKey;
  readonly instance: DbxFirebaseModelTypesServiceInstance<D, R>;
  readonly displayInfo: DbxFirebaseModelDisplayInfo;
  readonly segueRef: Maybe<ClickableAnchorLinkSegueRef>;
}

export type DbxFirebaseModelTypesServiceInstancePairForKeysFactory = (keys: ArrayOrValue<ObservableOrValue<FirestoreModelKey>>) => Observable<DbxFirebaseModelTypesServiceInstancePair[]>;

/**
 * Creates a factory function that produces an observable of instance pairs for the given model keys.
 *
 * @param service - The model types service used to resolve type info and instances.
 * @returns A factory that accepts model keys and returns an Observable of instance pairs with display info and segue refs.
 */
export function dbxFirebaseModelTypesServiceInstancePairForKeysFactory(service: DbxFirebaseModelTypesService): DbxFirebaseModelTypesServiceInstancePairForKeysFactory {
  return (keys: ArrayOrValue<ObservableOrValue<FirestoreModelKey>>) => {
    const instances = asArray(keys).map((x) => service.instanceForKey(x).safeInstancePair$);
    return instances.length ? combineLatest(instances).pipe(filterMaybeArray(), shareReplay(1)) : of([]);
  };
}

/**
 * DbxFirebaseModelTypesService instance
 */
export interface DbxFirebaseModelTypesServiceInstance<D extends FirestoreDocument<any> = any, R extends GrantedRole = GrantedRole> {
  readonly modelInfoInstance$: Observable<DbxFirebaseInContextFirebaseModelInfoServiceInstance<D, R>>;
  readonly dbxFirebaseModelTypesService: DbxFirebaseModelTypesService;
  readonly key$: Observable<string>;
  readonly modelType$: Observable<string>;
  readonly snapshotData$: Observable<Maybe<FirestoreDocumentData<D>>>;
  readonly safeTypeInfo$: Observable<Maybe<DbxFirebaseModelTypeInfo<unknown>>>;
  readonly typeInfo$: Observable<DbxFirebaseModelTypeInfo<unknown>>;
  readonly identity$: Observable<FirestoreModelIdentity>;
  readonly segueRef$: Observable<Maybe<SegueRef>>;
  readonly displayInfo$: Observable<DbxFirebaseModelDisplayInfo>;
  readonly clickableSegueRef$: Observable<Maybe<ClickableAnchorLinkSegueRef>>;
  readonly safeInstancePair$: Observable<Maybe<DbxFirebaseModelTypesServiceInstancePair>>;
  readonly instancePair$: Observable<DbxFirebaseModelTypesServiceInstancePair>;
}

/**
 * Creates a {@link DbxFirebaseModelTypesServiceInstance} that provides observables for type info, display info, segue refs, and instance pairs for a single model.
 *
 * @param modelInfoInstance$ - Observable of the model info service instance providing data and role access.
 * @param dbxFirebaseModelTypesService - The model types service for resolving type configurations and display info.
 * @returns A DbxFirebaseModelTypesServiceInstance with derived observables.
 */
export function dbxFirebaseModelTypesServiceInstance<D extends FirestoreDocument<any> = any, R extends GrantedRole = GrantedRole>(modelInfoInstance$: Observable<DbxFirebaseInContextFirebaseModelInfoServiceInstance<D, R>>, dbxFirebaseModelTypesService: DbxFirebaseModelTypesService) {
  const key$ = modelInfoInstance$.pipe(switchMap((x) => x.key$));
  const modelType$ = modelInfoInstance$.pipe(switchMap((x) => x.modelType$));
  const snapshotData$ = modelInfoInstance$.pipe(switchMap((x) => x.snapshotData$));

  const safeTypeInfo$ = modelType$.pipe(
    switchMap((x) => dbxFirebaseModelTypesService.currentInfoForType(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  const typeInfo$ = safeTypeInfo$.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  const identity$ = typeInfo$.pipe(
    map((x) => x.identity),
    distinctUntilChanged()
  );

  const segueRef$: Observable<Maybe<SegueRef>> = combineLatest([key$, typeInfo$]).pipe(
    map(([key, info]) => (info.sref ? info.sref(key) : undefined)),
    shareReplay(1)
  );

  const displayInfo$: Observable<DbxFirebaseModelDisplayInfo> = combineLatest([typeInfo$, snapshotData$]).pipe(
    map(([typeInfo, data]) => dbxFirebaseModelTypesService.getDisplayInfo(typeInfo, data)),
    shareReplay(1)
  );

  const clickableSegueRef$: Observable<Maybe<ClickableAnchorLinkSegueRef>> = combineLatest([segueRef$, displayInfo$]).pipe(
    map(([segueRef, displayInfo]) => {
      let ref: Maybe<ClickableAnchorLinkSegueRef> = undefined;

      if (segueRef) {
        ref = {
          ...segueRef,
          title: displayInfo.title,
          icon: displayInfo.icon
        };
      }

      return ref;
    }),
    shareReplay(1)
  );

  const instancePair$: Observable<DbxFirebaseModelTypesServiceInstancePair> = combineLatest([clickableSegueRef$, displayInfo$, key$]).pipe(
    map(([segueRef, displayInfo, key]) => ({ segueRef, displayInfo, key, instance })),
    shareReplay(1)
  );

  const safeInstancePair$: Observable<Maybe<DbxFirebaseModelTypesServiceInstancePair>> = instancePair$.pipe(catchError(() => of(undefined)));

  const instance: DbxFirebaseModelTypesServiceInstance<D, R> = {
    modelInfoInstance$,
    dbxFirebaseModelTypesService,
    key$,
    modelType$,
    snapshotData$,
    safeTypeInfo$,
    typeInfo$,
    identity$,
    segueRef$,
    displayInfo$,
    clickableSegueRef$,
    safeInstancePair$,
    instancePair$
  };

  return instance;
}
