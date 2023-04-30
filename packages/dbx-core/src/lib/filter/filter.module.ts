import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFilterMapDirective } from './filter.map.directive';
import { DbxFilterMapSourceConnectorDirective } from './filter.map.connector.directive';
import { DbxFilterSourceDirective } from './filter.source.directive';
import { DbxFilterSourceConnectorDirective } from './filter.connector.directive';
import { DbxFilterMapSourceDirective } from './filter.map.source.directive';
import { DbxFilterConnectSourceDirective } from './filter.connect.source.directive';

const declarations = [DbxFilterSourceDirective, DbxFilterMapSourceConnectorDirective, DbxFilterConnectSourceDirective, DbxFilterSourceConnectorDirective, DbxFilterMapDirective, DbxFilterMapSourceDirective];

@NgModule({
  imports: [CommonModule],
  declarations,
  exports: declarations
})
export class DbxCoreFilterModule {}
