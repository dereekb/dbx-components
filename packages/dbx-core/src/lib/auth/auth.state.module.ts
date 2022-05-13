import { fromDbxAppAuth } from './state';
import { NgModule } from '@angular/core';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { DbxAppAuthEffects } from './state/effect/auth.effect';

@NgModule({
  imports: [
    StoreModule.forFeature(fromDbxAppAuth.featureKey, fromDbxAppAuth.reducers),
    EffectsModule.forFeature([DbxAppAuthEffects])
  ],
  declarations: [],
  exports: []
})
export class DbxAppAuthStateModule { }
