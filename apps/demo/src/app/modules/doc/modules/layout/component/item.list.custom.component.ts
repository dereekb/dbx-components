import { anchorTypeForAnchor, ClickableAnchor, AnchorType } from '@dereekb/dbx-core';
import { LOREM } from '../../shared/lorem';
import { Component } from '@angular/core';
import { AbstractDbxValueListViewItemComponent, DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, provideDbxListView, AbstractDbxListWrapperDirective, AbstractDbxListViewDirective, DbxValueListViewConfig } from '@dereekb/dbx-web';
import { of } from 'rxjs';
import { DocValue, DocValueWithSelection } from './item.list';

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
export class DocCustomItemListComponent extends AbstractDbxListWrapperDirective<DocValue> {
  constructor() {
    super({
      componentClass: DocCustomItemListViewComponent
    });
  }
}

@Component({
  template: `
    <dbx-list-view [config]="config"></dbx-list-view>
  `,
  providers: provideDbxListView(DocCustomItemListViewComponent)
})
export class DocCustomItemListViewComponent extends AbstractDbxListViewDirective<DocValue> {
  readonly config: DbxValueListViewConfig<DocValueWithSelection> = {
    componentClass: DocCustomItemListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: y.icon, itemValue: y })))
  };
}

@Component({
  template: `
    <div class="dbx-p3">
      <h4 class="no-margin">{{ anchorType }}</h4>
      <p>{{ name }}</p>
    </div>
  `
})
export class DocCustomItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<DocValue> {
  readonly lorem = LOREM;

  get anchorType() {
    return AnchorType[anchorTypeForAnchor(this.item.anchor)];
  }

  get name() {
    return this.itemValue.name;
  }
}
