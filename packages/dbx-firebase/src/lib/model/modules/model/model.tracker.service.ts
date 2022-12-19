import { map, Observable, switchMap } from 'rxjs';
import { Injectable } from '@angular/core';
import { allDbxModelViewTrackerEventModelKeys, DbxModelTrackerService } from '@dereekb/dbx-web';
import { DbxFirebaseModelTypesService, DbxFirebaseModelTypesServiceInstancePair } from './model.types.service';

@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseModelTrackerService {
  // TODO: Expose as observables directly that update when history events change.

  loadHistoryKeys() {
    return this.dbxModelTrackerService.getAllViewEvents().pipe(map(allDbxModelViewTrackerEventModelKeys));
  }

  loadHistoryPairs(): Observable<DbxFirebaseModelTypesServiceInstancePair[]> {
    const historyKeys$ = this.loadHistoryKeys();
    return historyKeys$.pipe(switchMap((x) => this.dbxFirebaseModelTypesService.instancePairsForKeys(x)));
  }

  constructor(readonly dbxModelTrackerService: DbxModelTrackerService, readonly dbxFirebaseModelTypesService: DbxFirebaseModelTypesService) {}
}
