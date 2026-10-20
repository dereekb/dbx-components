import { type AnalyticsEventData, type AnalyticsEventName } from '@dereekb/analytics';
import { DEFAULT_MCP_ANALYTICS_EVENT_NAME, MCP_DOCS_READ_ANALYTICS_EVENT_NAME, MCP_DOCS_READ_TOOL_NAME, MCP_DOCS_SEARCH_ANALYTICS_EVENT_NAME, MODEL_GET_TOOL_NAME } from '@dereekb/firebase-server/mcp';
import { DOCS_SECTION_NOT_FOUND_ERROR_CODE, FirebaseServerAnalyticsService } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';
import { guestbookIdentity } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext } from '../../../test/fixture';
import { callMcpMethod, callMcpTool, mcpCompactToolNames } from '../../../test/mcp';
import { DEMO_MCP_API_STATUS_TOOL_NAME } from './mcp.module';
import { DEMO_MCP_MODEL_VIEWED_ANALYTICS_EVENT_NAME, DEMO_MCP_STATUS_TOOL_GROUP } from './mcp.analytics';
import { DEMO_NOTIFICATION_TYPES_DOC_ID } from '../docs/docs.notification';

vi.setConfig({ hookTimeout: 40000, testTimeout: 40000 });

interface CapturedAnalyticsEvent {
  readonly uid: Maybe<string>;
  readonly name: AnalyticsEventName;
  readonly data: AnalyticsEventData;
}

/**
 * The MCP events the demo's per-tool analytics configs send. Other events (e.g. callModel analytics) are ignored.
 */
const MCP_EVENT_NAMES = new Set<string>([DEFAULT_MCP_ANALYTICS_EVENT_NAME, MCP_DOCS_SEARCH_ANALYTICS_EVENT_NAME, MCP_DOCS_READ_ANALYTICS_EVENT_NAME, DEMO_MCP_MODEL_VIEWED_ANALYTICS_EVENT_NAME]);

/**
 * End-to-end coverage for demo-api's per-tool MCP analytics (`demoMcpAnalyticsToolConfigs`), and an example of how an app
 * tests its own configs: patch the app's `FirebaseServerAnalyticsService.sendEventData` to capture what it is sent.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('MCP per-tool analytics', () => {
    demoAuthorizedUserAdminContext({ f }, (u) => {
      let captured: CapturedAnalyticsEvent[];
      let originalSendEventData: FirebaseServerAnalyticsService['sendEventData'];

      beforeEach(() => {
        captured = [];

        const analyticsService = f.nest.get(FirebaseServerAnalyticsService);

        if (!originalSendEventData) {
          originalSendEventData = analyticsService.sendEventData.bind(analyticsService);
        }

        analyticsService.sendEventData = (uid, name, data) => {
          if (MCP_EVENT_NAMES.has(name)) {
            captured.push({ uid, name, data });
          }

          originalSendEventData(uid, name, data);
        };
      });

      it('sends only a Docs Search event for a docs search', async () => {
        const result = await callMcpTool({ f, u, name: mcpCompactToolNames(f).documentation, args: { query: 'notification types' } });
        expect(result.isError).toBeUndefined();

        expect(captured.map((x) => x.name)).toEqual([MCP_DOCS_SEARCH_ANALYTICS_EVENT_NAME]);
        expect(captured[0].uid).toBe(u.uid);
        expect(captured[0].data).toMatchObject({ query: 'notification types', success: true });
        expect(captured[0].data['total']).toBeGreaterThan(0);
        expect(typeof captured[0].data['topResultId']).toBe('string');
        expect(captured[0].data['topResultId']).not.toBe('');
      });

      it('sends a Docs Read event with the error code for a missing section', async () => {
        const result = await callMcpMethod({ f, u, kind: 'read', method: MCP_DOCS_READ_TOOL_NAME, params: { id: DEMO_NOTIFICATION_TYPES_DOC_ID, section: 'not-a-section' } });
        expect(result.isError).toBe(true);

        expect(captured.map((x) => x.name)).toEqual([MCP_DOCS_READ_ANALYTICS_EVENT_NAME]);
        expect(captured[0].data).toMatchObject({ id: DEMO_NOTIFICATION_TYPES_DOC_ID, section: 'not-a-section', success: false, errorCode: DOCS_SECTION_NOT_FOUND_ERROR_CODE });
      });

      it('merges toolGroup into the default event of demo_api_status, direct and routed', async () => {
        await callMcpTool({ f, u, name: DEMO_MCP_API_STATUS_TOOL_NAME, args: {} });
        await callMcpMethod({ f, u, kind: 'read', method: DEMO_MCP_API_STATUS_TOOL_NAME, params: {} });

        expect(captured.map((x) => x.name)).toEqual([DEFAULT_MCP_ANALYTICS_EVENT_NAME, DEFAULT_MCP_ANALYTICS_EVENT_NAME]);
        expect(captured[0].data).toMatchObject({ tool: DEMO_MCP_API_STATUS_TOOL_NAME, routed: false, toolGroup: DEMO_MCP_STATUS_TOOL_GROUP });
        expect(captured[1].data).toMatchObject({ method: DEMO_MCP_API_STATUS_TOOL_NAME, routed: true, toolGroup: DEMO_MCP_STATUS_TOOL_GROUP });
      });

      it('adds durationMs to the default event of guestbook.create', async () => {
        const result = await callMcpMethod({ f, u, kind: 'write', method: 'guestbook.create', params: { name: 'analyticsDuration' } });
        expect(result.isError).toBeUndefined();

        expect(captured.map((x) => x.name)).toEqual([DEFAULT_MCP_ANALYTICS_EVENT_NAME]);
        expect(captured[0].data).toMatchObject({ method: 'guestbook.create', success: true });
        expect(typeof captured[0].data['durationMs']).toBe('number');
      });

      it('sends the default event and Mcp Model Viewed for model-get', async () => {
        const key = `${guestbookIdentity.collectionName}/missing`;
        await callMcpMethod({ f, u, kind: 'read', method: MODEL_GET_TOOL_NAME, params: { modelType: guestbookIdentity.modelType, keys: [key] } });

        expect(captured.map((x) => x.name)).toEqual([DEFAULT_MCP_ANALYTICS_EVENT_NAME, DEMO_MCP_MODEL_VIEWED_ANALYTICS_EVENT_NAME]);
        expect(captured[0].data).toMatchObject({ method: MODEL_GET_TOOL_NAME });
        expect(captured[1].data).toEqual({ keys: key });
      });
    });
  });
});
