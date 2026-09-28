import { NgModule } from '@angular/core';
import { DbxFilterMapDirective } from './filter.map.directive';
import { DbxFilterMapSourceConnectorDirective } from './filter.map.connector.directive';
import { DbxFilterSourceDirective } from './filter.source.directive';
import { DbxFilterSourceConnectorDirective } from './filter.connector.directive';
import { DbxFilterMapSourceDirective } from './filter.map.source.directive';
import { DbxFilterConnectSourceDirective } from './filter.connect.source.directive';
import { DbxFilterMapMergeSourceDirective } from './filter.map.merge.source.directive';
import { DbxFilterMapStorageDirective } from './filter.map.storage.directive';
import { DbxFilterMapRouteParamsDirective } from './filter.map.route.params.directive';

const importsAndExports = [DbxFilterSourceDirective, DbxFilterMapSourceConnectorDirective, DbxFilterConnectSourceDirective, DbxFilterSourceConnectorDirective, DbxFilterMapDirective, DbxFilterMapSourceDirective, DbxFilterMapMergeSourceDirective, DbxFilterMapStorageDirective, DbxFilterMapRouteParamsDirective];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxCoreFilterModule {}
