import { DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_KEY } from '@dereekb/demo-firebase';
import { exampleDevelopmentFunction } from '../example/example.development';
import { DemoOnCallDevelopmentFunctionMap } from '../function';

export const demoDevelopmentFunctionMap: DemoOnCallDevelopmentFunctionMap = {
  [DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_KEY]: exampleDevelopmentFunction
};
