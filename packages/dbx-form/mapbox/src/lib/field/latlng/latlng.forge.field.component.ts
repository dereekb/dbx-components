import { CompactContextStore, mapCompactModeObs } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, Component, type OnDestroy, computed, effect, inject, input, type InputSignal, type Signal } from '@angular/core';
import { skip, first, BehaviorSubject, filter, shareReplay, switchMap, map, type Observable, throttleTime, skipWhile, of, distinctUntilChanged } from 'rxjs';
import { asObservableFromGetter, filterMaybe, type ObservableFactoryWithRequiredInput, SubscriptionObject } from '@dereekb/rxjs';
import { type Maybe, type LatLngPoint, type LatLngPointFunctionConfig, type LatLngStringFunction, latLngStringFunction, type Milliseconds, latLngPointFunction, isDefaultLatLngPoint, isValidLatLngPoint, type LatLngPointFunction, isSameLatLngPoint, defaultLatLngPoint } from '@dereekb/util';
import { WaGeolocationService } from '@ng-web-apis/geolocation';
import { type Marker } from 'mapbox-gl';
import { DbxMapboxInjectionStore, DbxMapboxMapStore, type DbxMapboxMarkerDisplayConfig, DbxMapboxModule, type MapboxEaseTo, type MapboxZoomLevel, provideMapboxStoreIfParentIsUnavailable } from '@dereekb/dbx-web/mapbox';
import { DbxForgeMapboxLatLngFieldMarkerComponent } from './latlng.forge.field.marker.component';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MapComponent, MarkerComponent } from 'ngx-mapbox-gl';
import type { FieldTree } from '@angular/forms/signals';
import { type DynamicText, type FieldMeta, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs } from '@ng-forge/dynamic-forms/integration';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

export const DEFAULT_DBX_FORGE_MAPBOX_LAT_LNG_FIELD_INJECTION_KEY = 'DbxForgeMapboxLatLngFieldComponent';

export const DEFAULT_DBX_FORGE_MAPBOX_LAT_LNG_MARKER_CONFIG: DbxMapboxMarkerDisplayConfig = {
  icon: 'pin_drop'
};

/**
 * Custom props for the forge mapbox lat/lng field.
 */
export interface DbxForgeMapboxLatLngFieldComponentProps {
  readonly label?: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly pattern?: RegExp;
  readonly patternMessage?: string;
  readonly showMap?: boolean;
  readonly showCenterButton?: boolean;
  readonly setCenterOnLocationSet?: boolean;
  readonly selectLocationOnMapDrag?: boolean;
  readonly selectLocationOnMapClick?: boolean;
  readonly zoom?: MapboxZoomLevel;
  readonly recenterTime?: Milliseconds;
  readonly latLngConfig?: LatLngPointFunctionConfig;
  readonly mapInjectionKey?: Maybe<string | false>;
  readonly markerConfig?: false | ObservableFactoryWithRequiredInput<DbxMapboxMarkerDisplayConfig | false, DbxForgeMapboxLatLngFieldComponent>;
}

/**
 * Forge custom field component for Mapbox latitude/longitude picking.
 *
 * This is the forge equivalent of {@link DbxFormMapboxLatLngFieldComponent}.
 * It bridges ng-forge Signal Forms with the Mapbox map store.
 *
 * Registered as ng-forge type 'dbx-forge-mapbox-latlng'.
 */
@Component({
  selector: 'dbx-forge-mapbox-latlng-field',
  template: `
    <div class="dbx-mapbox-input-field" [ngClass]="compactClassSignal()">
      @if (showMapSignal()) {
        <div class="dbx-mapbox-input-field-map">
          <mgl-map dbxMapboxMap>
            <mgl-marker [lngLat]="latLngSignal()" [draggable]="!isReadonlyOrDisabledSignal()" (markerDragEnd)="onMarkerDragEnd($event)"></mgl-marker>
          </mgl-map>
        </div>
      }
      <div class="dbx-mapbox-input-field-input">
        @if (showCenterButtonSignal()) {
          <button mat-icon-button (click)="flyToMarker()">
            <mat-icon>my_location</mat-icon>
          </button>
        }
        <mat-form-field class="dbx-mapbox-input-field-input-field">
          <mat-label>Coordinates</mat-label>
          <input type="text" matInput [placeholder]="placeholderTextSignal() ?? ''" [formControl]="textCtrl" />
          @if (useCurrentLocationDisabledSignal()) {
            <mat-hint class="dbx-hint dbx-warn">Could not access your current location.</mat-hint>
          }
        </mat-form-field>
      </div>
    </div>
  `,
  providers: [provideMapboxStoreIfParentIsUnavailable()],
  styleUrls: ['../mapbox.field.component.scss'],
  imports: [NgClass, MapComponent, MarkerComponent, ReactiveFormsModule, MatIconModule, DbxMapboxModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeMapboxLatLngFieldComponent implements OnDestroy {
  private readonly _geolocationService = inject(WaGeolocationService);

  readonly compact = inject(CompactContextStore, { optional: true });
  readonly dbxMapboxInjectionStore = inject(DbxMapboxInjectionStore, { optional: true });
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);

  // Standard ng-forge value field inputs
  readonly field: InputSignal<FieldTree<unknown>> = input.required<FieldTree<unknown>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<DbxForgeMapboxLatLngFieldComponentProps | undefined> = input<DbxForgeMapboxLatLngFieldComponentProps | undefined>();
  readonly meta: InputSignal<FieldMeta | undefined> = input<FieldMeta | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  // Internal text form control for the coordinate input
  readonly textCtrl = new FormControl<string>('');

  // Subscription management
  private readonly _sub = new SubscriptionObject();
  private readonly _geoSub = new SubscriptionObject();
  private readonly _centerSub = new SubscriptionObject();
  private readonly _flyToCenterSub = new SubscriptionObject();
  private readonly _clickSub = new SubscriptionObject();
  private readonly _zoom = new BehaviorSubject<MapboxZoomLevel>(12);
  private readonly _markerConfig = new BehaviorSubject<Observable<DbxMapboxMarkerDisplayConfig | false>>(of(DEFAULT_DBX_FORGE_MAPBOX_LAT_LNG_MARKER_CONFIG));

  private _latLngStringFunction!: LatLngStringFunction;
  private _latLngPointFunction!: LatLngPointFunction;

  readonly compactClass$ = mapCompactModeObs(this.compact?.mode$, {
    compact: 'dbx-mapbox-input-field-compact'
  }).pipe(filterMaybe());

  private readonly _useCurrentLocationDisabled = new BehaviorSubject<boolean>(false);
  readonly useCurrentLocationDisabled$ = this._useCurrentLocationDisabled.asObservable();

  // Field value signal (double-call pattern)
  readonly fieldValue = computed(() => {
    const state = this.field()?.() as any;
    return state?.value?.() as unknown;
  });

  readonly isDisabled = computed(() => {
    const state = this.field()?.() as any;
    return (state?.disabled?.() as boolean) ?? false;
  });

  readonly isReadonlyOrDisabledSignal = computed(() => (this.props() as any)?.readonly || this.isDisabled());

  // Computed props from field definition
  readonly showMapSignal = computed(() => this.props()?.showMap ?? true);
  readonly selectLocationOnMapDragSignal = computed(() => this.props()?.selectLocationOnMapDrag ?? true);
  readonly selectLocationOnMapClickSignal = computed(() => this.props()?.selectLocationOnMapClick ?? false);
  readonly setCenterOnLocationSetSignal = computed(() => this.props()?.setCenterOnLocationSet ?? true);
  readonly showCenterButtonSignal = computed(() => !this.selectLocationOnMapDragSignal() && this.props()?.showCenterButton !== false);
  readonly recenterTimeSignal = computed(() => this.props()?.recenterTime || 10 * 1000);
  readonly placeholderTextSignal = computed(() => this.props()?.placeholder);

  // Observables for map store sync
  readonly fieldValue$ = toObservable(this.fieldValue);

  readonly latLng$: Observable<LatLngPoint> = this.fieldValue$.pipe(
    filterMaybe(),
    map((x) => this._latLngPointFunction?.(x as string) ?? defaultLatLngPoint()),
    distinctUntilChanged<LatLngPoint>(isSameLatLngPoint),
    shareReplay(1)
  );

  readonly nonZeroLatLng$: Observable<LatLngPoint> = this.latLng$.pipe(skipWhile<LatLngPoint>(isDefaultLatLngPoint), filter(isValidLatLngPoint));

  readonly zoom$ = this._zoom.asObservable();
  readonly markerConfig$ = this._markerConfig.asObservable().pipe(
    switchMap((x) => x),
    shareReplay(1)
  );

  readonly useCurrentLocationDisabledSignal = toSignal(this._useCurrentLocationDisabled, { initialValue: false });
  readonly compactClassSignal = toSignal(this.compactClass$, { initialValue: '' });
  readonly latLngSignal = toSignal(this.latLng$, { initialValue: defaultLatLngPoint() });

  private _syncing = false;

  private _setFieldValue(value: unknown): void {
    const state = this.field()?.() as any;
    if (state?.value?.set) {
      state.value.set(value);
      state.markAsTouched?.();
      state.markAsDirty?.();
    }
  }

  constructor() {
    // Initialize on first props emission
    effect(() => {
      const p = this.props();
      if (!p) {
        return;
      }

      const latLngPointConfig = { ...p.latLngConfig, wrap: p.latLngConfig?.wrap || false, validate: p.latLngConfig?.validate || false, precisionRounding: p.latLngConfig?.precisionRounding ?? 'round' };
      this._latLngStringFunction = latLngStringFunction(latLngPointConfig);
      this._latLngPointFunction = latLngPointFunction(latLngPointConfig);

      const zoom = Math.min(p.zoom || 12, 18) as MapboxZoomLevel;
      this._zoom.next(zoom);

      if (p.setCenterOnLocationSet !== false) {
        this._centerSub.subscription = this.dbxMapboxMapStore.setCenter(this.nonZeroLatLng$);
      }

      if (p.showMap ?? true) {
        this.dbxMapboxMapStore.setZoom(this.zoom$);

        const recenterTime = p.recenterTime || 10 * 1000;
        if (recenterTime > 0) {
          this._flyToCenterSub.subscription = this.dbxMapboxMapStore.center$.pipe(skip(1), throttleTime(recenterTime, undefined, { leading: false, trailing: true })).subscribe(() => {
            this.flyToMarker();
          });
        }
      } else {
        if (p.selectLocationOnMapDrag ?? true) {
          this._sub.subscription = this.dbxMapboxMapStore.center$.subscribe((center) => {
            this.dbxMapboxMapStore.centerGivenMargin$.pipe(first()).subscribe(() => {
              if (!this.isReadonlyOrDisabledSignal()) {
                this.setValue(center);
              }
            });
          });
        }

        if (p.selectLocationOnMapClick) {
          this._clickSub.subscription = this.dbxMapboxMapStore.clickEvent$.subscribe((x) => {
            if (x?.type === 'click') {
              this.setValue(x.lngLat);
            }
          });
        }
      }

      if ((p as any).readonly) {
        this.textCtrl.disable();
      }

      // Add the marker to the injection store for display
      if (this.dbxMapboxInjectionStore) {
        if (p.markerConfig != null) {
          this._markerConfig.next(p.markerConfig === false ? of(false) : asObservableFromGetter(p.markerConfig, this));
        }

        this.dbxMapboxInjectionStore.addInjectionConfig({
          key: p.mapInjectionKey || DEFAULT_DBX_FORGE_MAPBOX_LAT_LNG_FIELD_INJECTION_KEY,
          injectionConfig: {
            componentClass: DbxForgeMapboxLatLngFieldMarkerComponent,
            providers: [{ provide: DbxForgeMapboxLatLngFieldComponent, useValue: this }]
          }
        });
      }
    });

    // Sync field value → text control (inbound)
    effect(() => {
      const value = this.fieldValue();

      if (!this._syncing) {
        this._syncing = true;
        this.textCtrl.setValue((value as string) ?? '', { emitEvent: false });
        this._syncing = false;
      }
    });

    // Sync text control → field value (outbound)
    this.textCtrl.valueChanges.subscribe((textValue) => {
      if (!this._syncing) {
        this._syncing = true;
        this._setFieldValue(textValue || null);
        this._syncing = false;
      }
    });
  }

  ngOnDestroy(): void {
    this._zoom.complete();
    this._markerConfig.complete();
    this._useCurrentLocationDisabled.complete();
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
    const stringValue = latLng ? this._latLngStringFunction(latLng) : null;
    this._syncing = true;
    this.textCtrl.setValue(stringValue as string, { emitEvent: false });
    this._setFieldValue(stringValue);
    this._syncing = false;
  }
}

/**
 * Custom mapper for the forge mapbox lat/lng field.
 */
export function mapboxLatLngFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.(), defaultValidationMessages?.());
  });
}
