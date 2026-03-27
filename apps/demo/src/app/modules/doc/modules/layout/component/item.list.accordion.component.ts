import { LOREM } from '../../shared/lorem';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDbxListAccordionViewDirective, AbstractDbxValueListViewItemComponent, provideDbxListView, AbstractDbxListWrapperDirective, type DbxValueListAccordionViewConfig, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, DEFAULT_DBX_LIST_ACCORDION_VIEW_COMPONENT_CONFIGURATION_TEMPLATE, DbxListAccordionViewComponentImportsModule, DbxChipDirective, DbxColorDirective, DbxAccordionHeaderHeightDirective } from '@dereekb/dbx-web';
import { of } from 'rxjs';
import { type DocValue, type DocValueWithSelection } from './item.list';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelContent } from '@angular/material/expansion';

/**
 * Demo DbxListWrapperDirective for accordion view
 */
@Component({
  selector: 'doc-item-list-accordion',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocItemListAccordionComponent extends AbstractDbxListWrapperDirective<DocValue> {
  constructor() {
    super({
      componentClass: DocItemListAccordionViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'doc-item-list-accordion-view',
  template: DEFAULT_DBX_LIST_ACCORDION_VIEW_COMPONENT_CONFIGURATION_TEMPLATE,
  providers: provideDbxListView(DocItemListAccordionViewComponent),
  imports: [DbxListAccordionViewComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocItemListAccordionViewComponent extends AbstractDbxListAccordionViewDirective<DocValue> {
  readonly config: DbxValueListAccordionViewConfig<DocValueWithSelection> = {
    componentClass: DocItemListAccordionItemComponent,
    mapValuesToItemValues: (x) => of(x.map((y) => ({ ...y, itemValue: y }))),
    multi: true,
    stickyHeaders: true
  };
}

@Component({
  template: `
    <mat-expansion-panel [dbxAccordionHeaderHeight] [heightText]="name" [heightTextLineLength]="40">
      <mat-expansion-panel-header>
        <mat-panel-title>
          <div class="dbx-list-two-line-item">
            <div class="item-left">
              <span class="dbx-pb2">
                <span style="font-size: 16px">{{ name }}</span>
              </span>
              <span class="dbx-flex-bar">
                <span class="dbx-button-spacer">
                  <dbx-chip dbxColor="primary">Status</dbx-chip>
                </span>
              </span>
            </div>
          </div>
        </mat-panel-title>
      </mat-expansion-panel-header>
      <ng-template matExpansionPanelContent>
        <div class="dbx-p3">
          <h5 class="no-margin dbx-p0">{{ name }}</h5>
          <div>{{ lorem }}</div>
        </div>
      </ng-template>
    </mat-expansion-panel>
  `,
  imports: [MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelContent, DbxAccordionHeaderHeightDirective, DbxColorDirective, DbxChipDirective],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocItemListAccordionItemComponent extends AbstractDbxValueListViewItemComponent<DocValue> {
  readonly lorem = LOREM;

  get name() {
    return this.itemValue.name;
  }
}
