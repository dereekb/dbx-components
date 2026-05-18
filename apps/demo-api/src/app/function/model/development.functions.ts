import { DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER } from 'demo-firebase';
import { exampleDevelopmentFunction } from '../example/example.development';
import { type DemoOnCallDevelopmentFunctionMap } from '../function.context';

export const DEMO_DEVELOPMENT_FUNCTION_MAP: DemoOnCallDevelopmentFunctionMap = {
  [DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER]: exampleDevelopmentFunction
};
