import { loadExampleSystemState } from '@dereekb/demo-firebase';
import { DemoScheduleFunction } from '../function';

export const exampleUsageOfSchedule: DemoScheduleFunction = async (request) => {
  const exampleSystemStateDocument = loadExampleSystemState(request.nest.demoFirestoreCollections.systemStateCollection.documentAccessor());

  const currentSystemState = await exampleSystemStateDocument.snapshotData();

  console.log(`exampleUsageOfSchedule() was called! Last update was at ${currentSystemState?.data.lastUpdate}`);

  await exampleSystemStateDocument.accessor.set({
    data: {
      lastUpdate: new Date()
    }
  });
};

export const hourlySchedule: DemoScheduleFunction = async (request) => {
  const { nest } = request;

  await nest.notificationInitActions.initializeAllApplicableNotificationBoxes({}).then((x) => x());
  await nest.notificationInitActions.initializeAllApplicableNotificationSummaries({}).then((x) => x());
};
