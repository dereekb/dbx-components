import { MatRippleModule } from '@angular/material/core';
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
import { DbxSelectionValueListViewContentComponent, DbxSelectionValueListViewComponent } from './list.view.value.selection.component';
import { DbxValueListViewContentComponent, DbxValueListViewComponent, DbxValueListViewContentGroupComponent } from './list.view.value.component';
import { DbxValueListItemModifierDirective } from './list.view.value.modifier.directive';
import { DbxListItemDisableRippleModifierDirective } from './list.view.value.modifier.ripple.directive';
import { DbxValueListGridViewContentComponent, DbxValueListGridSizeDirective, DbxValueListGridViewComponent } from './list.grid.view.component';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { DbxListItemIsSelectedModifierDirective } from './list.view.value.modifier.selection.directive';
import { DbxListTitleGroupDirective, DbxListTitleGroupHeaderComponent } from './list.view.value.group.title.directive';

const privateDeclarations = [DbxListInternalContentDirective];

const declarations = [
  // directives
  DbxListComponent,
  DbxListEmptyContentComponent,
  DbxValueListViewComponent,
  DbxValueListViewContentComponent,
  DbxValueListViewContentGroupComponent,
  DbxValueListGridSizeDirective,
  DbxValueListGridViewComponent,
  DbxValueListGridViewContentComponent,
  DbxListTitleGroupDirective,
  DbxListTitleGroupHeaderComponent,
  DbxSelectionValueListViewComponent,
  DbxSelectionValueListViewContentComponent,
  DbxValueListItemModifierDirective,
  DbxListItemDisableRippleModifierDirective,
  DbxListItemIsSelectedModifierDirective
];

@NgModule({
  imports: [CommonModule, MatRippleModule, FlexLayoutModule, DbxLoadingModule, DbxRouterAnchorModule, InfiniteScrollModule, DbxInjectionComponentModule, MatListModule, MatIconModule],
  declarations: [...declarations, ...privateDeclarations],
  exports: declarations
})
export class DbxListLayoutModule {}
