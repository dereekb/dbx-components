/**
 * Add reflect-metadata for Reflections api.
 */
import 'reflect-metadata';

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { watchWindowAndUpdateVh100StyleProperty } from '@dereekb/browser';

import { RootModule } from './root.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

watchWindowAndUpdateVh100StyleProperty();

platformBrowserDynamic()
  .bootstrapModule(RootModule)
  .catch((err) => console.error(err));
