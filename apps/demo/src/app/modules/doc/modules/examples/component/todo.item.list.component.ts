import { Component } from '@angular/core';
import { of } from 'rxjs';
import {
  AbstractDbxSelectionListWrapperDirective,
  AbstractDbxSelectionListViewDirective,
  AbstractDbxValueListViewItemComponent,
  type DbxSelectionValueListViewConfig,
  provideDbxListView,
  DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  DbxListWrapperComponentImportsModule,
  DbxSelectionValueListViewComponentImportsModule,
  DbxListViewMetaIconComponent,
  DbxChipDirective,
  DbxColorDirective,
  DbxIconTileComponent
} from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { type TodoItemChip, type TodoItemValue, type TodoItemValueWithSelection } from './todo.item.list';

/**
 * Demo wrapper that renders {@link TodoItemValue} items as `.dbx-list-detail-item`
 * rows: a round icon tile and the to do's title + detail line (plus an
 * optional chip). The trailing slot is left empty — the built-in chevron is
 * the only trailing affordance.
 *
 * Unlike the schedule list, the whole row is the click target — the view keeps
 * each item's `anchor`, so the list's default hover state layer and ripple stay
 * on, and the view's `metaConfig` adds the built-in chevron to every row.
 * Project `<dbx-list-empty-content empty>` for the "all caught up" state.
 */
@Component({
  selector: 'doc-todo-item-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  host: {
    class: 'dbx-list-auto-height'
  }
})
export class DocTodoItemListComponent extends AbstractDbxSelectionListWrapperDirective<TodoItemValue> {
  constructor() {
    super({
      componentClass: DocTodoItemListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'doc-todo-item-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  providers: provideDbxListView(DocTodoItemListViewComponent),
  host: {
    class: 'dbx-list-item-p0'
  }
})
export class DocTodoItemListViewComponent extends AbstractDbxSelectionListViewDirective<TodoItemValue> {
  // Drop `icon` (template paints its own tile); keep `anchor` so the whole row is the click target.
  readonly config: DbxSelectionValueListViewConfig<TodoItemValueWithSelection> = {
    componentClass: DocTodoItemListViewItemComponent,
    metaConfig: DbxListViewMetaIconComponent.metaConfig('chevron_right'),
    mapValuesToItemValues: (values) => of(values.map((value) => ({ ...value, itemValue: value, icon: undefined })))
  };
}

@Component({
  selector: 'doc-todo-item-list-view-item',
  template: `
    <div class="dbx-list-detail-item" [class.dbx-list-detail-item-highlight]="highlight">
      <dbx-icon-tile class="item-leading" [icon]="icon" [round]="true" [dbxColor]="highlight ? 'notice' : 'grey'" [dbxColorTone]="18"></dbx-icon-tile>
      <div class="item-content">
        <span class="item-title">{{ title }}</span>
        <span class="item-line">{{ detail }}</span>
        @if (chip; as chip) {
          <span class="item-line dbx-pt1">
            <dbx-chip [color]="chip.color" [small]="true">{{ chip.text }}</dbx-chip>
          </span>
        }
      </div>
    </div>
  `,
  imports: [DbxChipDirective, DbxColorDirective, DbxIconTileComponent]
})
export class DocTodoItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<TodoItemValue> {
  get icon(): string {
    return this.itemValue.icon;
  }

  get title(): string {
    return this.itemValue.title;
  }

  get detail(): string {
    return this.itemValue.detail;
  }

  get chip(): Maybe<TodoItemChip> {
    return this.itemValue.chip;
  }

  get highlight(): boolean {
    return this.itemValue.highlight === true;
  }
}
