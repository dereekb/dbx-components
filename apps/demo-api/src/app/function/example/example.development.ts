import { DemoDevelopmentExampleResult, DemoDevelopmentExampleParams } from '@dereekb/demo-firebase';
import { DemoDevelopmentFunction } from '../function';

export const exampleDevelopmentFunction: DemoDevelopmentFunction<DemoDevelopmentExampleParams, DemoDevelopmentExampleResult> = (request) => {
  const { data } = request;

  console.log(`exampleDevelopmentFunction() was called: ${data.message}`);

  return {
    message: data.message
  };
};
