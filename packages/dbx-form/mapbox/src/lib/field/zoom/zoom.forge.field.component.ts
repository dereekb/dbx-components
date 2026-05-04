import { CompactContextStore, mapCompactModeObs } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, Component, type OnDestroy, computed, effect, ElementRef, inject, input, type InputSignal, type Signal } from '@angular/core';
import { BehaviorSubject, shareReplay, type Observable } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';
import { type ZoomLevel, type Maybe, type LatLngPoint, latLngPoint } from '@dereekb/util';
import { DbxMapboxService, DbxMapboxMapStore, type MapboxZoomLevel, provideMapboxStoreIfParentIsUnavailable, mapboxZoomLevel, MAPBOX_MAX_ZOOM_LEVEL, MAPBOX_MIN_ZOOM_LEVEL, DbxMapboxModule } from '@dereekb/dbx-web/mapbox';
import { NgClass } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import type { FieldTree } from '@angular/forms/signals';
import { type DynamicText, type FieldMeta, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs, setupMetaTracking } from '@ng-forge/dynamic-forms/integration';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { completeOnDestroy, cleanSubscription } from '@dereekb/dbx-core';

/**
 * Custom props for the forge mapbox zoom field.
 */
export interface DbxForgeMapboxZoomFieldComponentProps {
  readonly label?: string;
  readonly description?: string;
  readonly showMap?: boolean;
  readonly center?: LatLngPoint;
  readonly lockMapToZoomLevels?: boolean;
  readonly minZoom?: MapboxZoomLevel;
  readonly maxZoom?: MapboxZoomLevel;
  readonly zoomStep?: number;
}

/**
 * Forge custom field component for Mapbox zoom level picking.
 *
 * This is the forge equivalent of {@link DbxFormMapboxZoomFieldComponent}.
 * It bridges ng-forge Signal Forms with the Mapbox map store.
 *
 * Registered as ng-forge type 'dbx-forge-mapbox-zoom'.
 */
@Component({
  selector: 'dbx-forge-mapbox-zoom-field',
  template: `
    <div class="dbx-mapbox-input-field" [ngClass]="compactClassSignal()">
      @if (showMapSignal()) {
        <div class="dbx-mapbox-input-field-map">
          <mgl-map dbxMapboxMap></mgl-map>
        </div>
      }
      <div class="dbx-mapbox-input-field-input">
        <mat-form-field class="dbx-mapbox-input-field-input-field">
          <mat-label>Zoom Level</mat-label>
          <input type="number" matInput [min]="minZoomSignal()" [max]="maxZoomSignal()" [step]="zoomStepSignal()" [placeholder]="placeholderText" [formControl]="numberCtrl" />
        </mat-form-field>
      </div>
    </div>
  `,
  providers: [provideMapboxStoreIfParentIsUnavailable()],
  styleUrls: ['../mapbox.field.component.scss'],
  imports: [NgClass, DbxMapboxModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeMapboxZoomFieldComponent implements OnDestroy {
  readonly compact = inject(CompactContextStore, { optional: true });
  readonly dbxMapboxService = inject(DbxMapboxService);
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  // Standard ng-forge value field inputs
  readonly field: InputSignal<FieldTree<unknown>> = input.required<FieldTree<unknown>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<DbxForgeMapboxZoomFieldComponentProps | undefined> = input<DbxForgeMapboxZoomFieldComponentProps | undefined>();
  readonly meta: InputSignal<FieldMeta | undefined> = input<FieldMeta | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  // Internal number form control for the zoom input
  readonly numberCtrl = new FormControl<number | null>(null);
  readonly placeholderText = '';

  private _undoZoomLimit = false;

  readonly compactClass$ = mapCompactModeObs(this.compact?.mode$, {
    compact: 'dbx-mapbox-input-field-compact'
  }).pipe(filterMaybe());

  readonly compactClassSignal = toSignal(this.compactClass$, { initialValue: '' });

  // Subscription management
  private readonly _sub = cleanSubscription();
  private readonly _center = completeOnDestroy(new BehaviorSubject<Maybe<LatLngPoint>>(undefined));

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

  // Computed props
  readonly showMapSignal = computed(() => this.props()?.showMap ?? true);
  readonly lockMapToZoomLevelsSignal = computed(() => this.props()?.lockMapToZoomLevels ?? false);
  readonly minZoomSignal = computed(() => mapboxZoomLevel(this.props()?.minZoom || MAPBOX_MIN_ZOOM_LEVEL));
  readonly maxZoomSignal = computed(() => mapboxZoomLevel(this.props()?.maxZoom || MAPBOX_MAX_ZOOM_LEVEL));
  readonly zoomStepSignal = computed(() => mapboxZoomLevel(this.props()?.zoomStep || 1));

  readonly fieldValue$ = toObservable(this.fieldValue);
  readonly zoom$ = this.fieldValue$.pipe(filterMaybe(), shareReplay(1)) as unknown as Observable<MapboxZoomLevel>;
  readonly center$ = this._center.pipe(filterMaybe());

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
    setupMetaTracking(this.elementRef, this.meta as any, { selector: 'input' });

    // Initialize on first props emission
    effect(() => {
      const p = this.props();
      if (!p) {
        return;
      }

      const center = p.center || latLngPoint(this.dbxMapboxService.defaultCenter);
      this._center.next(center);

      this.dbxMapboxMapStore.setZoom(this.zoom$);

      if (p.showMap ?? true) {
        this.dbxMapboxMapStore.setCenter(this.center$);
      }

      if ((p as any)?.readonly) {
        this.numberCtrl.disable();

        if (p.showMap ?? true) {
          this.dbxMapboxMapStore.setZoomDisabled();
        }
      } else if (p.lockMapToZoomLevels) {
        const min = mapboxZoomLevel(p.minZoom || MAPBOX_MIN_ZOOM_LEVEL);
        const max = mapboxZoomLevel(p.maxZoom || MAPBOX_MAX_ZOOM_LEVEL);
        this.dbxMapboxMapStore.setZoomRange({ min, max });
        this._undoZoomLimit = !(p.showMap ?? true);
      }

      this._sub.subscription = this.dbxMapboxMapStore.zoom$.subscribe((zoom) => {
        if (!this.isReadonlyOrDisabledSignal()) {
          this.setZoomValue(zoom);
        }
      });
    });

    // Sync field value → number control (inbound)
    effect(() => {
      const value = this.fieldValue();

      if (!this._syncing) {
        this._syncing = true;
        this.numberCtrl.setValue((value as number) ?? null, { emitEvent: false });
        this._syncing = false;
      }
    });

    // Sync number control → field value (outbound)
    this.numberCtrl.valueChanges.subscribe((numValue) => {
      if (!this._syncing) {
        this._syncing = true;
        this._setFieldValue(numValue ?? null);
        this._syncing = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (!this._undoZoomLimit) {
      this.dbxMapboxMapStore.setZoomRange({});
    }
  }

  setZoomValue(zoom?: Maybe<ZoomLevel>) {
    this._syncing = true;
    this.numberCtrl.setValue((zoom as number) ?? null, { emitEvent: false });
    this._setFieldValue(zoom ?? null);
    this._syncing = false;
  }
}

/**
 * Custom mapper for the forge mapbox zoom field.
 *
 * @param fieldDef - Field definition configuration
 * @param fieldDef.key - Form model key for the field
 * @returns Signal containing a Record of input names to values for ngComponentOutlet
 */
export function mapboxZoomFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    return buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.(), defaultValidationMessages?.());
  });
}
