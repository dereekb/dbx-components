import { MAKE_TEMPLATE_FOR_NOTIFICATION_RELATED_MODEL_INITIALIZATION_FUNCTION_DELETE_RESPONSE, MakeTemplateForNotificationRelatedModelInitializationFunctionInput, MakeTemplateForNotificationRelatedModelInitializationFunctionResult, NotificationInitServerActionsContextConfig } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { NotificationBoxRecipient, firestoreModelKey, newNotificationBoxRecipientForUid } from '@dereekb/firebase';
import { guestbookIdentity, profileIdentity } from '@dereekb/demo-firebase';

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

      if (guestbook) {
        const o = guestbook.cby ? firestoreModelKey(profileIdentity, guestbook.cby) : undefined;
        const r: NotificationBoxRecipient[] = guestbook.cby ? [newNotificationBoxRecipientForUid(guestbook.cby, 0)] : [];

        return {
          o,
          r
        };
      } else {
        return MAKE_TEMPLATE_FOR_NOTIFICATION_RELATED_MODEL_INITIALIZATION_FUNCTION_DELETE_RESPONSE;
      }
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
