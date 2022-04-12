import { nestServerInstance } from '@dereekb/firebase-server';
import { DemoApiAppModule } from './app.module';

export const {
  getNestServer,
  getNestServerApp
} = nestServerInstance(DemoApiAppModule);
