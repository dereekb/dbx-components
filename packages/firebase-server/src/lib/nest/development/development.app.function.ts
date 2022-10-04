import { inAuthContext } from '@dereekb/firebase-server';
import { OnCallDevelopmentParams, SCHEDULED_FUNCTION_DEV_FUNCTION_SPECIFIER } from '@dereekb/firebase';
import { CallableHttpFunction, RunnableHttpFunction } from '../../function/type';
import { NestAppPromiseGetter } from '../app';
import { NestApplicationScheduleConfiguredFunctionMap } from '../function/schedule.util';
import { OnCallWithNestContextFactory } from '../function/v1/call';
import { OnCallHandlerWithNestContextFactory } from '../function/v2/call';
import { AbstractFirebaseNestContext } from '../nest.provider';
import { onCallDevelopmentFunction, OnCallDevelopmentFunctionMap } from './development.function';
import { makeScheduledFunctionDevelopmentFunction } from './development.schedule.function';
import { unavailableError } from '../../function/error';

export interface FirebaseServerDevFunctionsConfig<N extends AbstractFirebaseNestContext<any, any>, S extends NestApplicationScheduleConfiguredFunctionMap> {
  readonly enabled: boolean;
  /**
   * Whether or not to require an auth context when calling dev functions. True by default.
   */
  readonly secure?: boolean;
  readonly nest: NestAppPromiseGetter;
  readonly developerFunctionsMap: OnCallDevelopmentFunctionMap<N>;
  readonly onCallFactory: OnCallWithNestContextFactory<N> | OnCallHandlerWithNestContextFactory<N>;
  readonly disableDevelopmentScheduleFunction?: boolean;
  readonly allScheduledFunctions?: S;
}

export interface FirebaseServerDevFunctions {
  readonly dev: RunnableHttpFunction<OnCallDevelopmentParams> | CallableHttpFunction<OnCallDevelopmentParams>;
}

export function firebaseServerDevFunctions<N extends AbstractFirebaseNestContext<any, any>, S extends NestApplicationScheduleConfiguredFunctionMap>(config: FirebaseServerDevFunctionsConfig<N, S>): FirebaseServerDevFunctions {
  const { enabled, secure, nest, developerFunctionsMap, onCallFactory, allScheduledFunctions, disableDevelopmentScheduleFunction } = config;

  let dev: RunnableHttpFunction<OnCallDevelopmentParams> | CallableHttpFunction<OnCallDevelopmentParams>;

  if (enabled) {
    const fullFunctionsMap: OnCallDevelopmentFunctionMap<N> = {
      ...developerFunctionsMap
    };

    if (allScheduledFunctions && disableDevelopmentScheduleFunction != null) {
      fullFunctionsMap[SCHEDULED_FUNCTION_DEV_FUNCTION_SPECIFIER] = makeScheduledFunctionDevelopmentFunction({
        allScheduledFunctions
      });
    }

    let onCallFunction = onCallDevelopmentFunction(fullFunctionsMap);

    if (secure != false) {
      onCallFunction = inAuthContext(onCallFunction);
    }

    dev = onCallFactory(onCallFunction)(nest);
  } else {
    dev = onCallFactory(async (x) => {
      throw unavailableError({
        message: 'developer tools service is not enabled.'
      });
    })(nest);
  }

  return {
    dev
  };
}
