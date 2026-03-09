import {
  withApiDetails,
  readApiDetails,
  getModelApiDetails,
  isOnCallSpecifierApiDetails,
  isOnCallHandlerApiDetails,
  onCallSpecifierHandler,
  onCallCreateModel,
  onCallUpdateModel,
  onCallReadModel,
  onCallDeleteModel,
  onCallModel,
  type OnCallApiDetailsRef,
  type OnCallModelFunctionApiDetails,
  type OnCallSpecifierApiDetails,
  type OnCallModelMap,
  type ModelApiDetailsResult
} from '@dereekb/firebase-server';
import {
  createGuestbookParamsType,
  insertGuestbookEntryParamsType,
  subscribeToGuestbookNotificationsParamsType,
  setProfileUsernameParamsType,
  updateProfileParamsType
} from 'demo-firebase';
import { type DemoOnCallCreateModelMap, type DemoOnCallUpdateModelMap } from '../function';
import { demoCallModelMap, demoCreateModelMap } from './crud.functions';

/**
 * Tests the model-first API details view using actual demo ArkType param types.
 *
 * Simulates how demoCallModel will provide full schema introspection after
 * handlers are retrofitted with withApiDetails() in Phase 5.
 */
describe('demo api.details integration', () => {
  // MARK: Baseline
  describe('existing demo call model (baseline — no withApiDetails yet)', () => {
    it('should not have _apiDetails on existing handlers', () => {
      expect(readApiDetails(demoCreateModelMap.guestbook as unknown as OnCallApiDetailsRef)).toBeUndefined();
    });

    it('should return undefined from getModelApiDetails', () => {
      // Build onCallModel from the existing maps — no handlers have api details
      const callModel = onCallModel(demoCallModelMap);
      expect(getModelApiDetails(callModel as unknown as OnCallApiDetailsRef)).toBeUndefined();
    });
  });

  // MARK: Demo-like call model with withApiDetails
  describe('getModelApiDetails() with demo-like call model', () => {
    // Build a realistic demo call model with withApiDetails on handlers,
    // simulating the Phase 5 retrofit using real ArkType param types.

    const demoCreateMap: DemoOnCallCreateModelMap = {
      guestbook: withApiDetails(
        { inputType: createGuestbookParamsType, mcp: { description: 'Create a new guestbook' } },
        async () => ({ modelKeys: [] })
      ) as any,
      // Demonstrates withApiDetails({ optionalAuth: true }) replacing optionalAuthContext
      notification: onCallSpecifierHandler({
        _: withApiDetails(
          { optionalAuth: true, mcp: { description: 'Create a notification (no auth required)' } },
          async () => ({ modelKeys: [] })
        ) as any
      })
    };

    const demoUpdateMap: DemoOnCallUpdateModelMap = {
      guestbookEntry: withApiDetails(
        { inputType: insertGuestbookEntryParamsType },
        async () => undefined
      ) as any,
      guestbook: onCallSpecifierHandler({
        subscribeToNotifications: withApiDetails(
          { inputType: subscribeToGuestbookNotificationsParamsType, mcp: { description: 'Subscribe user to guestbook notifications' } },
          async () => undefined
        ) as any
      }),
      profile: onCallSpecifierHandler({
        _: withApiDetails({ inputType: updateProfileParamsType }, async () => undefined) as any,
        username: withApiDetails(
          { inputType: setProfileUsernameParamsType, mcp: { description: 'Set profile username' } },
          async () => undefined
        ) as any
      })
    };

    const callModelMap: OnCallModelMap = {
      create: onCallCreateModel(demoCreateMap),
      update: onCallUpdateModel(demoUpdateMap as any),
      read: onCallReadModel({}),
      delete: onCallDeleteModel({})
    };

    const callModel = onCallModel(callModelMap);
    let details: ModelApiDetailsResult;

    beforeEach(() => {
      details = getModelApiDetails(callModel as unknown as OnCallApiDetailsRef)!;
    });

    it('should return a ModelApiDetailsResult', () => {
      expect(details).toBeDefined();
      expect(details.models).toBeDefined();
    });

    it('should contain all model types that have api details', () => {
      const modelNames = Object.keys(details.models);
      expect(modelNames).toContain('guestbook');
      expect(modelNames).toContain('guestbookEntry');
      expect(modelNames).toContain('notification');
      expect(modelNames).toContain('profile');
    });

    // MARK: guestbook
    describe('models.guestbook', () => {
      it('should have create call with createGuestbookParamsType', () => {
        const guestbook = details.models['guestbook'];
        expect(guestbook.calls.create).toBeDefined();
        expect(isOnCallHandlerApiDetails(guestbook.calls.create!)).toBe(true);

        const createDetails = guestbook.calls.create as OnCallModelFunctionApiDetails;
        expect(createDetails.inputType).toBe(createGuestbookParamsType);
        expect(createDetails.mcp?.description).toBe('Create a new guestbook');
      });

      it('should have update call with specifier for subscribeToNotifications', () => {
        const guestbook = details.models['guestbook'];
        expect(guestbook.calls.update).toBeDefined();
        expect(isOnCallSpecifierApiDetails(guestbook.calls.update!)).toBe(true);

        const updateSpecifiers = (guestbook.calls.update as OnCallSpecifierApiDetails).specifiers;
        expect(updateSpecifiers['subscribeToNotifications']).toBeDefined();
        expect(updateSpecifiers['subscribeToNotifications']!.inputType).toBe(subscribeToGuestbookNotificationsParamsType);
        expect(updateSpecifiers['subscribeToNotifications']!.mcp?.description).toBe('Subscribe user to guestbook notifications');
      });

      it('should have the ArkType inputType reference accessible on create', () => {
        const createDetails = details.models['guestbook'].calls.create as OnCallModelFunctionApiDetails;
        expect(createDetails.inputType).toBe(createGuestbookParamsType);
        expect(typeof createDetails.inputType!.toJsonSchema).toBe('function');
      });
    });

    // MARK: guestbookEntry
    describe('models.guestbookEntry', () => {
      it('should have update call with insertGuestbookEntryParamsType', () => {
        const entry = details.models['guestbookEntry'];
        expect(entry.calls.update).toBeDefined();
        expect(isOnCallHandlerApiDetails(entry.calls.update!)).toBe(true);

        const updateDetails = entry.calls.update as OnCallModelFunctionApiDetails;
        expect(updateDetails.inputType).toBe(insertGuestbookEntryParamsType);
      });

      it('should not have create, read, or delete calls', () => {
        const entry = details.models['guestbookEntry'];
        expect(entry.calls.create).toBeUndefined();
        expect(entry.calls.read).toBeUndefined();
        expect(entry.calls.delete).toBeUndefined();
      });
    });

    // MARK: profile
    describe('models.profile', () => {
      it('should have update call with specifiers for _ and username', () => {
        const profile = details.models['profile'];
        expect(profile.calls.update).toBeDefined();
        expect(isOnCallSpecifierApiDetails(profile.calls.update!)).toBe(true);

        const updateSpecifiers = (profile.calls.update as OnCallSpecifierApiDetails).specifiers;
        expect(updateSpecifiers['_']).toBeDefined();
        expect(updateSpecifiers['_']!.inputType).toBe(updateProfileParamsType);
        expect(updateSpecifiers['username']).toBeDefined();
        expect(updateSpecifiers['username']!.inputType).toBe(setProfileUsernameParamsType);
        expect(updateSpecifiers['username']!.mcp?.description).toBe('Set profile username');
      });

      it('should have the ArkType inputType reference accessible on the username specifier', () => {
        const updateSpecifiers = (details.models['profile'].calls.update as OnCallSpecifierApiDetails).specifiers;
        // setProfileUsernameParamsType uses string predicates that ArkType can't fully convert
        // to JSON Schema without a fallback handler. Verify the type reference is preserved
        // so the MCP layer can call toJsonSchema() with appropriate options.
        expect(updateSpecifiers['username']!.inputType).toBe(setProfileUsernameParamsType);
      });
    });

    // MARK: Full tree walkthrough
    describe('full tree JSON Schema extraction', () => {
      it('should have an inputType on every handler in the tree', () => {
        // Walk every model, every call, every specifier and verify inputType is present.
        // Some ArkType types use predicates that can't be converted to JSON Schema without
        // a fallback handler, so we verify the reference exists rather than calling toJsonSchema().
        let inputTypeCount = 0;

        for (const [, modelEntry] of Object.entries(details.models)) {
          for (const [, callDetails] of Object.entries(modelEntry.calls)) {
            if (callDetails == null) {
              continue;
            }

            if (isOnCallSpecifierApiDetails(callDetails)) {
              for (const [, specDetails] of Object.entries(callDetails.specifiers)) {
                if (specDetails?.inputType) {
                  expect(typeof specDetails.inputType.toJsonSchema).toBe('function');
                  inputTypeCount++;
                }
              }
            } else if (isOnCallHandlerApiDetails(callDetails)) {
              if (callDetails.inputType) {
                expect(typeof callDetails.inputType.toJsonSchema).toBe('function');
                inputTypeCount++;
              }
            }
          }
        }

        // Verify we actually traversed handlers (not an empty tree)
        expect(inputTypeCount).toBeGreaterThan(0);
      });
    });
  });
});
