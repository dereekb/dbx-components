import { demoDevelopmentFunctionMap } from './../model/development.functions';
import { demoExampleUsageOfSchedule } from '../model/schedule.functions';
import { DemoDevelopmentExampleParams, DemoDevelopmentExampleResult, DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER, loadExampleSystemState } from '@dereekb/demo-firebase';
import { DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { onCallDevelopmentParams } from '@dereekb/firebase';
import { onCallDevelopmentFunction } from '@dereekb/firebase-server';
import { onCallWithDemoNestContext } from '../function';
import { isDate } from 'date-fns';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('exampleUsageOfSchedule', { f, fns: { demoExampleUsageOfSchedule } }, ({ demoExampleUsageOfScheduleWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      it('should execute the scheduled task.', async () => {
        const result = await u.callWrappedFunction(demoExampleUsageOfScheduleWrappedFn);

        // it should update the example system state
        const exampleSystemStateDocument = loadExampleSystemState(f.instance.demoFirestoreCollections.systemStateCollection.documentAccessor());
        const currentSystemState = await exampleSystemStateDocument.snapshotData();

        expect(currentSystemState?.data).toBeDefined();
        expect(currentSystemState?.data.lastUpdate).toBeDefined();
        expect(isDate(currentSystemState?.data.lastUpdate)).toBe(true); // date should now be set with the latest date
      });
    });
  });

  describeCallableRequestTest('exampleDevelopmentFunction', { f, fns: { dev: onCallWithDemoNestContext(onCallDevelopmentFunction(demoDevelopmentFunctionMap)) } }, ({ devWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      it('should execute the development function.', async () => {
        const params: DemoDevelopmentExampleParams = {
          message: 'hello world'
        };

        const result: DemoDevelopmentExampleResult = await u.callWrappedFunction(devWrappedFn, onCallDevelopmentParams(DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER, params));
        expect(result.message).toBe(params.message);
      });
    });
  });
});
