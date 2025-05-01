import { ClickableAnchor, safeDetectChanges } from '@dereekb/dbx-core';
import { listItemModifier, ListItemModifier, ListSelectionState, AnchorForValueFunction, DbxValueListGridItemViewGridSizeConfig, DbxListSelectionMode, DbxValueListItemDecisionFunction, dbxValueListItemDecisionFunction, DbxListTitleGroupTitleDelegate } from '@dereekb/dbx-web';
import { CustomDocValue } from './../component/item.list.custom.component';
import { ListLoadingState, mapLoadingStateResults, successResult, beginLoading } from '@dereekb/rxjs';
import { BehaviorSubject, map, switchMap, startWith, Observable, delay, of } from 'rxjs';
import { ChangeDetectorRef, Component, OnInit, OnDestroy, inject } from '@angular/core';
import { DocValue, DocValueWithSelection, makeDocValues } from '../component/item.list';
import { Maybe, takeFront } from '@dereekb/util';
import { pascalCase } from 'change-case-all';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DbxContentDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';
import { DbxButtonSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.spacer.directive';

import { DbxValueListGridSizeDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/list/grid/list.grid.view.component';
import { DbxValueListItemModifierDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/list/modifier/list.view.value.modifier.directive';
import { DbxListItemAnchorModifierDirective } from '../../../../../../../../../packages/dbx-web/src/lib/router/layout/list/router.list.directive';
import { DbxListItemIsSelectedModifierDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/list/modifier/list.view.value.modifier.selection.directive';
import { DbxListItemDisableRippleModifierDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/list/modifier/list.view.value.modifier.ripple.directive';
import { DbxListTitleGroupDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/list/group/list.view.value.group.title.directive';
import { DbxListEmptyContentComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/list/list.content.empty.component';
import { AsyncPipe, JsonPipe } from '@angular/common';

@Component({
  templateUrl: './list.component.html',
  standalone: true,
  imports: [
    DbxContentContainerDirective,
    DbxContentDirective,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent,
    MatButton,
    DbxButtonSpacerDirective,
    DocLayoutComponentsModule,
    DocLayoutComponentsModule,
    DocLayoutComponentsModule,
    DocLayoutComponentsModule,
    DbxValueListGridSizeDirective,
    DbxValueListItemModifierDirective,
    DbxListItemAnchorModifierDirective,
    DbxListItemIsSelectedModifierDirective,
    DbxListItemDisableRippleModifierDirective,
    DbxListTitleGroupDirective,
    DbxListEmptyContentComponent,
    AsyncPipe,
    JsonPipe
  ]
})
export class DocLayoutListComponent implements OnInit, OnDestroy {
  readonly cdRef = inject(ChangeDetectorRef);

  readonly numberToLoadPerUpdate = 50;

  clickedItem?: CustomDocValue;
  clickedItemPlain?: CustomDocValue;

  selectionState?: ListSelectionState<DocValue>;

  private _values = new BehaviorSubject<DocValue[]>([]);
  private _selectionMode = new BehaviorSubject<Maybe<DbxListSelectionMode>>('view');

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

  readonly statePermanentlyLoading$: Observable<ListLoadingState<any>> = of(beginLoading() as ListLoadingState<any>);
  readonly stateWithNonEmptyResult$: Observable<ListLoadingState<DocValue>> = of(
    successResult<DocValue[]>([
      { name: 'A', icon: 'warning' },
      { name: 'B', icon: 'person' }
    ])
  );

  readonly statePermanentlyLoadingWithEmptyResult$: Observable<ListLoadingState<any>> = of({ ...successResult([]), ...beginLoading() } as ListLoadingState<any>);
  readonly statePermanentlyLoadingAfterEmptyResult$: Observable<ListLoadingState<any>> = this.statePermanentlyLoading$.pipe(startWith(successResult([])));
  readonly statePermanentlyLoadingAfterNonEmptyResult$: Observable<ListLoadingState<DocValue>> = of({
    ...successResult<DocValue[]>([
      { name: 'A', icon: 'warning' },
      { name: 'B', icon: 'person' }
    ]),
    ...beginLoading()
  } as ListLoadingState<any>);
  readonly statePermanentlyLoadingAfterEmptyResultWithEmptyValue$: Observable<ListLoadingState<any>> = this.statePermanentlyLoadingWithEmptyResult$.pipe(startWith(successResult([])));
  readonly emptyResult$: Observable<ListLoadingState<any>> = of(successResult([]));

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

  readonly dbxListTitleGroupDelegate: DbxListTitleGroupTitleDelegate<CustomDocValue, 'click' | 'ref' | 'url' | 'plain' | 'none'> = {
    groupValueForItem: (item) => {
      const anchor = item.anchor;
      if (anchor) {
        if (anchor.url) {
          return 'url';
        } else if (anchor.ref) {
          return 'ref';
        } else if (anchor.onClick) {
          return 'click';
        } else {
          return 'plain';
        }
      }

      return 'none';
    },
    dataForGroupValue: (value, items) => ({
      title: pascalCase(value) + ' Group',
      icon: value !== 'plain' ? 'group_work' : undefined,
      value,
      hint: `This is the subtitle text/"hint" for this (${value}) group. It can be configured as needed.`
    }),
    sortGroupsByData: (a, b) => {
      return a.value.localeCompare(b.value);
    }
  };

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
