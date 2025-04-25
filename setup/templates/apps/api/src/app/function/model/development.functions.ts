import { EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER } from 'FIREBASE_COMPONENTS_NAME';
import { exampleDevelopmentFunction } from '../example/example.development';
import { APP_CODE_PREFIXOnCallDevelopmentFunctionMap } from '../function';

export const APP_CODE_PREFIXDevelopmentFunctionMap: APP_CODE_PREFIXOnCallDevelopmentFunctionMap = {
  [EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER]: exampleDevelopmentFunction
};
