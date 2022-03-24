import { anchorTypeForAnchor, ClickableAnchor, AnchorType } from '@dereekb/dbx-core';
import { LOREM } from '../../shared/lorem';
import { Component } from "@angular/core";
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxSelectionValueListViewItemComponent, AbstractSelectionValueListViewDirective, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, DbxSelectionValueListViewConfig, ProvideDbxListView } from "@dereekb/dbx-web";
import { of } from "rxjs";
import { DocValue, DocValueWithSelection } from "./item.list";

export interface CustomDocValue extends DocValue {
  anchor?: ClickableAnchor;
}

/**
 * Demo DbxSelectionListWrapperDirective
 */
@Component({
  selector: 'doc-custom-item-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE
})
export class DocCustomItemListComponent extends AbstractDbxSelectionListWrapperDirective<DocValue> {

  constructor() {
    super({
      componentClass: DocCustomItemListViewComponent
    });
  }

}

@Component({
  template: `<dbx-list-view [config]="config"></dbx-list-view>`,
  providers: ProvideDbxListView(DocCustomItemListViewComponent)
})
export class DocCustomItemListViewComponent extends AbstractSelectionValueListViewDirective<DocValue> {

  readonly config: DbxSelectionValueListViewConfig<DocValueWithSelection> = {
    componentClass: DocCustomItemListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: y.icon, value: y })))
  };

}

@Component({
  template: `
    <div class="pad-3">
      <h4 class="no-margin">{{ anchorType }}</h4>
      <p>{{ value.name }}</p>
    </div>
  `
})
export class DocCustomItemListViewItemComponent extends AbstractDbxSelectionValueListViewItemComponent<DocValue> {

  readonly lorem = LOREM;

  get anchorType() {
    return AnchorType[anchorTypeForAnchor(this.item.anchor)];
  }

}
