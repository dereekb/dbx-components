import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectedComponentModule } from '@dereekb/dbx-core';
import { DbxLoadingModule } from '../../loading/loading.module';
import { DbxListComponent, DbxListInternalViewComponent } from './list.component';
import { DbxListEmptyContentComponent } from './list.empty.component';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';

@NgModule({
  imports: [
    CommonModule,
    DbxLoadingModule,
    InfiniteScrollModule,
    DbxInjectedComponentModule
  ],
  declarations: [
    DbxListComponent,
    DbxListInternalViewComponent,
    DbxListEmptyContentComponent
  ],
  exports: [
    DbxListComponent,
    DbxListEmptyContentComponent
  ]
})
export class DbxListLayoutModule { }
