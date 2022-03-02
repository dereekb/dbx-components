import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFilterMapDirective } from './filter.map.directive';
import { DbxFilterMapSourceConnectorDirective } from './filter.map.connector.directive';
import { DbxFilterSourceDirective } from './filter.source.directive';
import { DbxFilterSourceConnectorDirective } from './filter.connector.directive';
import { DbxFilterMapSourceDirective } from './filter.map.source.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxFilterSourceDirective,
    DbxFilterSourceConnectorDirective,
    DbxFilterMapDirective,
    DbxFilterMapSourceConnectorDirective,
    DbxFilterMapSourceDirective,
  ],
  exports: [
    DbxFilterSourceDirective,
    DbxFilterSourceConnectorDirective,
    DbxFilterMapDirective,
    DbxFilterMapSourceConnectorDirective,
    DbxFilterMapSourceDirective,
  ]
})
export class DbxCoreFilterModule { }
