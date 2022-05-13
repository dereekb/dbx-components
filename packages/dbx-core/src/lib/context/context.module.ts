import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { DbxAppContextStateDirective } from './context.directive';
import { fromDbxAppContext } from './state';

@NgModule({
  imports: [
    StoreModule.forFeature(fromDbxAppContext.featureKey, fromDbxAppContext.reducers)
  ],
  declarations: [
    DbxAppContextStateDirective
  ],
  exports: [
    DbxAppContextStateDirective
  ]
})
export class DbxAppContextStateModule { }
