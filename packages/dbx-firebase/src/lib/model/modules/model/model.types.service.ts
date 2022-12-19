import { distinctUntilChanged, map, Observable, shareReplay, switchMap, combineLatest } from 'rxjs';
import { FirestoreCollectionType, FirestoreDocument, FirestoreModelIdentity, FirestoreModelKey } from '@dereekb/firebase';
import { DbxModelFullState, DbxModelTypeInfo, DbxModelTypesMap, DbxModelTypesService, onDbxModel } from '@dereekb/dbx-web';
import { ArrayOrValue, asArray, FactoryWithRequiredInput, Maybe, ModelTypeString } from '@dereekb/util';
import { ClickableAnchorLinkSegueRef, IconAndTitle, SegueRef } from '@dereekb/dbx-core';
import { ObservableOrValue } from '@dereekb/rxjs';
import { GrantedRole } from '@dereekb/model';
import { Optional, Injectable } from '@angular/core';
import { DbxFirebaseModelContextService } from '../../service/model.context.service';
import { DbxFirebaseInContextFirebaseModelInfoServiceInstance } from '../../service/model.context';
import { Store } from '@ngrx/store';

/**
 * Configuration provided in the root module for configuring entries.
 */
export abstract class DbxFirebaseModelTypesServiceConfig {
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
   * @param value
   * @returns
   */
  readonly displayInfoFactory: FactoryWithRequiredInput<DbxFirebaseModelDisplayInfo, T>;
}

export interface DbxFirebaseModelDisplayInfo extends IconAndTitle {}

export interface DbxFirebaseModelTypeInfo<T = unknown> extends DbxModelTypeInfo, Pick<DbxFirebaseModelTypesServiceEntry<T>, 'identity' | 'displayInfoFactory'> {}

export type DbxFirebaseModelTypesMap = DbxModelTypesMap<DbxFirebaseModelTypeInfo>;

/**
 * Provides model type information about models registered within Firebase.
 *
 * Automatically configures the DbxModelTypesService.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseModelTypesService {
  constructor(readonly store: Store<DbxModelFullState>, readonly dbxFirebaseModelContextService: DbxFirebaseModelContextService, readonly dbxModelTypesService: DbxModelTypesService<DbxFirebaseModelTypeInfo>, @Optional() config?: DbxFirebaseModelTypesServiceConfig) {
    if (config) {
      this.register(config.entries);
    }
  }

  getDisplayInfo<T>(typeInfo: DbxFirebaseModelTypeInfo<T>, data: T) {
    let displayInfo: DbxFirebaseModelDisplayInfo;

    if (data != null) {
      displayInfo = typeInfo.displayInfoFactory(data);
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
  currentInfoForType(type: ModelTypeString | FirestoreCollectionType): Observable<Maybe<DbxFirebaseModelTypeInfo>> {
    return this.dbxModelTypesService.typesMap$.pipe(map((x) => x[type]));
  }

  infoForType(type: ModelTypeString | FirestoreCollectionType): Observable<DbxFirebaseModelTypeInfo> {
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
    return new DbxFirebaseModelTypesServiceInstance<D, R>(this.dbxFirebaseModelContextService.modelInfoInstance<D, R>(key$), this);
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

/**
 * DbxFirebaseModelTypesService instance
 */
export class DbxFirebaseModelTypesServiceInstance<D extends FirestoreDocument<any> = any, R extends GrantedRole = GrantedRole> {
  readonly key$ = this.modelInfoInstance$.pipe(switchMap((x) => x.key$));
  readonly collectionType$ = this.modelInfoInstance$.pipe(switchMap((x) => x.collectionType$));
  readonly snapshotData$ = this.modelInfoInstance$.pipe(switchMap((x) => x.snapshotData$));

  readonly typeInfo$ = this.collectionType$.pipe(
    switchMap((x) => this.dbxFirebaseModelTypesService.infoForType(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly identity$ = this.typeInfo$.pipe(
    map((x) => x.identity),
    distinctUntilChanged()
  );

  readonly segueRef$: Observable<Maybe<SegueRef>> = combineLatest([this.key$, this.typeInfo$]).pipe(
    map(([key, info]) => (info.sref ? info.sref(key) : undefined)),
    shareReplay(1)
  );

  readonly displayInfo$: Observable<DbxFirebaseModelDisplayInfo> = combineLatest([this.typeInfo$, this.snapshotData$]).pipe(
    map(([typeInfo, data]) => {
      let displayInfo: DbxFirebaseModelDisplayInfo;

      if (data != null) {
        displayInfo = typeInfo.displayInfoFactory(data);
      } else {
        displayInfo = this.dbxFirebaseModelTypesService.getDefaultDisplayInfo(typeInfo);
      }

      return displayInfo;
    }),
    shareReplay(1)
  );

  readonly clickableSegueRef$: Observable<Maybe<ClickableAnchorLinkSegueRef>> = combineLatest([this.segueRef$, this.displayInfo$]).pipe(
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

  readonly instancePair$: Observable<DbxFirebaseModelTypesServiceInstancePair> = combineLatest([this.clickableSegueRef$, this.displayInfo$, this.key$]).pipe(
    map(([segueRef, displayInfo, key]) => ({ segueRef, displayInfo, key, instance: this })),
    shareReplay(1)
  );

  constructor(readonly modelInfoInstance$: Observable<DbxFirebaseInContextFirebaseModelInfoServiceInstance<D, R>>, readonly dbxFirebaseModelTypesService: DbxFirebaseModelTypesService) {}
}
