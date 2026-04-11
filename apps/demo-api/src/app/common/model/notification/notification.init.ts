import { MAKE_TEMPLATE_FOR_NOTIFICATION_RELATED_MODEL_INITIALIZATION_FUNCTION_DELETE_RESPONSE, type MakeTemplateForNotificationRelatedModelInitializationFunctionInput, type MakeTemplateForNotificationRelatedModelInitializationFunctionResult, type NotificationInitServerActionsContextConfig } from '@dereekb/firebase-server/model';
import { type DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { type NotificationBoxRecipient, firestoreModelKey, newNotificationBoxRecipientForUid } from '@dereekb/firebase';
import { guestbookIdentity, profileIdentity } from 'demo-firebase';

/**
 * Builds the notification initialization config that teaches the notification system
 * how to create NotificationBox documents for demo models (Profile and Guestbook).
 * Determines the initial owner and recipients when a notification box is first created.
 *
 * @param context - server actions context providing Firestore collection accessors
 * @returns a config with initialization functions for notification boxes and summaries
 */
export function demoNotificationInitServerActionsContextConfig(context: DemoFirebaseServerActionsContext): NotificationInitServerActionsContextConfig {
  const { profileCollection, guestbookCollection } = context;

  const makeTemplateForNotificationModelInitialization = async function (input: MakeTemplateForNotificationRelatedModelInitializationFunctionInput): Promise<MakeTemplateForNotificationRelatedModelInitializationFunctionResult<any>> {
    const { collectionName, modelKey } = input;
    let result: MakeTemplateForNotificationRelatedModelInitializationFunctionResult<any> = null; // invalid

    const initProfileNotificationBox = () => {
      const profileDocument = profileCollection.documentAccessor().loadDocumentForKey(modelKey);
      const r: NotificationBoxRecipient[] = [newNotificationBoxRecipientForUid(profileDocument.id, 0)];

      return {
        o: profileDocument.key,
        r
      };
    };

    const initGuestbookNotificationBox = async () => {
      const guestbookDocument = guestbookCollection.documentAccessor().loadDocumentForKey(modelKey);
      const guestbook = await guestbookDocument.snapshotData();

      let result: MakeTemplateForNotificationRelatedModelInitializationFunctionResult<any> = MAKE_TEMPLATE_FOR_NOTIFICATION_RELATED_MODEL_INITIALIZATION_FUNCTION_DELETE_RESPONSE;

      if (guestbook) {
        const o = guestbook.cby ? firestoreModelKey(profileIdentity, guestbook.cby) : undefined;
        const r: NotificationBoxRecipient[] = guestbook.cby ? [newNotificationBoxRecipientForUid(guestbook.cby, 0)] : [];
        result = { o, r };
      }

      return result;
    };

    switch (collectionName) {
      case profileIdentity.collectionName:
        result = initProfileNotificationBox();
        break;
      case guestbookIdentity.collectionName:
        result = await initGuestbookNotificationBox();
        break;
    }

    return result;
  };

  const config: NotificationInitServerActionsContextConfig = {
    makeTemplateForNotificationBoxInitialization: makeTemplateForNotificationModelInitialization,
    makeTemplateForNotificationSummaryInitialization: makeTemplateForNotificationModelInitialization
  };

  return config;
}
