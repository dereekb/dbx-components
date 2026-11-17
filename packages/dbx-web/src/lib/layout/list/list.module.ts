import { NgModule } from '@angular/core';
import { DbxListEmptyContentComponent } from './list.content.empty.component';
import { DbxListTitleGroupDirective } from './group/list.view.value.group.title.directive';
import { DbxListViewMetaIconComponent } from './meta/list.view.meta.icon.component';
import { DbxListModifierModule } from './modifier/list.modifier.module';
import { DbxListDragDropDirective } from './dragdrop/list.drag.drop.directive';

const importsAndExports = [
  // directives
  DbxListEmptyContentComponent,
  DbxListViewMetaIconComponent,
  DbxListTitleGroupDirective,
  DbxListDragDropDirective,
  DbxListModifierModule
];

/**
 * Contains all supporting list components and directives.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxListModule {}
