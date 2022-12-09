import { ClickableAnchor, safeDetectChanges } from '@dereekb/dbx-core';
import { listItemModifier, ListItemModifier, ListSelectionState, AnchorForValueFunction, DbxValueListGridItemViewGridSizeConfig, DbxListSelectionMode, DbxValueListItemDecisionFunction, dbxValueListItemDecisionFunction } from '@dereekb/dbx-web';
import { CustomDocValue } from './../component/item.list.custom.component';
import { ListLoadingState, mapLoadingStateResults, successResult } from '@dereekb/rxjs';
import { BehaviorSubject, map, switchMap, startWith, Observable, delay, of } from 'rxjs';
import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { DocValue, DocValueWithSelection, makeDocValues } from '../component/item.list';
import { Maybe, range, takeFront } from '@dereekb/util';

@Component({
  templateUrl: './list.component.html'
})
export class DocLayoutListComponent implements OnInit, OnDestroy {
  readonly numberToLoadPerUpdate = 50;

  clickedItem?: CustomDocValue;
  clickedItemPlain?: CustomDocValue;

  selectionState?: ListSelectionState<DocValue>;

  private _values = new BehaviorSubject<DocValue[]>([]);
  private _selectionMode = new BehaviorSubject<Maybe<DbxListSelectionMode>>(undefined);

  readonly selectionMode$ = this._selectionMode.asObservable();

  readonly state$: Observable<ListLoadingState<DocValue>> = this._values.pipe(
    switchMap((x) => {
      return of(successResult(x)).pipe(delay(Math.random() * 500 + 500), startWith<ListLoadingState<DocValue>>({ loading: true, value: takeFront(x, x.length - this.numberToLoadPerUpdate) }));
    })
  );

  readonly stateWithSelection$: Observable<ListLoadingState<DocValueWithSelection>> = this.state$.pipe(
    map((x) =>
      mapLoadingStateResults<DocValue[], DocValueWithSelection[]>(x, {
        mapValue: (values) =>
          values.map((x: DocValue) => {
            const item: DocValueWithSelection = { ...x, selected: Math.random() > 0.5, disabled: Math.random() > 0.8 };
            return item;
          })
      })
    )
  );

  readonly stateWithAnchors$: Observable<ListLoadingState<CustomDocValue>> = this.state$.pipe(
    map((x) =>
      mapLoadingStateResults<DocValue[], CustomDocValue[]>(x, {
        mapValue: (values) =>
          values.map((x, i) => {
            const n = i % 4;
            let anchor: Maybe<ClickableAnchor>;
            const disabled = Math.random() > 0.5;

            if (n === 0) {
              // only plain anchors pass through their clicks to item clicked.
              anchor = {};
            } else if (n === 1) {
              anchor = {
                onClick: () => {
                  this.clickedItem = x;
                  safeDetectChanges(this.cdRef);
                }
              };
            } else if (n === 2) {
              anchor = {
                ref: '.',
                target: '_'
              };
            } else {
              anchor = {
                url: 'https://github.com/dereekb/dbx-components',
                target: '_'
              };
            }

            return { ...x, disabled, anchor };
          })
      })
    )
  );

  readonly staticState$: Observable<ListLoadingState<DocValue>> = of(successResult(this.makeValues()));

  readonly count$ = this.state$.pipe(map((x) => x.value?.length ?? 0));

  clickedModifiedAnchorItem?: CustomDocValue;

  readonly inputDbxListItemModifier: ListItemModifier<CustomDocValue> = listItemModifier('test', (item) => {
    item.anchor = {
      onClick: () => {
        this.clickedModifiedAnchorItem = item.itemValue;
        safeDetectChanges(this.cdRef);
      }
    };
  });

  makeClickAnchor: AnchorForValueFunction<CustomDocValue> = (itemValue) => {
    return {
      onClick: () => {
        this.clickedModifiedAnchorItem = itemValue;
        safeDetectChanges(this.cdRef);
      }
    };
  };

  readonly isSelectedModifierFunction: DbxValueListItemDecisionFunction<DocValue> = dbxValueListItemDecisionFunction((value: DocValue) => {
    return true; // all are selected.
  });

  readonly customGridSize: Partial<DbxValueListGridItemViewGridSizeConfig> = {
    columns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '25px'
  };

  constructor(readonly cdRef: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadMore();
  }

  ngOnDestroy(): void {
    this._values.complete();
    this._selectionMode.complete();
  }

  loadMore() {
    this._values.next(this._values.value.concat(this.makeValues()));
  }

  setSelectionMode(selectionMode: DbxListSelectionMode) {
    this._selectionMode.next(selectionMode);
  }

  onSelectionChange(event: ListSelectionState<DocValue>) {
    this.selectionState = event;
  }

  onPlainClick(value: CustomDocValue) {
    this.clickedItemPlain = value;
  }

  makeValues() {
    return makeDocValues(this.numberToLoadPerUpdate);
  }

  disableAllRipples = () => true;
}
