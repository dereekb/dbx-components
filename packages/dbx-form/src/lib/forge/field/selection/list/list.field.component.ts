import { ChangeDetectionStrategy, Component, computed, effect, input, type OnDestroy, type OnInit, type Signal, type Type } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { type Maybe, type PrimativeKey, type ReadKeyFunction, readKeysFrom, convertMaybeToArray, hasDifferentValues } from '@dereekb/util';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { SubscriptionObject, type ListLoadingState, switchMapFilterMaybe, distinctUntilHasDifferentValues } from '@dereekb/rxjs';
import { type AbstractDbxSelectionListWrapperDirective, type ListSelectionState, type DbxValueListItemDecisionFunction, dbxValueListItemDecisionFunction, DbxListModifierModule } from '@dereekb/dbx-web';
import { BehaviorSubject, map, type Observable, shareReplay } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { type FieldTree } from '@angular/forms/signals';
import { type DynamicText, type FieldMeta, type ValidationMessages, type BaseValueField } from '@ng-forge/dynamic-forms';
import { isSelectedDecisionFunctionFactory } from '@dereekb/util';
import { forgeFieldDisabled } from '../../field.disabled';

// MARK: Props
/**
 * Props interface for the forge list selection field.
 *
 * Passed via the `props` property on the forge field definition.
 */
export interface DbxForgeListSelectionFieldProps<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> {
  /**
   * List component class to render items from. Can be provided as an Observable for lazy loading.
   */
  readonly listComponentClass: Observable<Type<C>>;
  /**
   * Read key function to extract the identifier from each item.
   */
  readonly readKey: ReadKeyFunction<T, K>;
  /**
   * Observable that provides the items to select.
   */
  readonly state$: Observable<ListLoadingState<T>>;
  /**
   * Function that signals to load more items.
   */
  readonly loadMore?: () => void;
  /**
   * Hint text shown below the field.
   */
  readonly hint?: string;
}

/**
 * The custom forge field type name for the list selection field.
 */
export const FORGE_LIST_SELECTION_FIELD_TYPE = 'dbx-list-selection' as const;

/**
 * Forge field definition interface for the list selection field.
 */
export interface DbxForgeListSelectionFieldDef<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> extends BaseValueField<DbxForgeListSelectionFieldProps<T, C, K>, K[]> {
  readonly type: typeof FORGE_LIST_SELECTION_FIELD_TYPE;
}

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
export class DbxForgeListSelectionFieldComponent<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> implements OnInit, OnDestroy {
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
  readonly isDisabled = forgeFieldDisabled();

  private readonly _selectionEventSub = new SubscriptionObject();
  private readonly _loadMoreSub = new SubscriptionObject();
  private readonly _listComponentClassObs = new BehaviorSubject<Maybe<Observable<Type<C>>>>(undefined);
  private readonly _valuesSubject = new BehaviorSubject<K[]>([]);

  readonly labelSignal = computed(() => {
    const l = this.label();
    return typeof l === 'string' ? l : undefined;
  });

  readonly hintSignal = computed(() => this.props()?.hint);

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

  // Sync field value to _valuesSubject
  private readonly _syncFieldValueEffect = effect(() => {
    const fieldGetter = this.field();
    if (!fieldGetter) return;

    const fieldState = typeof fieldGetter === 'function' ? (fieldGetter as any)() : undefined;
    const fieldValue = fieldState?.value?.() as Maybe<K[]>;
    const values = fieldValue != null ? convertMaybeToArray(fieldValue) : [];
    this._valuesSubject.next(values);
  });

  ngOnInit(): void {
    const p = this.props();
    if (p?.listComponentClass) {
      this._listComponentClassObs.next(p.listComponentClass);
    }
  }

  ngOnDestroy(): void {
    this._selectionEventSub.destroy();
    this._loadMoreSub.destroy();
    this._listComponentClassObs.complete();
    this._valuesSubject.complete();
  }

  // MARK: Internal
  private _updateForSelection(list: ListSelectionState<T>): void {
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
