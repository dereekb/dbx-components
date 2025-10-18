import { type ExampleReadParams, type ExampleReadResponse } from 'demo-firebase';
import { type DemoReadModelFunction } from '../function';

export const systemStateExampleRead: DemoReadModelFunction<ExampleReadParams, ExampleReadResponse> = async (request) => {
  const { nest, data, auth } = request;

  // performed read.

  return {
    read: true,
    message: data.message
  };
};
