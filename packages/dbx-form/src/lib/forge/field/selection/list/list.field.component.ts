import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, type OnInit, type Type } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { type Maybe, type PrimativeKey, readKeysFrom, convertMaybeToArray, hasDifferentValues, isSelectedDecisionFunctionFactory } from '@dereekb/util';
import { DbxInjectionComponent, type DbxInjectionComponentConfig, cleanSubscription, completeOnDestroy } from '@dereekb/dbx-core';
import { switchMapFilterMaybe, distinctUntilHasDifferentValues } from '@dereekb/rxjs';
import { type AbstractDbxSelectionListWrapperDirective, type ListSelectionState, type DbxValueListItemDecisionFunction, dbxValueListItemDecisionFunction, DbxListModifierModule } from '@dereekb/dbx-web';
import { BehaviorSubject, map, type Observable, shareReplay } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { type FieldTree } from '@angular/forms/signals';
import { type DynamicText, type FieldMeta, type ValidationMessages } from '@ng-forge/dynamic-forms';
import { createResolvedErrorsSignal, setupMetaTracking, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { type DbxForgeListSelectionFieldProps } from './list.field';
import { dbxForgeFieldDisabled } from '../../field.util';

// MARK: List Selection Field Component
/**
 * Forge ValueFieldComponent for list-based selection.
 *
 * Renders items via a custom {@link AbstractDbxSelectionListWrapperDirective} component
 * and tracks selected items by key. Bridges the FieldTree signal form model
 * with the dbx-web list selection infrastructure.
 */
@Component({
  selector: 'dbx-forge-list-selection-field',
  templateUrl: './list.field.component.html',
  imports: [DbxListModifierModule, DbxInjectionComponent, MatDividerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeListSelectionFieldComponent<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> implements OnInit {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<K[]>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<DbxForgeListSelectionFieldProps<T, C, K> | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  // Disabled state
  readonly isDisabled = dbxForgeFieldDisabled();
  readonly isDisabled$ = toObservable(this.isDisabled);

  private readonly _selectionEventSub = cleanSubscription();
  private readonly _loadMoreSub = cleanSubscription();
  private readonly _listComponentClassObs = completeOnDestroy(new BehaviorSubject<Maybe<Observable<Type<C>>>>(undefined));
  private readonly _valuesSubject = completeOnDestroy(new BehaviorSubject<K[]>([]));

  readonly labelSignal = computed(() => {
    const l = this.label();
    return typeof l === 'string' ? l : undefined;
  });

  readonly hintSignal = computed(() => this.props()?.hint);

  // Error handling
  readonly resolvedErrors = createResolvedErrorsSignal(this.field as any, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field as any);
  readonly errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []));

  // ARIA
  protected readonly hintId = computed(() => `${this.key()}-hint`);
  protected readonly errorId = computed(() => `${this.key()}-error`);
  protected readonly ariaInvalid = computed(() => (this.showErrors() ? 'true' : null));
  protected readonly ariaDescribedBy = computed(() => {
    if (this.errorsToDisplay().length > 0) return this.errorId();
    if (this.props()?.hint) return this.hintId();
    return null;
  });

  readonly listComponentClass$ = this._listComponentClassObs.pipe(switchMapFilterMaybe());

  readonly config$: Observable<DbxInjectionComponentConfig<C>> = this.listComponentClass$.pipe(
    map((componentClass) => {
      const p = this.props();
      const loadMore = p?.loadMore;
      const state$ = p?.state$;

      const config: DbxInjectionComponentConfig<C> = {
        componentClass,
        init: (listView) => {
          listView.setSelectionMode('select');
          listView.setDisabled(this.isDisabled$);

          if (state$) {
            listView.setState(state$);
          }

          if (loadMore != null) {
            this._loadMoreSub.subscription = listView.loadMore.subscribe(() => loadMore());
          }

          this._selectionEventSub.subscription = listView.selectionChange.subscribe((x: ListSelectionState<T>) => this._updateForSelection(x));
        }
      };

      return config;
    })
  );

  readonly values$: Observable<K[]> = this._valuesSubject.asObservable().pipe(shareReplay(1));

  readonly isSelectedModifierFunction$: Observable<DbxValueListItemDecisionFunction<T>> = this.values$.pipe(
    distinctUntilHasDifferentValues<K[], K>(),
    map((values: K[]) => {
      const p = this.props();
      const readKey = p?.readKey;

      if (!readKey) {
        return dbxValueListItemDecisionFunction(() => false);
      }

      return dbxValueListItemDecisionFunction(isSelectedDecisionFunctionFactory<T, K>({ readKey })(values));
    }),
    shareReplay(1)
  );

  readonly configSignal = toSignal(this.config$);
  readonly isSelectedModifierFunctionSignal = toSignal(this.isSelectedModifierFunction$);

  constructor() {
    setupMetaTracking(this.elementRef, this.meta as any, { selector: 'dbx-injection' });

    // Sync field value to _valuesSubject
    effect(() => {
      const fieldGetter = this.field();
      if (!fieldGetter) return;

      const fieldState = typeof fieldGetter === 'function' ? (fieldGetter as any)() : undefined;
      const fieldValue = fieldState?.value?.() as Maybe<K[]>;
      const values = fieldValue != null ? convertMaybeToArray(fieldValue) : [];
      this._valuesSubject.next(values);
    });
  }

  ngOnInit(): void {
    const p = this.props();
    if (p?.listComponentClass) {
      this._listComponentClassObs.next(p.listComponentClass);
    }
  }

  // MARK: Internal
  private _updateForSelection(list: ListSelectionState<T>): void {
    if (this.isDisabled()) return;

    const p = this.props();
    const readKey = p?.readKey;

    if (!readKey) return;

    const items = list.items.filter((x) => x.selected).map((x) => x.itemValue);
    const values = readKeysFrom(readKey, items);
    this._setValues(values);
  }

  private _setValues(values: Maybe<K[]>): void {
    const currentValues = this._valuesSubject.getValue();

    if (currentValues == null || hasDifferentValues(currentValues, values)) {
      this._valuesSubject.next(values ?? []);
      this._setFieldValue(values ?? []);
    }
  }

  private _setFieldValue(values: K[]): void {
    const fieldGetter = this.field();
    if (!fieldGetter || typeof fieldGetter !== 'function') return;

    const fieldState = (fieldGetter as any)();
    if (fieldState?.value?.set) {
      fieldState.value.set(values);
    }
  }
}
