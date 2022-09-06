import { BehaviorSubject, combineLatest, distinctUntilChanged, map, shareReplay } from 'rxjs';
import { Maybe } from '@dereekb/util';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy } from '@angular/core';
import { DbxMapboxMarkerFactory } from './mapbox.marker';

/**
 * Component used to render a set of DbxMapboxMarker values from the input data and marker factory.
 */
@Component({
  selector: 'dbx-mapbox-markers',
  template: `
    <dbx-mapbox-marker *ngFor="let marker of markers$ | async" [marker]="marker"></dbx-mapbox-marker>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxMapboxMarkersComponent<T> implements OnDestroy {
  private _data = new BehaviorSubject<Maybe<T[]>>(undefined);
  private _markerFactory = new BehaviorSubject<Maybe<DbxMapboxMarkerFactory<T>>>(undefined);

  readonly markers$ = combineLatest([this._data.pipe(distinctUntilChanged()), this._markerFactory.pipe(distinctUntilChanged())]).pipe(
    map(([data, markerFactory]) => {
      if (data?.length && markerFactory) {
        return data.map(markerFactory);
      } else {
        return [];
      }
    }),
    shareReplay(1)
  );

  @Input()
  get data() {
    return this._data.value;
  }

  set data(data: Maybe<T[]>) {
    this._data.next(data);
  }

  @Input()
  get markerFactory() {
    return this._markerFactory.value;
  }

  set markerFactory(markerFactory: Maybe<DbxMapboxMarkerFactory<T>>) {
    this._markerFactory.next(markerFactory);
  }

  ngOnDestroy(): void {
    this._data.complete();
    this._markerFactory.complete();
  }
}
