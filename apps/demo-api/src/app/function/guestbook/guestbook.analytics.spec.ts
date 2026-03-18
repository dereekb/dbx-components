import { demoCallModel } from './../model/crud.functions';
import { type CreateGuestbookParams, guestbookIdentity } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { type OnCallCreateModelResult, onCallCreateModelParams } from '@dereekb/firebase';
import { ON_CALL_MODEL_ANALYTICS_SERVICE } from '@dereekb/firebase-server';
import { DemoAnalyticsHandler } from '../../common/model/analytics/demo.analytics.handler';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('guestbook analytics', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      it('should emit analytics events when creating a guestbook', async () => {
        const params: CreateGuestbookParams = {
          name: 'analyticsTest'
        };

        const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(guestbookIdentity, params))) as OnCallCreateModelResult;
        expect(result).toBeDefined();
        expect(result.modelKeys).toBeDefined();

        // Resolve the analytics service from the NestJS context
        const analyticsService = f.nest.get(ON_CALL_MODEL_ANALYTICS_SERVICE) as DemoAnalyticsHandler;
        expect(analyticsService).toBeDefined();
        expect(analyticsService).toBeInstanceOf(DemoAnalyticsHandler);

        // Only onSuccess is configured, so expect 1 event
        const guestbookEvents = analyticsService.events.filter((e) => e.event === 'Guestbook Created');
        expect(guestbookEvents).toHaveLength(1);

        const successEvent = guestbookEvents[0];
        expect(successEvent.lifecycle).toBe('success');
        expect(successEvent.call).toBe('create');
        expect(successEvent.modelType).toBe('guestbook');
        expect(successEvent.properties?.modelKeys).toBeDefined();
        expect(successEvent.properties?.modelKeys).toEqual(result.modelKeys);
      });
    });
  });
});
