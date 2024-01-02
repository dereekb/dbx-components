import { MatRippleModule } from '@angular/material/core';
import { DbxRouterAnchorModule } from '../../router/layout/anchor/anchor.module';
import { DbxLoadingModule } from '../../loading/loading.module';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyListModule } from '@angular/material/legacy-list';
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
import { DbxValueListGridItemViewComponent, DbxValueListGridSizeDirective, DbxValueListGridViewComponent } from './list.grid.view.component';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { DbxListItemIsSelectedModifierDirective } from './list.view.value.modifier.selection.directive';

@NgModule({
  imports: [CommonModule, MatRippleModule, FlexLayoutModule, DbxLoadingModule, DbxRouterAnchorModule, InfiniteScrollModule, DbxInjectionComponentModule, MatLegacyListModule, MatIconModule],
  declarations: [
    //
    DbxListComponent,
    DbxListInternalContentDirective,
    DbxListEmptyContentComponent,
    DbxValueListViewComponent,
    DbxValueListItemViewComponent,
    DbxValueListGridSizeDirective,
    DbxValueListGridViewComponent,
    DbxValueListGridItemViewComponent,
    DbxSelectionValueListViewComponent,
    DbxSelectionValueListItemViewComponent,
    DbxValueListItemModifierDirective,
    DbxListItemDisableRippleModifierDirective,
    DbxListItemIsSelectedModifierDirective
  ],
  exports: [
    //
    DbxListComponent,
    DbxListEmptyContentComponent,
    DbxValueListViewComponent,
    DbxValueListItemViewComponent,
    DbxValueListGridSizeDirective,
    DbxValueListGridViewComponent,
    DbxValueListGridItemViewComponent,
    DbxSelectionValueListViewComponent,
    DbxSelectionValueListItemViewComponent,
    DbxValueListItemModifierDirective,
    DbxListItemDisableRippleModifierDirective,
    DbxListItemIsSelectedModifierDirective
  ]
})
export class DbxListLayoutModule {}
