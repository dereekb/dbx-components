import { AbstractControl, FormControl, FormGroup } from '@angular/forms';
import { CompactContextStore, mapCompactModeObs } from '@dereekb/dbx-web';
import { Component, OnDestroy, OnInit, Optional } from '@angular/core';
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { FieldType } from '@ngx-formly/material';
import { Editor, Validators } from 'ngx-editor';
import { first, BehaviorSubject, debounceTime, distinctUntilChanged, filter, shareReplay, startWith, switchMap, map, Observable, combineLatest, of } from 'rxjs';
import { filterMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { Maybe, latLngString, LatLngString, LatLngPoint, LatLngPointFunctionConfig, latLngPoint, LatLngStringFunction, latLngStringFunction } from '@dereekb/util';
import { isSameMinute } from 'date-fns';
import { GeolocationService } from '@ng-web-apis/geolocation';
import { Marker } from 'mapbox-gl';

export interface DbxFormMapboxLatLngComponentFieldProps extends FormlyFieldProps {
  zoom?: number;
  latLngConfig?: LatLngPointFunctionConfig;
}

@Component({
  template: `
    <div class="dbx-mapbox-latlng-field" [ngClass]="(compactClass$ | async) ?? ''" [formGroup]="formGroup">
      <div class="dbx-mapbox-latlng-field-map">
        <mgl-map [style]="'mapbox://styles/mapbox/streets-v9'" [zoom]="(zoom$ | async) || [8]" [center]="center$ | async">
          <mgl-marker [lngLat]="latLng$ | async" [draggable]="!isReadonlyOrDisabled" (markerDragEnd)="onDragEnd($event)"></mgl-marker>
        </mgl-map>
      </div>
      <div class="dbx-mapbox-latlng-field-input">
        <button mat-icon-button (click)="useCurrentLocation()" [disabled]="isReadonlyOrDisabled">
          <mat-icon>my_location</mat-icon>
        </button>
        <mat-form-field class="dbx-mapbox-latlng-field-input-field">
          <mat-label>Coordinates</mat-label>
          <input type="text" matInput [placeholder]="placeholder" [formControl]="formControl" />
        </mat-form-field>
      </div>
    </div>
  `,
  styleUrls: ['./latlng.field.component.scss']
})
export class DbxFormMapboxLatLngFieldComponent<T extends DbxFormMapboxLatLngComponentFieldProps = DbxFormMapboxLatLngComponentFieldProps> extends FieldType<FieldTypeConfig<T>> implements OnInit, OnDestroy {
  private _latLngStringFunction!: LatLngStringFunction;

  readonly compactClass$ = mapCompactModeObs(this.compact?.mode$, {
    compact: 'dbx-texteditor-field-compact'
  });

  private _sub = new SubscriptionObject();
  private _zoom = new BehaviorSubject<[number]>([12]);

  private _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  readonly value$ = this.formControl$.pipe(
    switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
    shareReplay(1)
  );

  readonly latLng$: Observable<LatLngPoint> = this.value$.pipe(
    filterMaybe(),
    map((x) => latLngPoint(x)),
    filter((x) => x.lat !== 0 && x.lng !== 0),
    shareReplay(1)
  );

  readonly center$ = this.latLng$;
  readonly zoom$ = this._zoom.asObservable();

  constructor(@Optional() readonly compact: CompactContextStore, private readonly geolocation$: GeolocationService) {
    super();
  }

  get zoom(): [number] {
    return [Math.min(this.field.props.zoom || 12, 18)];
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

  ngOnInit(): void {
    this._latLngStringFunction = latLngStringFunction(this.field.props.latLngConfig);
    this._formControlObs.next(this.formControl);
    this._zoom.next(this.zoom);

    if (this.props.readonly) {
      this.formControl.disable();
    }
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._formControlObs.complete();
    this._zoom.complete();
    this._sub.destroy();
  }

  useCurrentLocation() {
    this._sub.subscription = this.geolocation$.pipe(first()).subscribe((position) => {
      if (position) {
        const { latitude: lat, longitude: lng } = position.coords;
        this.setValue({ lat, lng });
      }
    });
  }

  onDragEnd(marker: Marker) {
    this.setValue(marker.getLngLat());
  }

  setValue(latLng?: Maybe<LatLngPoint>) {
    this.formControl.setValue(latLng ? this._latLngStringFunction(latLng) : latLng);
  }
}
