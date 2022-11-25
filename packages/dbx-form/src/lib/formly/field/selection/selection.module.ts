import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormFormlyPickableFieldModule } from './pickable/pickable.field.module';
import { DbxFormFormlySearchableFieldModule } from './searchable/searchable.field.module';
import { DbxFormFormlyDbxListFieldModule } from './list/list.field.module';

@NgModule({
  imports: [CommonModule],
  declarations: [],
  exports: [DbxFormFormlyDbxListFieldModule, DbxFormFormlyPickableFieldModule, DbxFormFormlySearchableFieldModule]
})
export class DbxFormFormlySelectionModule {}
