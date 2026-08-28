import { type RotateCalendarIcsParams, type RotateCalendarIcsResult, rotateCalendarIcsParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoUpdateModelFunction } from '../function.context';

/**
 * Rotates a Calendar's public ICS feed url, revoking the previous one.
 *
 * Gated on the Calendar's own `rotate` role rather than the owning model's: the feed url is a bearer
 * credential the Calendar minted, so `Calendar.o` is the authoritative answer to "who may revoke it".
 * Callables run through firebase-admin and bypass firestore.rules entirely, which is why this role gate —
 * and not the rules file — is the authorization.
 *
 * A calendar that has never been created has nothing to revoke and no owner to authorize against, so
 * `useModel` rejects the key rather than reporting a silent success.
 */
export const calendarUpdateRotateIcs: DemoUpdateModelFunction<RotateCalendarIcsParams, RotateCalendarIcsResult> = withApiDetails({
  inputType: rotateCalendarIcsParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const rotateCalendarIcs = await nest.calendarServerActions.rotateCalendarIcs(data);
    const calendarDocument = await nest.useModel('calendar', {
      request,
      key: data.key,
      roles: 'rotate',
      use: (x) => x.document
    });

    return rotateCalendarIcs(calendarDocument);
  }
});
