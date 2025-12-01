import { type DemoCreateModelFunction } from '../function';
import { type OnCallCreateModelResult } from '@dereekb/firebase';
import { optionalAuthContext } from '@dereekb/firebase-server';

export const profileCreate: DemoCreateModelFunction<{}> = optionalAuthContext(async (request) => {
  const { nest, auth, data } = request;

  // Does nothing. This is just to demonstrate the optionalAuthContext function and handling.

  const response: OnCallCreateModelResult = {
    modelKeys: []
  };

  return response;
});
