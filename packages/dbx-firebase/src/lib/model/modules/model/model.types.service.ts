import { BehaviorSubject, distinctUntilChanged, map, Observable, shareReplay, switchMap, combineLatest, identity } from 'rxjs';
import { ArrayOrValue, FactoryWithRequiredInput, Maybe, ModelTypeString } from '@dereekb/util';
import { FirestoreCollectionType, FirestoreDocument, FirestoreModelIdentity, FirestoreModelKey, firestoreModelKeyCollectionType } from '@dereekb/firebase';
import { Injectable } from '@angular/core';
import { DbxModelTypeInfo, DbxModelTypesMap, DbxModelTypesService } from '@dereekb/dbx-web';
import { DbxFirebaseModelContextService } from '../../service/model.context.service';
import { ObservableOrValue, asObservable } from '@dereekb/rxjs';
import { ClickableAnchorLinkSegueRef, ClickableIconAnchorLink, IconAndTitle, SegueRef } from '@dereekb/dbx-core';
import { GrantedRole } from '@dereekb/model';
import { DbxFirebaseInContextFirebaseModelInfoServiceInstance } from '../../service/model.context';

export interface DbxFirebaseModelTypesServiceEntry<T = unknown> extends Omit<DbxModelTypeInfo, 'canSegueToView'> {
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
  constructor(readonly dbxFirebaseModelContextService: DbxFirebaseModelContextService, readonly dbxModelTypesService: DbxModelTypesService<DbxFirebaseModelTypeInfo>) {}

  getDefaultDisplayInfo(typeInfo: DbxFirebaseModelTypeInfo) {
    // TODO: Make configurable

    return {
      title: typeInfo.label ?? '',
      icon: 'warning'
    };
  }

  // MARK: Register
  register(entries: ArrayOrValue<DbxFirebaseModelTypesServiceEntry>) {
    // TODO: register the entries in the store...
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
        }

        return x as DbxFirebaseModelTypeInfo;
      })
    );
  }

  instanceForKey<D extends FirestoreDocument<any> = any, R extends GrantedRole = GrantedRole>(key$: ObservableOrValue<FirestoreModelKey>): DbxFirebaseModelTypesServiceInstance<D, R> {
    return new DbxFirebaseModelTypesServiceInstance<D, R>(this.dbxFirebaseModelContextService.modelInfoInstance<D, R>(key$), this);
  }
}

export class DbxFirebaseModelTypesServiceInstance<D extends FirestoreDocument<any> = any, R extends GrantedRole = GrantedRole> {
  readonly key$ = this.modelInfoInstance.key$;
  readonly collectionType$ = this.modelInfoInstance.collectionType$;

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

  readonly displayInfo$: Observable<DbxFirebaseModelDisplayInfo> = combineLatest([this.typeInfo$, this.modelInfoInstance.snapshotData$]).pipe(
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

  constructor(readonly modelInfoInstance: DbxFirebaseInContextFirebaseModelInfoServiceInstance<D, R>, readonly dbxFirebaseModelTypesService: DbxFirebaseModelTypesService) {}
}
