import { DocLayoutTwoBlockComponent } from './container/block.component';
import { DocLayoutFlexComponent } from './container/flex.component';
import { DocLayoutListComponent } from './container/list.component';
import { DocLayoutSectionComponent } from './container/section.component';
import { DocLayoutLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.layout.router';
import { DocLayoutHomeComponent } from './container/home.component';

import { DocLayoutContentComponent } from './container/content.component';
import { DocLayoutBarComponent } from './container/bar.component';
import { DocItemListComponent, DocItemListViewComponent } from './component/item.list.component';
import { DocSelectionItemListComponent, DocSelectionItemListViewComponent, DocSelectionItemListViewItemComponent } from './component/item.list.selection.component';
import { DocCustomItemListComponent, DocCustomItemListViewComponent, DocCustomItemListViewItemComponent } from './component/item.list.custom.component';
import { DocLayoutTwoColumnsComponent } from './container/two.component';
import { DocItemListGridComponent, DocItemListGridViewComponent, DocItemListGridViewItemComponent } from './component/item.list.grid.component';
import { DocLayoutSectionPageComponent } from './container/section.page.component';
import { DocLayoutTwoColumnsChildComponent } from './container/two.child.component';
import { DocLayoutSectionPageTwoComponent } from './container/section.page.two.component';

const declarations = [DocItemListComponent, DocItemListViewComponent, DocSelectionItemListComponent, DocSelectionItemListViewComponent, DocSelectionItemListViewItemComponent, DocCustomItemListComponent, DocCustomItemListViewComponent, DocCustomItemListViewItemComponent, DocItemListGridComponent, DocItemListGridViewComponent, DocItemListGridViewItemComponent];

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    }),
    // components
    // containers
    DocLayoutLayoutComponent,
    DocLayoutHomeComponent,
    DocLayoutBarComponent,
    DocLayoutFlexComponent,
    DocLayoutSectionComponent,
    DocLayoutSectionPageComponent,
    DocLayoutSectionPageTwoComponent,
    DocLayoutContentComponent,
    DocLayoutListComponent,
    DocLayoutTwoColumnsComponent,
    DocLayoutTwoColumnsChildComponent,
    DocLayoutTwoBlockComponent
  ],
  exports: [DocItemListComponent, DocItemListViewComponent]
})
export class DocLayoutModule {}
