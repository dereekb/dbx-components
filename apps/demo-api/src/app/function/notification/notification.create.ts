import { type DemoCreateModelFunction } from '../function.context';
import { type OnCallCreateModelResult } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';

export const notificationCreate: DemoCreateModelFunction<{}> = withApiDetails({
  optionalAuth: true,
  fn: async (request) => {
    const { nest: _nest, auth: _auth, data: _data } = request;

    // Does nothing. This is just to demonstrate withApiDetails with optionalAuth.

    const response: OnCallCreateModelResult = {
      modelKeys: []
    };

    return response;
  }
});
