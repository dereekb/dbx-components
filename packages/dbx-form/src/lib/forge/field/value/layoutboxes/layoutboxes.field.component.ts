import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import type { FieldTree } from '@angular/forms/signals';
import type { DynamicText, FieldMeta, ValidationMessages } from '@ng-forge/dynamic-forms';
import { setupMetaTracking } from '@ng-forge/dynamic-forms/integration';
import { maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { map } from 'rxjs';
import { type DbxForgeLayoutBoxesFieldProps } from './layoutboxes.field';
import { dbxForgeFieldDisabled } from '../../field.util';
import { type DbxLayoutBoxesCanvasSize, type DbxLayoutBoxesValue } from '../../../../field/value/layoutboxes/layoutboxes';
import { type DbxLayoutBoxesComponentConfig, DbxLayoutBoxesComponent } from '../../../../field/value/layoutboxes/layoutboxes.component';

/**
 * Forge ValueFieldComponent for the layout boxes field.
 *
 * Bridges the Signal Forms field tree with {@link DbxLayoutBoxesComponent}: the field value is passed in, and every edit
 * is written back whole. A readonly field, a disabled field and a disabled form all show the editor readonly.
 *
 * Registered as ng-forge type 'dbx-layout-boxes'.
 */
@Component({
  selector: 'dbx-forge-layout-boxes-field',
  template: `
    <dbx-layout-boxes [config]="configSignal()" [canvas]="canvasSignal()" [imageUrl]="imageUrlSignal()" [readonly]="readonlySignal()" [value]="valueSignal()" (valueChange)="setValue($event)"></dbx-layout-boxes>
  `,
  imports: [DbxLayoutBoxesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dbx-forge-layout-boxes-field'
  }
})
export class DbxForgeLayoutBoxesFieldComponent<T = unknown> {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<DbxLayoutBoxesValue<T>>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<DbxForgeLayoutBoxesFieldProps<T> | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  private readonly _isFormDisabled = dbxForgeFieldDisabled();

  /**
   * True when the form is disabled, or the field is disabled or readonly.
   */
  readonly readonlySignal: Signal<boolean> = computed(() => {
    const state = this.field()();
    return this._isFormDisabled() || state.disabled() || state.readonly();
  });

  readonly valueSignal: Signal<DbxLayoutBoxesValue<T>> = computed(() => {
    const value = this.field()().value() as unknown;
    return Array.isArray(value) ? (value as DbxLayoutBoxesValue<T>) : [];
  });

  /**
   * The editor config. The prop references pass straight through, so the rows are not rebuilt.
   */
  readonly configSignal: Signal<DbxLayoutBoxesComponentConfig<T>> = computed(() => {
    const props = this.props();

    return {
      item: props?.item,
      itemStyle: props?.itemStyle,
      addOptions: props?.addOptions,
      cap: props?.cap,
      listPosition: props?.listPosition
    };
  });

  private readonly _props$ = toObservable(this.props);

  readonly canvasSignal: Signal<Maybe<DbxLayoutBoxesCanvasSize>> = toSignal(
    this._props$.pipe(
      map((props) => props?.canvas),
      maybeValueFromObservableOrValue()
    )
  );

  readonly imageUrlSignal: Signal<Maybe<string>> = toSignal(
    this._props$.pipe(
      map((props) => props?.imageUrl),
      maybeValueFromObservableOrValue()
    )
  );

  constructor() {
    setupMetaTracking(this.elementRef, this.meta, { selector: 'dbx-layout-boxes' });
  }

  /**
   * Writes the editor's value to the field. Never writes `undefined`.
   *
   * @param value - The next value.
   */
  setValue(value: Maybe<DbxLayoutBoxesValue<T>>): void {
    const state = this.field()();
    state.value.set([...(value ?? [])]);
    state.markAsTouched();
    state.markAsDirty();
  }
}
