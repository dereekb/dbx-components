import { DbxAnchorModule } from '../../router/layout/anchor/anchor.module';
import { DbxLoadingModule } from '../../loading/loading.module';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectedComponentModule } from '@dereekb/dbx-core';
import { DbxListComponent, DbxListInternalContentDirective } from './list.component';
import { DbxListEmptyContentComponent } from './list.content.empty.component';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { DbxSelectionValueListViewComponent } from './list.view.value.selection.component';
import { DbxValueListViewComponent } from './list.view.value.component';

@NgModule({
  imports: [
    CommonModule,
    DbxLoadingModule,
    DbxAnchorModule,
    InfiniteScrollModule,
    DbxInjectedComponentModule,
    MatListModule,
    MatIconModule
  ],
  declarations: [
    DbxListComponent,
    DbxListInternalContentDirective,
    DbxListEmptyContentComponent,
    DbxValueListViewComponent,
    DbxSelectionValueListViewComponent
  ],
  exports: [
    DbxListComponent,
    DbxListEmptyContentComponent,
    DbxValueListViewComponent,
    DbxSelectionValueListViewComponent
  ]
})
export class DbxListLayoutModule { }
