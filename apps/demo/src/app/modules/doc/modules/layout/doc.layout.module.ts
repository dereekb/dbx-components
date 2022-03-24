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
    // containers
    DocLayoutLayoutComponent,
    DocLayoutHomeComponent,
    DocLayoutBarComponent,
    DocLayoutFlexComponent,
    DocLayoutSectionComponent,
    DocLayoutContentComponent,
    DocLayoutListComponent
  ]
})
export class DocLayoutModule { }
