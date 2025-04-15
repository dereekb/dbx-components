import { Component, OnDestroy, OnInit, Type } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { AbstractDbxSelectionListWrapperDirective, ListSelectionState, DbxValueListItemDecisionFunction, dbxValueListItemDecisionFunction } from '@dereekb/dbx-web';
import { distinctUntilHasDifferentValues, filterMaybe, ListLoadingState, SubscriptionObject, switchMapFilterMaybe } from '@dereekb/rxjs';
import { convertMaybeToArray, hasDifferentValues, isSelectedDecisionFunctionFactory, Maybe, PrimativeKey, ReadKeyFunction, readKeysFrom } from '@dereekb/util';
import { FormlyFieldProps, FieldType, FieldTypeConfig } from '@ngx-formly/core';
import { map, Observable, shareReplay, BehaviorSubject, startWith, switchMap } from 'rxjs';

export interface DbxItemListFieldProps<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> extends Pick<FormlyFieldProps, 'label' | 'description'> {
  /**
   * List to render components from
   */
  readonly listComponentClass: Observable<Type<C>>;
  /**
   * Read key function to read the identifier from the input
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
}

/**
 * Used for picking items by identifier from a DbxList component.
 */
@Component({
  templateUrl: 'list.field.component.html'
})
export class DbxItemListFieldComponent<T = unknown, C extends AbstractDbxSelectionListWrapperDirective<T> = AbstractDbxSelectionListWrapperDirective<T>, K extends PrimativeKey = PrimativeKey> extends FieldType<FieldTypeConfig<DbxItemListFieldProps<T, C, K>>> implements OnInit, OnDestroy {
  private readonly _selectionEventSub = new SubscriptionObject();
  private readonly _loadMoreSub = new SubscriptionObject();

  private readonly _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  readonly _formControlValue$: Observable<Maybe<K[]>> = this.formControl$.pipe(switchMap((control) => control.valueChanges.pipe(startWith(control.value), shareReplay(1))));
  readonly values$: Observable<K[]> = this._formControlValue$.pipe(map(convertMaybeToArray), shareReplay(1));

  private readonly _listComponentClassObs = new BehaviorSubject<Maybe<Observable<Type<C>>>>(undefined);
  readonly listComponentClass$ = this._listComponentClassObs.pipe(switchMapFilterMaybe());

  readonly config$: Observable<DbxInjectionComponentConfig<C>> = this.listComponentClass$.pipe(
    map((componentClass) => {
      const loadMore = this.loadMore;
      const config: DbxInjectionComponentConfig<C> = {
        componentClass,
        init: (listView) => {
          listView.setSelectionMode('select'); // always enable select
          listView.setState(this.field.props.state$);

          if (loadMore != null) {
            this._loadMoreSub.subscription = listView.loadMore.subscribe(() => loadMore());
          }

          // set subscription
          this._selectionEventSub.subscription = listView.selectionChange.subscribe((x) => this.updateForSelection(x));
        }
      };

      return config;
    })
  );

  readonly isSelectedModifierFunction$: Observable<DbxValueListItemDecisionFunction<T>> = this.values$.pipe(
    distinctUntilHasDifferentValues(),
    map((values) => {
      return dbxValueListItemDecisionFunction(isSelectedDecisionFunctionFactory({ readKey: this.readKey })(values));
    }),
    shareReplay(1)
  );

  readonly configSignal = toSignal(this.config$);
  readonly isSelectedModifierFunctionSignal = toSignal(this.isSelectedModifierFunction$);

  get label() {
    return this.field.props.label;
  }

  get description() {
    return this.field.props.description;
  }

  get listComponentClass() {
    return this.field.props.listComponentClass;
  }

  get readKey() {
    return this.field.props.readKey;
  }

  get loadMore() {
    return this.field.props.loadMore;
  }

  ngOnInit(): void {
    this._formControlObs.next(this.formControl);
    this._listComponentClassObs.next(this.listComponentClass);
  }

  ngOnDestroy(): void {
    this._formControlObs.complete();
    this._selectionEventSub.destroy();
    this._listComponentClassObs.complete();
  }

  updateForSelection(list: ListSelectionState<T>) {
    const items = list.items.filter((x) => x.selected).map((x) => x.itemValue);
    const values = readKeysFrom(this.readKey, items);
    this.setValues(values);
  }

  setValues(values: Maybe<K[]>): void {
    const currentValues = this.formControl.value;

    if (currentValues == null || hasDifferentValues(currentValues, values)) {
      this.formControl.setValue(values);
      this.formControl.markAsDirty();
      this.formControl.markAsTouched();
    }
  }
}
