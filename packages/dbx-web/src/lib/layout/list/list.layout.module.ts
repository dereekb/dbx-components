import { DbxRouterAnchorModule } from '../../router/layout/anchor/anchor.module';
import { DbxLoadingModule } from '../../loading/loading.module';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxListComponent, DbxListInternalContentDirective } from './list.component';
import { DbxListEmptyContentComponent } from './list.content.empty.component';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { DbxSelectionValueListItemViewComponent, DbxSelectionValueListViewComponent } from './list.view.value.selection.component';
import { DbxValueListItemViewComponent, DbxValueListViewComponent } from './list.view.value.component';
import { DbxValueListItemModifierDirective } from './list.view.value.modifier.directive';

@NgModule({
  imports: [
    CommonModule,
    DbxLoadingModule,
    DbxRouterAnchorModule,
    InfiniteScrollModule,
    DbxInjectionComponentModule,
    MatListModule,
    MatIconModule
  ],
  declarations: [
    DbxListComponent,
    DbxListInternalContentDirective,
    DbxListEmptyContentComponent,
    DbxValueListViewComponent,
    DbxValueListItemViewComponent,
    DbxSelectionValueListViewComponent,
    DbxSelectionValueListItemViewComponent,
    DbxValueListItemModifierDirective
  ],
  exports: [
    DbxListComponent,
    DbxListEmptyContentComponent,
    DbxValueListViewComponent,
    DbxValueListItemViewComponent,
    DbxSelectionValueListViewComponent,
    DbxSelectionValueListItemViewComponent,
    DbxValueListItemModifierDirective
  ]
})
export class DbxListLayoutModule { }
