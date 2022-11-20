import { DocLayoutTwoBlockComponent } from './container/block.component';
import { DocLayoutFlexComponent } from './container/flex.component';
import { DocLayoutListComponent } from './container/list.component';
import { DocLayoutSectionComponent } from './container/section.component';
import { DocLayoutLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.layout.router';
import { DocLayoutHomeComponent } from './container/home.component';
import { DocSharedModule } from '../shared/doc.shared.module';
import { DocLayoutContentComponent } from './container/content.component';
import { DocLayoutBarComponent } from './container/bar.component';
import { DocItemListComponent, DocItemListViewComponent } from './component/item.list.component';
import { DocSelectionItemListComponent, DocSelectionItemListViewComponent, DocSelectionItemListViewItemComponent } from './component/item.list.selection.component';
import { DocCustomItemListComponent, DocCustomItemListViewComponent, DocCustomItemListViewItemComponent } from './component/item.list.custom.component';
import { DocLayoutTwoColumnsComponent } from './container/two.component';
import { DocItemListGridComponent, DocItemListGridViewComponent, DocItemListGridViewItemComponent } from './component/item.list.grid.component';
import { DocLayoutSectionPageComponent } from './container/section.page.component';
import { DocLayoutTwoColumnsChildComponent } from './container/two.child.component';

@NgModule({
  imports: [
    DocSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    // components
    DocItemListComponent,
    DocItemListViewComponent,
    DocSelectionItemListComponent,
    DocSelectionItemListViewComponent,
    DocSelectionItemListViewItemComponent,
    DocCustomItemListComponent,
    DocCustomItemListViewComponent,
    DocCustomItemListViewItemComponent,
    DocItemListGridComponent,
    DocItemListGridViewComponent,
    DocItemListGridViewItemComponent,
    // containers
    DocLayoutLayoutComponent,
    DocLayoutHomeComponent,
    DocLayoutBarComponent,
    DocLayoutFlexComponent,
    DocLayoutSectionComponent,
    DocLayoutSectionPageComponent,
    DocLayoutContentComponent,
    DocLayoutListComponent,
    DocLayoutTwoColumnsComponent,
    DocLayoutTwoColumnsChildComponent,
    DocLayoutTwoBlockComponent
  ]
})
export class DocLayoutModule {}
