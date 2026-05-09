import { type UpdateNotificationSummaryParams, updateNotificationSummaryParamsType } from '@dereekb/firebase';
import { assertIsAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
import { type DemoUpdateModelFunction } from '../function.context';

export const notificationSummaryUpdate: DemoUpdateModelFunction<UpdateNotificationSummaryParams> = withApiDetails({
  inputType: updateNotificationSummaryParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    const updateNotificationSummary = await nest.notificationActions.updateNotificationSummary(data);
    const accessor = nest.demoFirestoreCollections.notificationSummaryCollection.documentAccessor();
    const notificationSummaryDocument = accessor.loadDocumentForKey(data.key);

    await updateNotificationSummary(notificationSummaryDocument);
  }
});
