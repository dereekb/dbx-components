import { Injectable, OnDestroy, inject } from '@angular/core';
import { SubscriptionObject } from '@dereekb/rxjs';
import { switchMap, tap, merge, Subject, throttleTime } from 'rxjs';
import { DbxMapboxMapStore } from './mapbox.store';

/**
 * Provided in the parent component that allows children to emit events related to their lifecycles.
 */
@Injectable({
  providedIn: null
})
export class DbxMapboxChangeService implements OnDestroy {
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);

  private _markerDestroyed = new Subject<void>();
  private _applyChanges = new Subject<void>();

  readonly markerDestroyed$ = this._markerDestroyed;
  readonly applyChanges$ = merge(this._applyChanges, this.markerDestroyed$).pipe(throttleTime(100, undefined, { leading: false, trailing: true }));

  private _applyChangesSub = new SubscriptionObject(
    this.dbxMapboxMapStore.mapService$
      .pipe(
        switchMap((mapService) =>
          this.applyChanges$.pipe(
            tap(() => {
              mapService.applyChanges();
            })
          )
        )
      )
      .subscribe()
  );

  applyChanges() {
    this._applyChanges.next();
  }

  emitMarkerDestroyed() {
    this._markerDestroyed.next();
  }

  ngOnDestroy(): void {
    this._markerDestroyed.complete();
    this._applyChanges.complete();
    this._applyChangesSub.destroy();
  }
}
