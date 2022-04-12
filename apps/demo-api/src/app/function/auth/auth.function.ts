import * as functions from 'firebase-functions';
import { onEventWithDemoNestContext } from '../function';



export const test = eventHandlerWithNestContext((withNestContext) => functions.auth.user().onCreate(withNestContext(() => {}) )

const test2 = onEventWithDemoNestContext(() => {

}));
