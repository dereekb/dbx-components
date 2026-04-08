import { type ExampleReadParams, type ExampleReadResponse } from 'demo-firebase';
import { type DemoReadModelFunction } from '../function.context';

export const systemStateExampleRead: DemoReadModelFunction<ExampleReadParams, ExampleReadResponse> = async (request) => {
  const { nest: _nest, data, auth: _auth } = request;

  // performed read.

  return {
    read: true,
    message: data.message
  };
};
