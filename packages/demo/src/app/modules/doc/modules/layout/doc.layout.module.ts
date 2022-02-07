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
import { DocComplexItemListComponent, DocComplexItemListViewComponent, DocComplexItemListViewItemComponent } from './component/item.list.complex.component';

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
    DocComplexItemListComponent,
    DocComplexItemListViewComponent,
    DocComplexItemListViewItemComponent,
    // containers
    DocLayoutLayoutComponent,
    DocLayoutHomeComponent,
    DocLayoutBarComponent,
    DocLayoutSectionComponent,
    DocLayoutContentComponent,
    DocLayoutListComponent
  ]
})
export class DocLayoutModule { }
