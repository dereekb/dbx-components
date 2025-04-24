import { AbstractControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CompactContextStore, mapCompactModeObs } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, Component, Injector, OnDestroy, OnInit, inject } from '@angular/core';
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { FieldType } from '@ngx-formly/material';
import { skip, first, BehaviorSubject, filter, shareReplay, startWith, switchMap, map, Observable, throttleTime, skipWhile, of, distinctUntilChanged } from 'rxjs';
import { asObservableFromGetter, filterMaybe, ObservableFactoryWithRequiredInput, SubscriptionObject } from '@dereekb/rxjs';
import { Maybe, LatLngPoint, LatLngPointFunctionConfig, LatLngStringFunction, latLngStringFunction, Milliseconds, latLngPointFunction, isDefaultLatLngPoint, isValidLatLngPoint, LatLngPointFunction, isSameLatLngPoint, defaultLatLngPoint } from '@dereekb/util';
import { GeolocationService } from '@ng-web-apis/geolocation';
import { Marker } from 'mapbox-gl';
import { DbxMapboxInjectionStore, DbxMapboxMapStore, DbxMapboxMarkerDisplayConfig, DbxMapboxModule, MapboxEaseTo, MapboxZoomLevel, provideMapboxStoreIfParentIsUnavailable } from '@dereekb/dbx-web/mapbox';
import { DbxFormMapboxLatLngFieldMarkerComponent } from './latlng.field.marker.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export const DEFAULT_DBX_FORM_MAPBOX_LAT_LNG_FIELD_INJECTION_KEY = 'DbxFormMapboxLatLngFieldComponent';

export const DEFAULT_DBX_FORM_MAPBOX_LAT_LNG_MARKER_CONFIG: DbxMapboxMarkerDisplayConfig = {
  icon: 'pin_drop'
};

export interface DbxFormMapboxLatLngComponentFieldProps extends FormlyFieldProps {
  /**
   * (Optional) Whether or not the show the map. If the map is not shown, relies on the center of the parent map to determine position.
   *
   * Defaults to true.
   *
   * Cases where this would be set false is if another map is being used.
   */
  readonly showMap?: boolean;
  /**
   * Whether or not to display the center button. Is set to false if selectLocationOnMapDrag is true.
   */
  readonly showCenterButton?: boolean;
  /**
   * Whether or not to set the center of the map on the location when set. Defaults to true.
   */
  readonly setCenterOnLocationSet?: boolean;
  /**
   * Whether or not to enable dragging the map to select the location. Defaults to true.
   *
   * Only applicable when showMap is false.
   */
  readonly selectLocationOnMapDrag?: boolean;
  /**
   * Whether or not to enable clicking the map to select the location. Defaults to false.
   *
   * Only applicable when showMap is false.
   */
  readonly selectLocationOnMapClick?: boolean;
  /**
   * (Optional) Zoom to start the map at. Ignored if the showMap is false.
   */
  readonly zoom?: MapboxZoomLevel;
  /**
   * Time until recentering on the marker. If the time is 0 then the recentering is disabled.
   */
  readonly recenterTime?: Milliseconds;
  readonly latLngConfig?: LatLngPointFunctionConfig;
  /**
   * Unique injection key.
   *
   * If not defined, the default key will be used.
   *
   * If false is passed, the marker will not be configured in the injection store.
   */
  readonly mapInjectionKey?: Maybe<string | false>;
  /**
   * Marker configuration or factory. If false is passed, the marker will not be displayed.
   */
  readonly markerConfig?: false | ObservableFactoryWithRequiredInput<DbxMapboxMarkerDisplayConfig | false, DbxFormMapboxLatLngFieldComponent>;
}

/*
  TODO: Re-add menu for picking a new location, including using the current location.
 <button mat-icon-button (click)="useCurrentLocation()" [disabled]="isReadonlyOrDisabled || (useCurrentLocationDisabled$ | async)">
          <mat-icon>my_location</mat-icon>
        </button>
 */

@Component({
  template: `
    <div class="dbx-mapbox-input-field" [ngClass]="compactClassSignal()" [formGroup]="formGroup">
      @if (showMap) {
        <div class="dbx-mapbox-input-field-map">
          <mgl-map dbxMapboxMap>
            <mgl-marker [lngLat]="latLngSignal()" [draggable]="!isReadonlyOrDisabled" (markerDragEnd)="onMarkerDragEnd($event)"></mgl-marker>
          </mgl-map>
        </div>
      }
      <div class="dbx-mapbox-input-field-input">
        @if (showCenterButton) {
          <button mat-icon-button (click)="flyToMarker()">
            <mat-icon>my_location</mat-icon>
          </button>
        }
        <mat-form-field class="dbx-mapbox-input-field-input-field">
          <mat-label>Coordinates</mat-label>
          <input type="text" matInput [placeholder]="placeholder" [formControl]="formControl" />
          @if (useCurrentLocationDisabledSignal()) {
            <mat-hint class="dbx-hint dbx-warn">Could not access your current location.</mat-hint>
          }
        </mat-form-field>
      </div>
    </div>
  `,
  providers: [provideMapboxStoreIfParentIsUnavailable()],
  styleUrls: ['../mapbox.field.component.scss'],
  imports: [NgClass, ReactiveFormsModule, MatIconModule, DbxMapboxModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFormMapboxLatLngFieldComponent<T extends DbxFormMapboxLatLngComponentFieldProps = DbxFormMapboxLatLngComponentFieldProps> extends FieldType<FieldTypeConfig<T>> implements OnInit, OnDestroy {
  private readonly _geolocationService = inject(GeolocationService);

  readonly compact = inject(CompactContextStore, { optional: true });
  readonly dbxMapboxInjectionStore = inject(DbxMapboxInjectionStore, { optional: true });
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);
  readonly injector = inject(Injector);

  private readonly _sub = new SubscriptionObject();
  private readonly _geoSub = new SubscriptionObject();
  private readonly _centerSub = new SubscriptionObject();
  private readonly _flyToCenterSub = new SubscriptionObject();
  private readonly _clickSub = new SubscriptionObject();
  private readonly _zoom = new BehaviorSubject<MapboxZoomLevel>(12);
  private readonly _markerConfig = new BehaviorSubject<Observable<DbxMapboxMarkerDisplayConfig | false>>(of(DEFAULT_DBX_FORM_MAPBOX_LAT_LNG_MARKER_CONFIG));

  private _latLngStringFunction!: LatLngStringFunction;
  private _latLngPointFunction!: LatLngPointFunction;

  readonly compactClass$ = mapCompactModeObs(this.compact?.mode$, {
    compact: 'dbx-mapbox-input-field-compact'
  }).pipe(filterMaybe());

  private readonly _useCurrentLocationDisabled = new BehaviorSubject<boolean>(false);
  readonly useCurrentLocationDisabled$ = this._useCurrentLocationDisabled.asObservable();

  private readonly _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  readonly value$ = this.formControl$.pipe(
    switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
    shareReplay(1)
  );

  readonly latLng$: Observable<LatLngPoint> = this.value$.pipe(
    filterMaybe(),
    map((x) => this._latLngPointFunction(x)),
    distinctUntilChanged<LatLngPoint>(isSameLatLngPoint),
    shareReplay(1)
  );

  readonly nonZeroLatLng$: Observable<LatLngPoint> = this.latLng$.pipe(
    /**
     * Center observable passed to the store. Do not pass invalid points.
     *
     * Also skip any initial 0,0 values so the center doesn't potentially "whip" from 0,0 to a final loaded value.
     */
    skipWhile<LatLngPoint>(isDefaultLatLngPoint),
    filter(isValidLatLngPoint)
  );

  readonly zoom$ = this._zoom.asObservable();
  readonly markerConfig$ = this._markerConfig.asObservable().pipe(
    switchMap((x) => x),
    shareReplay(1)
  );

  readonly useCurrentLocationDisabledSignal = toSignal(this._useCurrentLocationDisabled, { initialValue: false });
  readonly compactClassSignal = toSignal(this.compactClass$, { initialValue: '' });
  readonly latLngSignal = toSignal(this.latLng$, { initialValue: defaultLatLngPoint() });

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

  get selectLocationOnMapDrag(): boolean {
    return this.field.props.selectLocationOnMapDrag ?? true;
  }

  get selectLocationOnMapClick(): boolean {
    return this.field.props.selectLocationOnMapClick ?? false;
  }

  get setCenterOnLocationSet() {
    return this.field.props.setCenterOnLocationSet ?? true;
  }

  get showCenterButton() {
    return !this.selectLocationOnMapDrag && this.props.showCenterButton !== false;
  }

  get recenterTime(): Milliseconds {
    return this.field.props.recenterTime || 10 * 1000;
  }

  get useCurrentLocationDisabled() {
    return this._useCurrentLocationDisabled;
  }

  get mapInjectionKey() {
    return this.field.props.mapInjectionKey;
  }

  get markerConfig() {
    return this.field.props.markerConfig;
  }

  ngOnInit(): void {
    const latLngPointConfig = { ...this.field.props.latLngConfig, wrap: this.field.props.latLngConfig?.wrap || false, validate: this.field.props.latLngConfig?.validate || false, precisionRounding: this.field.props.latLngConfig?.precisionRounding ?? 'round' };
    this._latLngStringFunction = latLngStringFunction(latLngPointConfig);
    this._latLngPointFunction = latLngPointFunction(latLngPointConfig);

    this._formControlObs.next(this.formControl);
    this._zoom.next(this.zoom);

    if (this.setCenterOnLocationSet) {
      this._centerSub.subscription = this.dbxMapboxMapStore.setCenter(this.nonZeroLatLng$);
    }

    if (this.showMap) {
      // Set zoom only if showMap is true
      this.dbxMapboxMapStore.setZoom(this.zoom$);

      // recenter periodically
      if (this.recenterTime > 0) {
        this._flyToCenterSub.subscription = this.dbxMapboxMapStore.center$.pipe(skip(1), throttleTime(this.recenterTime, undefined, { leading: false, trailing: true })).subscribe(() => {
          this.flyToMarker();
        });
      }
    } else {
      // use the center of the map to set locations
      if (this.selectLocationOnMapDrag) {
        this._sub.subscription = this.dbxMapboxMapStore.center$.subscribe((center) => {
          this.dbxMapboxMapStore.centerGivenMargin$.pipe(first()).subscribe(() => {
            if (!this.isReadonlyOrDisabled) {
              this.setValue(center);
            }
          });
        });
      }

      // enable selecting the location on a map click
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

    // Add the marker to the injection store for display
    if (this.dbxMapboxInjectionStore) {
      if (this.markerConfig != null) {
        this._markerConfig.next(this.markerConfig === false ? of(false) : asObservableFromGetter(this.markerConfig, this));
      }

      this.dbxMapboxInjectionStore.addInjectionConfig({
        key: this.mapInjectionKey || DEFAULT_DBX_FORM_MAPBOX_LAT_LNG_FIELD_INJECTION_KEY,
        injectionConfig: {
          componentClass: DbxFormMapboxLatLngFieldMarkerComponent,
          providers: [{ provide: DbxFormMapboxLatLngFieldComponent, useValue: this }]
        }
      });
    }
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._zoom.complete();
    this._markerConfig.complete();
    this._formControlObs.complete();
    this._sub.destroy();
    this._geoSub.destroy();
    this._centerSub.destroy();
    this._flyToCenterSub.destroy();
    this._clickSub.destroy();
  }

  flyToMarker() {
    this.dbxMapboxMapStore.easeTo(
      this.nonZeroLatLng$.pipe(
        first(),
        map((x) => ({ center: x }) as MapboxEaseTo)
      )
    );
  }

  useCurrentLocation() {
    this._geoSub.subscription = this._geolocationService.pipe(first()).subscribe({
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
