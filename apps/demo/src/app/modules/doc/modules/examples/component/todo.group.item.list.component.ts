import { Component } from '@angular/core';
import { of } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import {
  AbstractDbxSelectionListWrapperDirective,
  AbstractDbxSelectionListViewDirective,
  AbstractDbxValueListViewItemComponent,
  type DbxSelectionValueListViewConfig,
  type DbxThemeColor,
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
import { type TodoGroupItemValue, type TodoGroupItemValueWithSelection } from './todo.group.item.list';
import { type TodoItemChip } from './todo.item.list';

/**
 * Demo wrapper that renders {@link TodoGroupItemValue} items as grouped `.dbx-list-detail-item` rows. Pair it with
 * `[dbxListTitleGroup]` (see `TODO_GROUP_ITEM_LIST_GROUP_DELEGATE`) to split the rows into titled sections.
 *
 * Same row recipe as `DocTodoItemListComponent`: the whole row is the click target and the view's `metaConfig` adds the
 * built-in chevron as the only trailing affordance. The wrapper host adds `dbx-list-no-hover-effects`, so the rows have
 * no hover state layer. Rows carry no background; an "Action needed" row is set apart by its colored icon tile alone.
 * Project `<dbx-list-empty-content empty>` for the "all caught up" state.
 */
@Component({
  selector: 'doc-todo-group-item-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  host: {
    class: 'dbx-list-auto-height dbx-list-no-hover-effects'
  }
})
export class DocTodoGroupItemListComponent extends AbstractDbxSelectionListWrapperDirective<TodoGroupItemValue> {
  constructor() {
    super({
      componentClass: DocTodoGroupItemListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'doc-todo-group-item-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  providers: provideDbxListView(DocTodoGroupItemListViewComponent),
  host: {
    class: 'dbx-list-item-p0'
  }
})
export class DocTodoGroupItemListViewComponent extends AbstractDbxSelectionListViewDirective<TodoGroupItemValue> {
  // An item component keeps the item it was created with while its key stays the same, so key each row by its content:
  // a changed detail line (e.g. the course count) then renders a fresh row. Drop `icon` (the template paints its own
  // tile); keep `anchor` so the whole row is the click target.
  readonly config: DbxSelectionValueListViewConfig<TodoGroupItemValueWithSelection> = {
    componentClass: DocTodoGroupItemListViewItemComponent,
    metaConfig: DbxListViewMetaIconComponent.metaConfig('chevron_right'),
    mapValuesToItemValues: (values) => of(values.map((value) => ({ ...value, key: [value.id, value.title, value.detail, value.chip?.text].join('|'), itemValue: value, icon: undefined })))
  };
}

@Component({
  selector: 'doc-todo-group-item-list-view-item',
  template: `
    <div class="dbx-list-detail-item">
      <dbx-icon-tile class="item-leading" [icon]="icon" [round]="true" [dbxColor]="tileColor" [dbxColorTone]="18"></dbx-icon-tile>
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
export class DocTodoGroupItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<TodoGroupItemValue> {
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

  /**
   * Tile color of the row: an "Action needed" row's own color (notice by default), otherwise grey.
   *
   * @returns The row's tile color.
   */
  get tileColor(): DbxThemeColor {
    return this.itemValue.group === 'action_needed' ? (this.itemValue.color ?? 'notice') : 'grey';
  }
}
