import { anchorTypeForAnchor, ClickableAnchor } from '@dereekb/dbx-core';
import { LOREM } from '../../shared/lorem';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDbxValueListViewItemComponent, provideDbxListView, AbstractDbxListWrapperDirective, AbstractDbxListViewDirective, DbxValueListViewConfig, DbxListViewMetaIconComponent, DbxListWrapperComponentImportsModule, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DEFAULT_DBX_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxValueListViewComponentImportsModule } from '@dereekb/dbx-web';
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
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocCustomItemListComponent extends AbstractDbxListWrapperDirective<DocValue> {
  constructor() {
    super({
      componentClass: DocCustomItemListViewComponent
    });
  }
}

@Component({
  template: DEFAULT_DBX_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxValueListViewComponentImportsModule],
  providers: provideDbxListView(DocCustomItemListViewComponent),
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocCustomItemListViewComponent extends AbstractDbxListViewDirective<DocValue> {
  readonly config: DbxValueListViewConfig<DocValueWithSelection> = {
    componentClass: DocCustomItemListViewItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, icon: y.icon, itemValue: y }))),
    metaConfig: DbxListViewMetaIconComponent.metaConfig('chevron_right')
  };
}

@Component({
  template: `
    <div class="dbx-p3">
      <h4 class="no-margin">{{ anchorType }}</h4>
      <p>{{ name }}</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocCustomItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<DocValue> {
  readonly lorem = LOREM;

  get anchorType() {
    return anchorTypeForAnchor(this.item.anchor);
  }

  get name() {
    return this.itemValue.name;
  }
}
