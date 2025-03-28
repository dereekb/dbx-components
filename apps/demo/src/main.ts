import { enableProdMode } from '@angular/core';
import { watchWindowAndUpdateVh100StyleProperty } from '@dereekb/browser';

import { environment } from './environments/environment';
import { UIView } from '@uirouter/angular';
import { appConfig } from './app.config';
import { bootstrapApplication } from '@angular/platform-browser';

if (environment.production) {
  enableProdMode();
}

watchWindowAndUpdateVh100StyleProperty();

bootstrapApplication(UIView, appConfig)
  .then(() => {
    console.log('Bootstrap complete');
  })
  .catch((err) => console.error(err));
