import { AbstractControl, FormGroup } from '@angular/forms';
import { CompactContextStore, mapCompactModeObs } from '@dereekb/dbx-web';
import { Component, NgZone, OnDestroy, OnInit, Optional } from '@angular/core';
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { FieldType } from '@ngx-formly/material';
import { skip, first, BehaviorSubject, filter, shareReplay, startWith, switchMap, map, Observable, throttleTime, skipWhile } from 'rxjs';
import { filterMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { Maybe, LatLngPoint, LatLngPointFunctionConfig, LatLngStringFunction, latLngStringFunction, Milliseconds, latLngPointFunction, isDefaultLatLngPoint, isValidLatLngPoint, LatLngPointFunction, isDefaultLatLngPointValue } from '@dereekb/util';
import { GeolocationService } from '@ng-web-apis/geolocation';
import { Marker } from 'mapbox-gl';
import { DbxMapboxMapStore, MapboxEaseTo, MapboxZoomLevel, provideMapboxStoreIfParentIsUnavailable } from '@dereekb/dbx-web/mapbox';

export interface DbxFormMapboxLatLngComponentFieldProps extends FormlyFieldProps {
  /**
   * (Optional) Whether or not the show the map. If the map is not shown, relies on the center of the parent map to determine position.
   *
   * Defaults to true.
   *
   * Cases where this would be set false is if another map is being used.
   */
  showMap?: boolean;
  /**
   * Whether or not to enable clicking the map to select the location. Defaults to false.
   *
   * Only applicable when showMap is false.
   */
  selectLocationOnMapClick?: boolean;
  /**
   * (Optional) Zoom to start the map at. Ignored if the showMap is false.
   */
  zoom?: MapboxZoomLevel;
  /**
   * Time until recentering on the marker. If the time is 0 then the recentering is disabled.
   */
  recenterTime?: Milliseconds;
  latLngConfig?: LatLngPointFunctionConfig;
}

@Component({
  template: `
    <div class="dbx-mapbox-input-field" [ngClass]="(compactClass$ | async) ?? ''" [formGroup]="formGroup">
      <div *ngIf="showMap" class="dbx-mapbox-input-field-map">
        <mgl-map dbxMapboxMap>
          <mgl-marker [lngLat]="(latLng$ | async) || [0, 0]" [draggable]="!isReadonlyOrDisabled" (markerDragEnd)="onMarkerDragEnd($event)"></mgl-marker>
        </mgl-map>
      </div>
      <div class="dbx-mapbox-input-field-input">
        <button mat-icon-button (click)="useCurrentLocation()" [disabled]="isReadonlyOrDisabled || (useCurrentLocationDisabled$ | async)">
          <mat-icon>my_location</mat-icon>
        </button>
        <mat-form-field class="dbx-mapbox-input-field-input-field" appearance="standard">
          <mat-label>Coordinates</mat-label>
          <input type="text" matInput [placeholder]="placeholder" [formControl]="formControl" />
          <mat-hint class="dbx-hint dbx-warn" *ngIf="useCurrentLocationDisabled$ | async">Could not access your current location.</mat-hint>
        </mat-form-field>
      </div>
    </div>
  `,
  providers: [provideMapboxStoreIfParentIsUnavailable()],
  styleUrls: ['../mapbox.field.component.scss']
})
export class DbxFormMapboxLatLngFieldComponent<T extends DbxFormMapboxLatLngComponentFieldProps = DbxFormMapboxLatLngComponentFieldProps> extends FieldType<FieldTypeConfig<T>> implements OnInit, OnDestroy {
  private _latLngStringFunction!: LatLngStringFunction;
  private _latLngPointFunction!: LatLngPointFunction;

  readonly compactClass$ = mapCompactModeObs(this.compact?.mode$, {
    compact: 'dbx-mapbox-input-field-compact'
  });

  private _useCurrentLocationDisabled = new BehaviorSubject<boolean>(false);
  readonly useCurrentLocationDisabled$ = this._useCurrentLocationDisabled.asObservable();

  private _sub = new SubscriptionObject();
  private _geoSub = new SubscriptionObject();
  private _centerSub = new SubscriptionObject();
  private _clickSub = new SubscriptionObject();
  private _zoom = new BehaviorSubject<MapboxZoomLevel>(12);

  private _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  readonly value$ = this.formControl$.pipe(
    switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
    shareReplay(1)
  );

  readonly latLng$: Observable<LatLngPoint> = this.value$.pipe(
    filterMaybe(),
    map((x) => this._latLngPointFunction(x)),
    shareReplay(1)
  );

  readonly center$: Observable<LatLngPoint> = this.latLng$.pipe(
    /**
     * Center observable passed to the store. Do not pass invalid points.
     *
     * Also skip any initial 0,0 values so the center doesn't potentially "whip" from 0,0 to a final loaded value.
     */
    skipWhile<LatLngPoint>(isDefaultLatLngPoint),
    filter(isValidLatLngPoint)
  );

  readonly zoom$ = this._zoom.asObservable();

  constructor(@Optional() readonly compact: CompactContextStore, private readonly geolocation$: GeolocationService, readonly dbxMapboxMapStore: DbxMapboxMapStore, readonly ngZone: NgZone) {
    super();
  }

  get zoom(): MapboxZoomLevel {
    return Math.min(this.field.props.zoom || 12, 18);
  }

  get formGroupName(): string {
    return this.field.key as string;
  }

  get formGroup(): FormGroup {
    return this.form as FormGroup;
  }

  get label(): Maybe<string> {
    return this.field.props?.label;
  }

  get description(): Maybe<string> {
    return this.props.description;
  }

  get isReadonlyOrDisabled() {
    return this.props.readonly || this.disabled;
  }

  get showMap(): boolean {
    return this.field.props.showMap ?? true;
  }

  get selectLocationOnMapClick(): boolean {
    return this.field.props.selectLocationOnMapClick ?? false;
  }

  get recenterTime(): Milliseconds {
    return this.field.props.recenterTime || 10 * 1000;
  }

  get useCurrentLocationDisabled() {
    return this._useCurrentLocationDisabled;
  }

  ngOnInit(): void {
    const latLngPointConfig = { ...this.field.props.latLngConfig, wrap: this.field.props.latLngConfig?.wrap || false, validate: this.field.props.latLngConfig?.validate || false, precisionRounding: this.field.props.latLngConfig?.precisionRounding ?? 'round' };
    this._latLngStringFunction = latLngStringFunction(latLngPointConfig);
    this._latLngPointFunction = latLngPointFunction(latLngPointConfig);

    this._formControlObs.next(this.formControl);
    this._zoom.next(this.zoom);

    this.dbxMapboxMapStore.setCenter(this.center$);

    if (this.showMap) {
      // Set zoom only if showMap is true
      this.dbxMapboxMapStore.setZoom(this.zoom$);

      // recenter periodically
      if (this.recenterTime > 0) {
        this._centerSub.subscription = this.dbxMapboxMapStore.center$.pipe(skip(1), throttleTime(this.recenterTime, undefined, { leading: false, trailing: true })).subscribe(() => {
          this.dbxMapboxMapStore.easeTo(
            this.center$.pipe(
              first(),
              map((x) => ({ center: x } as MapboxEaseTo))
            )
          );
        });
      }
    } else {
      // use the center of the map to set locations
      this._sub.subscription = this.dbxMapboxMapStore.center$.subscribe((center) => {
        this.dbxMapboxMapStore.centerGivenMargin$.pipe(first()).subscribe(() => {
          if (!this.isReadonlyOrDisabled) {
            this.ngZone.run(() => {
              this.setValue(center);
            });
          }
        });
      });

      if (this.selectLocationOnMapClick) {
        this._clickSub.subscription = this.dbxMapboxMapStore.clickEvent$.subscribe((x) => {
          if (x?.type === 'click') {
            this.setValue(x.lngLat);
          }
        });
      }
    }

    if (this.props.readonly) {
      this.formControl.disable();
    }
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._sub.destroy();
    this._geoSub.destroy();
    this._zoom.complete();
    this._formControlObs.complete();
    this._centerSub.destroy();
    this._clickSub.destroy();
  }

  useCurrentLocation() {
    this._geoSub.subscription = this.geolocation$.pipe(first()).subscribe({
      next: (position) => {
        if (position) {
          const { latitude: lat, longitude: lng } = position.coords;
          this.setValue({ lat, lng });
        }
      },
      error: () => {
        this._useCurrentLocationDisabled.next(true);
      }
    });
  }

  onMarkerDragEnd(marker: Marker) {
    this.setValue(marker.getLngLat());
  }

  setValue(latLng?: Maybe<LatLngPoint>) {
    this.formControl.setValue(latLng ? this._latLngStringFunction(latLng) : latLng);
    this.formControl.markAsTouched();
    this.formControl.markAsDirty();
  }
}
