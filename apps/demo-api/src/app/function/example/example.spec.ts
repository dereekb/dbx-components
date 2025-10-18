import { demoDevelopmentFunctionMap } from './../model/development.functions';
import { demoExampleUsageOfSchedule } from '../model/schedule.functions';
import { type DemoDevelopmentExampleParams, type DemoDevelopmentExampleResult, DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER, loadExampleSystemState } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCallableRequestTest, describeCloudFunctionTest } from '@dereekb/firebase-server/test';
import { onCallDevelopmentParams } from '@dereekb/firebase';
import { onCallDevelopmentFunction } from '@dereekb/firebase-server';
import { onCallWithDemoNestContext } from '../function';
import { isDate } from 'date-fns';
import { type ScheduledEvent } from 'firebase-functions/scheduler';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCloudFunctionTest('exampleUsageOfSchedule', { f, fns: { demoExampleUsageOfSchedule } }, ({ demoExampleUsageOfScheduleCloudFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      it('should execute the scheduled task.', async () => {
        const scheduledEvent: ScheduledEvent = {
          scheduleTime: new Date().toISOString()
        };

        await u.callCloudFunction(demoExampleUsageOfScheduleCloudFn, scheduledEvent);

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

        const result = (await u.callWrappedFunction(devWrappedFn, onCallDevelopmentParams(DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER, params))) as DemoDevelopmentExampleResult;
        expect(result.message).toBe(params.message);
      });
    });
  });
});
