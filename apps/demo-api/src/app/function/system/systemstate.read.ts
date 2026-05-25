import { type ExampleReadParams, type ExampleReadResponse, exampleReadParamsType } from 'demo-firebase';
import { type DemoReadModelFunction } from '../function.context';
import { withApiDetails } from '@dereekb/firebase-server';

export const systemStateExampleread: DemoReadModelFunction<ExampleReadParams, ExampleReadResponse> = withApiDetails({
  inputType: exampleReadParamsType,
  fn: async (request) => {
    const { nest: _nest, data, auth: _auth } = request;

    // performed read.

    return {
      read: true,
      message: data.message
    };
  }
});
