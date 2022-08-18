import { base, DemoEnvironment } from './base';

export const environment: DemoEnvironment = {
  ...base,
  production: true,
  firebase: {
    ...base.firebase,
    emulators: {
      useEmulators: false
    }
  },
  mapbox: {
    token: 'pk.eyJ1IjoiZGVyZWVrYiIsImEiOiJjbDZ0bmliZTExcTByM2lycWU0a2FxNWZmIn0.PT1rSJQKOjNIYAwDTEdJ7w'
  }
};
