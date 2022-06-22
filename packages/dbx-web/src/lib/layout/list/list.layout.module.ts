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
import { DbxListItemDisableRippleModifierDirective } from './list.view.value.modifier.ripple.directive';
import { DbxValueListGridItemViewComponent, DbxValueListGridViewComponent } from './list.grid.view.component';
import { FlexLayoutModule } from '@angular/flex-layout';

@NgModule({
  imports: [CommonModule, FlexLayoutModule, DbxLoadingModule, DbxRouterAnchorModule, InfiniteScrollModule, DbxInjectionComponentModule, MatListModule, MatIconModule],
  declarations: [
    //
    DbxListComponent,
    DbxListInternalContentDirective,
    DbxListEmptyContentComponent,
    DbxValueListViewComponent,
    DbxValueListItemViewComponent,
    DbxValueListGridViewComponent,
    DbxValueListGridItemViewComponent,
    DbxSelectionValueListViewComponent,
    DbxSelectionValueListItemViewComponent,
    DbxValueListItemModifierDirective,
    DbxListItemDisableRippleModifierDirective
  ],
  exports: [
    //
    DbxListComponent,
    DbxListEmptyContentComponent,
    DbxValueListViewComponent,
    DbxValueListItemViewComponent,
    DbxValueListGridViewComponent,
    DbxValueListGridItemViewComponent,
    DbxSelectionValueListViewComponent,
    DbxSelectionValueListItemViewComponent,
    DbxValueListItemModifierDirective,
    DbxListItemDisableRippleModifierDirective
  ]
})
export class DbxListLayoutModule {}
