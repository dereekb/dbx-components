import { APP_CODE_PREFIXDevelopmentExampleResult, APP_CODE_PREFIXDevelopmentExampleParams } from 'FIREBASE_COMPONENTS_NAME';
import { APP_CODE_PREFIXDevelopmentFunction } from '../function';

export const exampleDevelopmentFunction: APP_CODE_PREFIXDevelopmentFunction<APP_CODE_PREFIXDevelopmentExampleParams, APP_CODE_PREFIXDevelopmentExampleResult> = (request) => {
  const { data } = request;

  console.log(`exampleDevelopmentFunction() was called: ${data.message}`);

  return {
    message: data.message
  };
};
