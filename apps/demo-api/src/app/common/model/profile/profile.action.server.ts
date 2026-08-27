import { type FirebaseServerActionsContext } from '@dereekb/firebase-server';
import {
  type AsyncProfileUpdateAction,
  DEMO_PROFILE_CALENDAR_TYPE,
  exampleNotificationTemplate,
  type ProfileCreateTestCalendarEventParams,
  profileCreateTestCalendarEventParamsType,
  type ProfileCreateTestNotificationParams,
  profileCreateTestNotificationParamsType,
  type ProfileDocument,
  type ProfileFirestoreCollections,
  ProfileResumeState,
  type ProfileRotateCalendarIcsParams,
  profileRotateCalendarIcsParamsType,
  profileWithUsernameQuery,
  type SetProfileUsernameParams,
  setProfileUsernameParamsType,
  type UpdateProfileParams,
  updateProfileParamsType
} from 'demo-firebase';
import { type Maybe } from '@dereekb/util';
import { type CalendarEventItem, type CalendarFirestoreCollections, type CalendarRecurringEventItem, type NotificationFirestoreCollections, type FirestoreContextReference, calendarIdForModel, calendarTemplate, createNotificationDocument, twoWayFlatFirestoreModelKey, updateCalendarEventsTemplate } from '@dereekb/firebase';
import { usernameAlreadyTakenError } from './profile.error';
import { type CalendarServerActions, type NotificationExpediteServiceRef } from '@dereekb/firebase-server/model';

/**
 * FirebaseServerActionsContextt required for ProfileServerActions.
 */
export interface ProfileServerActionsContext extends FirebaseServerActionsContext, ProfileFirestoreCollections, NotificationFirestoreCollections, CalendarFirestoreCollections, FirestoreContextReference, NotificationExpediteServiceRef {
  /**
   * The library Calendar actions the profile's calendar-facing actions delegate to.
   *
   * The rotation logic belongs to the Calendar, not the Profile — the Profile only supplies the
   * authorization boundary and the "which calendar" resolution.
   */
  readonly calendarServerActions: CalendarServerActions;
}

/**
 * Server-only profile actions.
 */
export abstract class ProfileServerActions {
  abstract initProfileForUid(uid: string): Promise<ProfileDocument>;
  abstract updateProfile(params: UpdateProfileParams): AsyncProfileUpdateAction<UpdateProfileParams>;
  abstract setProfileUsername(params: SetProfileUsernameParams): AsyncProfileUpdateAction<SetProfileUsernameParams>;
  abstract createTestNotification(params: ProfileCreateTestNotificationParams): AsyncProfileUpdateAction<ProfileCreateTestNotificationParams>;
  abstract createTestCalendarEvent(params: ProfileCreateTestCalendarEventParams): AsyncProfileUpdateAction<ProfileCreateTestCalendarEventParams>;
  abstract rotateCalendarIcs(params: ProfileRotateCalendarIcsParams): AsyncProfileUpdateAction<ProfileRotateCalendarIcsParams>;
}

/**
 * Factory for generating ProfileServerActions for a given context.
 *
 * @param context - The server actions context providing Firestore collections and auth utilities.
 * @returns A concrete ProfileServerActions implementation bound to the given context.
 */
export function profileServerActions(context: ProfileServerActionsContext): ProfileServerActions {
  return {
    initProfileForUid: initProfileForUidFactory(context),
    updateProfile: updateProfileFactory(context),
    setProfileUsername: setProfileUsernameFactory(context),
    createTestNotification: createTestNotificationFactory(context),
    createTestCalendarEvent: createTestCalendarEventFactory(context),
    rotateCalendarIcs: rotateCalendarIcsFactory(context)
  };
}

// MARK: Actions
/**
 * Creates a factory that initializes a new Profile document for a given user UID.
 * Runs within a transaction to avoid duplicate profiles, and auto-generates a unique username.
 * Also creates the associated private profile data document.
 *
 * @param context
 * @param context.profileCollection - The Firestore collection accessor for profile documents.
 * @param context.profilePrivateCollectionFactory - Factory for creating private profile data subcollections.
 * @returns An async function that takes a UID and returns the created or existing ProfileDocument.
 */
export function initProfileForUidFactory({ profileCollection: profileFirestoreCollection, profilePrivateCollectionFactory }: ProfileServerActionsContext) {
  const { query: queryProfile } = profileFirestoreCollection;

  return async (uid: string) => {
    // init within a transaction.
    return profileFirestoreCollection.firestoreContext.runTransaction(async (transaction) => {
      const profile: Maybe<ProfileDocument> = profileFirestoreCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);

      const exists = await profile.accessor.exists();

      if (!exists) {
        let username = uid;
        const docs = await queryProfile(...profileWithUsernameQuery({ username })).getDocs(transaction);

        if (!docs.empty) {
          username = `${uid}-1`; // "-" isn't allowed in usernames by users, so this name should be safe.
        }

        // create the profile
        await profile.accessor.set({
          uid,
          username,
          resume: { state: ProfileResumeState.NONE },
          updatedAt: new Date()
        });

        // create the private profile data
        const profilePrivate = profilePrivateCollectionFactory(profile);
        await profilePrivate.loadDocument().accessor.set({
          usernameSetAt: new Date(),
          createdAt: new Date()
        });
      }

      return profile;
    });
  };
}

/**
 * Creates a server action factory that sets a profile's username within a transaction.
 * Normalizes the username to lowercase and checks for conflicts with existing profiles.
 * Updates the private data's usernameSetAt timestamp when changed.
 *
 * @param context
 * @param context.firebaseServerActionTransformFunctionFactory - Factory for creating validated action transform functions.
 * @param context.profileCollection - The Firestore collection accessor for profile documents.
 * @param context.profilePrivateCollectionFactory - Factory for creating private profile data subcollections.
 * @returns An action transform function that validates params and updates the username.
 * @throws {Error} UsernameAlreadyTakenError when the requested username belongs to another profile.
 */
export function setProfileUsernameFactory({ firebaseServerActionTransformFunctionFactory, profileCollection: profileFirestoreCollection, profilePrivateCollectionFactory }: ProfileServerActionsContext) {
  const { query: queryProfile } = profileFirestoreCollection;

  return firebaseServerActionTransformFunctionFactory(setProfileUsernameParamsType, async (params) => {
    const { username: inputUsername } = params;
    const username = inputUsername.toLowerCase();

    return async (document: ProfileDocument) => {
      const documentRef = document.documentRef;

      // perform the change in a transaction
      await profileFirestoreCollection.firestoreContext.runTransaction(async (transaction) => {
        // check that there are any conflicts with other profiles
        const conflictingDoc = await queryProfile(...profileWithUsernameQuery({ username })).getFirstDoc(transaction);

        if (conflictingDoc && conflictingDoc.id !== documentRef.id) {
          throw usernameAlreadyTakenError(username);
        }

        const documentInTransaction = profileFirestoreCollection.documentAccessorForTransaction(transaction).loadDocument(documentRef);
        const profilePrivateDocument = profilePrivateCollectionFactory(documentInTransaction).loadDocumentForTransaction(transaction);

        // update the username
        const snapshot = await documentInTransaction.snapshotData();

        // TODO: Can also check if the user is banned or not, etc.

        if (snapshot?.username !== username) {
          await documentInTransaction.accessor.set({ username }, { merge: true });

          // update the data on the accessor
          const profilePrivate = profilePrivateDocument;
          await profilePrivate.accessor.set(
            {
              usernameSetAt: new Date()
            },
            { merge: true }
          );
        }
      });

      return document;
    };
  });
}

/**
 * Creates a server action factory that updates editable profile fields (currently bio).
 * Performs a merge-set so only the provided fields are overwritten.
 *
 * @param context
 * @param context.firebaseServerActionTransformFunctionFactory - Factory for creating validated action transform functions.
 * @param context.profileCollection - The Firestore collection accessor for profile documents.
 * @returns An action transform function that validates params and updates the profile.
 */
export function updateProfileFactory({ firebaseServerActionTransformFunctionFactory, profileCollection: profileFirestoreCollection }: ProfileServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(updateProfileParamsType, async (params) => {
    const { bio } = params;

    return async (document: ProfileDocument) => {
      const documentRef = document.documentRef;

      const profile = profileFirestoreCollection.documentAccessor().loadDocument(documentRef);
      await profile.accessor.set({ bio }, { merge: true });
      return document;
    };
  });
}

/**
 * Creates a server action factory that generates a test notification for a profile.
 * Guards against creating too many test notifications (max 6) and optionally expedites sending.
 *
 * @param context - Server actions context providing notification and expedite services.
 * @returns An action transform function that creates a test notification document.
 * @throws {Error} When the profile already has more than 6 test notifications.
 */
export function createTestNotificationFactory(context: ProfileServerActionsContext) {
  const { notificationExpediteService, firebaseServerActionTransformFunctionFactory, notificationSummaryCollection } = context;

  return firebaseServerActionTransformFunctionFactory(profileCreateTestNotificationParamsType, async (params) => {
    const { skipSend, expediteSend } = params;

    return async (document: ProfileDocument) => {
      const expediteInstance = notificationExpediteService.expediteInstance();

      // load the existing notification summary if it exists and check number of
      const notificationSummaryId = twoWayFlatFirestoreModelKey(document.key);
      const notificationSummaryDocument = notificationSummaryCollection.documentAccessor().loadDocumentForId(notificationSummaryId);

      const notificationSummary = await notificationSummaryDocument.snapshotData();

      if ((notificationSummary?.n.length ?? 0) > 6) {
        throw new Error('Too many test notifications.');
      }

      // create a new notification
      const createResult = await createNotificationDocument({
        context,
        template: exampleNotificationTemplate({
          profileDocument: document,
          skipSend
        })
      });

      if (expediteSend) {
        expediteInstance.enqueueCreateResult(createResult);
        await expediteInstance.send();
      }

      return document;
    };
  });
}

/**
 * Creates a factory that adds a test event to the profile's calendar.
 *
 * THE WORKED EXAMPLE of the caller-owned Calendar write. There is no Calendar CRUD api, so this action
 * opens its OWN transaction, loads `cal/pr_<uid>` directly by its deterministic id, and either creates the
 * calendar from `calendarTemplate()` or merges `updateCalendarEventsTemplate()` into its own update. Both
 * templates carry `s: true`, so the event cannot be written without flagging the calendar for its next
 * publish.
 *
 * @param context - Server actions context providing the Firestore context and the calendar collection.
 * @returns An action transform function that adds an event to the profile's calendar.
 */
export function createTestCalendarEventFactory(context: ProfileServerActionsContext) {
  const { firestoreContext, calendarCollection, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(profileCreateTestCalendarEventParamsType, async (params) => {
    const { name, startsAt, durationMinutes, recurrenceRule } = params;

    return async (document: ProfileDocument) => {
      await firestoreContext.runTransaction(async (transaction) => {
        const now = new Date();
        const calendarDocument = calendarCollection.documentAccessorForTransaction(transaction).loadDocumentForId(calendarIdForModel(document.key));
        const calendar = await calendarDocument.snapshotData();

        const eventId = `e${now.getTime()}`;

        const item: CalendarEventItem = {
          id: eventId,
          sa: startsAt ?? now,
          dur: durationMinutes ?? 60,
          n: name ?? `Test Event ${eventId}`,
          cat: now,
          uat: now
        };

        const recurringItem: Maybe<CalendarRecurringEventItem> = recurrenceRule ? { ...item, rr: recurrenceRule, rfe: true } : undefined;

        if (calendar) {
          await calendarDocument.update(
            updateCalendarEventsTemplate({
              calendar,
              upsertEvents: recurringItem ? undefined : [item],
              upsertRecurringEvents: recurringItem ? [recurringItem] : undefined,
              now
            })
          );
        } else {
          await calendarDocument.create(
            calendarTemplate({
              calendarType: DEMO_PROFILE_CALENDAR_TYPE,
              name: 'Profile Calendar',
              ownerKey: document.key,
              events: recurringItem ? [] : [item],
              recurringEvents: recurringItem ? [recurringItem] : [],
              now
            })
          );
        }
      });

      return document;
    };
  });
}

/**
 * Creates a factory that rotates the public ICS link of the profile's calendar.
 *
 * Delegates ENTIRELY to the library's `rotateCalendarIcs` action: the Calendar owns the revocation, and this
 * action exists only so the operation has a callable surface, since the Calendar itself deliberately has
 * none. The profile's `owner` role gate on the callable is the authorization.
 *
 * The calendar may not exist yet, in which case there is nothing to rotate and the action is a no-op.
 *
 * @param context - Server actions context providing the calendar collection and the library calendar actions.
 * @returns An action transform function that rotates the profile calendar's ICS link.
 */
export function rotateCalendarIcsFactory(context: ProfileServerActionsContext) {
  const { calendarCollection, calendarServerActions, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(profileRotateCalendarIcsParamsType, async (_params) => {
    return async (document: ProfileDocument) => {
      const calendarDocument = calendarCollection.documentAccessor().loadDocumentForId(calendarIdForModel(document.key));
      const exists = await calendarDocument.accessor.exists();

      if (exists) {
        const rotateCalendarIcs = await calendarServerActions.rotateCalendarIcs({ key: calendarDocument.key });
        await rotateCalendarIcs(calendarDocument);
      }

      return document;
    };
  });
}
