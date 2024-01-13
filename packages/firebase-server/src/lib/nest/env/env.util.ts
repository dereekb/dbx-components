import { type AsyncDecisionFunction } from '@dereekb/util';
import { FirebaseServerEnvService } from '../../env/env.service';
import { type NestAppPromiseGetter } from '../app';

export function nestAppIsProductionEnvironment(nest: NestAppPromiseGetter): AsyncDecisionFunction<void> {
  return () => nest().then((x) => x.get(FirebaseServerEnvService).isProduction);
}

export function nestAppHasDevelopmentSchedulerEnabled(nest: NestAppPromiseGetter): AsyncDecisionFunction<void> {
  return () => nest().then((x) => x.get(FirebaseServerEnvService).developmentSchedulerEnabled);
}
