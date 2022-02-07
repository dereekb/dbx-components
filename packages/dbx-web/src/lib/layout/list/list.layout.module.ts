import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectedComponentModule } from '@dereekb/dbx-core';
import { DbxLoadingModule } from '../../loading/loading.module';
import { DbxListComponent, DbxListInternalViewComponent } from './list.component';
import { DbxListEmptyContentComponent } from './list.content.empty.component';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { DbxSelectionValueListViewComponent } from './list.view.selection.component';

@NgModule({
  imports: [
    CommonModule,
    DbxLoadingModule,
    InfiniteScrollModule,
    DbxInjectedComponentModule,
    MatListModule,
    MatIconModule
  ],
  declarations: [
    DbxListComponent,
    DbxListInternalViewComponent,
    DbxListEmptyContentComponent,
    DbxSelectionValueListViewComponent
  ],
  exports: [
    DbxListComponent,
    DbxListEmptyContentComponent,
    DbxSelectionValueListViewComponent
  ]
})
export class DbxListLayoutModule { }
