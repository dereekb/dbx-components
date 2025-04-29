import { APP_CODE_PREFIXEnvironment, base } from './base';
import { environment as prod } from './environment.prod';

export const environment: APP_CODE_PREFIXEnvironment = {
  ...prod,
  production: true,
  staging: true,
  firebase: {
    ...base.firebase, // extend from base
    emulators: {
      useEmulators: false
    }
  },
  analytics: {
    segment: '' // TODO: Configure Segment for staging!
  },
  mapbox: {
    ...prod.mapbox // TODO: Configure Mapbox staging if not also sharing the production credentials
  }
};
