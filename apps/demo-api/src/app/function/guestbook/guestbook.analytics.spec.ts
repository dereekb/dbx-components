import { demoCallModel } from './../model/crud.functions';
import { type CreateGuestbookParams, guestbookIdentity } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { type OnCallCreateModelResult, onCallCreateModelParams } from '@dereekb/firebase';
import { FirebaseServerAnalyticsService, ON_CALL_MODEL_ANALYTICS_SERVICE, type OnCallModelAnalyticsEvent } from '@dereekb/firebase-server';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('guestbook analytics', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      let capturedEvents: OnCallModelAnalyticsEvent[];
      let originalHandleEvent: (event: OnCallModelAnalyticsEvent) => void;

      beforeEach(() => {
        capturedEvents = [];
        const analyticsService = f.nest.get(FirebaseServerAnalyticsService);

        if (!originalHandleEvent) {
          originalHandleEvent = analyticsService.handleOnCallAnalyticsEvent.bind(analyticsService);
        }

        analyticsService.handleOnCallAnalyticsEvent = (event: OnCallModelAnalyticsEvent) => {
          capturedEvents.push(event);
          originalHandleEvent(event);
        };
      });

      it('should verify analytics service is wired up via token', () => {
        const analyticsService = f.nest.get(FirebaseServerAnalyticsService);
        const tokenService = f.nest.get(ON_CALL_MODEL_ANALYTICS_SERVICE);
        expect(tokenService).toBe(analyticsService);
      });

      it('should emit onTriggered, onSuccess, and onComplete events when creating a guestbook', async () => {
        const params: CreateGuestbookParams = {
          name: 'analyticsTest'
        };

        const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(guestbookIdentity, params))) as OnCallCreateModelResult;
        expect(result).toBeDefined();
        expect(result.modelKeys).toBeDefined();

        // Verify onTriggered
        const triggeredEvents = capturedEvents.filter((e) => e.event === 'Guestbook Create Triggered');
        expect(triggeredEvents).toHaveLength(1);
        expect(triggeredEvents[0].lifecycle).toBe('triggered');

        // Verify onSuccess
        const successEvents = capturedEvents.filter((e) => e.event === 'Guestbook Created');
        expect(successEvents).toHaveLength(1);
        expect(successEvents[0].lifecycle).toBe('success');
        expect(successEvents[0].call).toBe('create');
        expect(successEvents[0].modelType).toBe('guestbook');
        expect(successEvents[0].properties?.modelKeys).toEqual(result.modelKeys);

        // Verify onComplete
        const completeEvents = capturedEvents.filter((e) => e.event === 'Guestbook Create Complete');
        expect(completeEvents).toHaveLength(1);
        expect(completeEvents[0].lifecycle).toBe('complete');
      });

      it('should emit onError and onComplete events when create fails with invalid input', async () => {
        // Pass invalid params (missing required name) to trigger a validation error
        let caughtError: unknown;

        try {
          await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(guestbookIdentity, {} as any));
        } catch (e) {
          caughtError = e;
        }

        expect(caughtError).toBeDefined();

        // Verify onTriggered still fires before the error
        const triggeredEvents = capturedEvents.filter((e) => e.event === 'Guestbook Create Triggered');
        expect(triggeredEvents).toHaveLength(1);
        expect(triggeredEvents[0].lifecycle).toBe('triggered');

        // Verify onError was emitted
        const errorEvents = capturedEvents.filter((e) => e.event === 'Guestbook Create Failed');
        expect(errorEvents).toHaveLength(1);
        expect(errorEvents[0].lifecycle).toBe('error');

        // Verify onComplete still fires on error
        const completeEvents = capturedEvents.filter((e) => e.event === 'Guestbook Create Complete');
        expect(completeEvents).toHaveLength(1);
        expect(completeEvents[0].lifecycle).toBe('complete');
      });
    });
  });
});
