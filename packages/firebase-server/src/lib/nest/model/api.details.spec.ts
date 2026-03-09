import { withApiDetails, readApiDetails, getModelApiDetails, isOnCallSpecifierApiDetails, isOnCallCrudModelApiDetails, isOnCallHandlerApiDetails, aggregateSpecifierApiDetails, aggregateCrudModelApiDetails, aggregateModelApiDetails, type OnCallModelFunctionApiDetails, type OnCallSpecifierApiDetails, type OnCallCrudModelApiDetails, type OnCallModelApiDetails, type JsonSchemaRef, type OnCallApiDetailsRef, type OnCallModelFunctionApiDetailsRef } from './api.details';
import { onCallSpecifierHandler } from './specifier.function';
import { onCallCreateModel, type OnCallCreateModelMap } from './create.model.function';
import { onCallUpdateModel } from './update.model.function';
import { onCallReadModel } from './read.model.function';
import { onCallDeleteModel } from './delete.model.function';
import { onCallModel, type OnCallModelMap } from './call.model.function';

// MARK: Test Helpers
function mockJsonSchemaRef(typeName: string): JsonSchemaRef {
  return {
    toJsonSchema: () => ({ type: 'object', title: typeName })
  };
}

function mockHandler(): ((...args: any[]) => any) & { _requireAuth: false } {
  const fn = async () => ({ modelKeys: [] });
  (fn as any)._requireAuth = false;
  return fn as any;
}

// MARK: Tests
describe('api.details', () => {
  // MARK: withApiDetails

  describe('withApiDetails()', () => {
    it('should attach _apiDetails to a function', () => {
      const inputType = mockJsonSchemaRef('TestInput');
      const handler = mockHandler();
      const wrapped = withApiDetails({ inputType, fn: handler });

      expect(wrapped._apiDetails).toBeDefined();
      expect(wrapped._apiDetails!.inputType).toBe(inputType);
    });

    it('should attach inputType and outputType', () => {
      const inputType = mockJsonSchemaRef('TestInput');
      const outputType = mockJsonSchemaRef('TestOutput');
      const wrapped = withApiDetails({ inputType, outputType, fn: mockHandler() });

      expect(wrapped._apiDetails!.inputType).toBe(inputType);
      expect(wrapped._apiDetails!.outputType).toBe(outputType);
    });

    it('should attach mcp details', () => {
      const mcp = { description: 'Create a widget', name: 'widget-create' };
      const wrapped = withApiDetails({ mcp, fn: mockHandler() });

      expect(wrapped._apiDetails!.mcp).toBe(mcp);
      expect(wrapped._apiDetails!.mcp!.description).toBe('Create a widget');
      expect(wrapped._apiDetails!.mcp!.name).toBe('widget-create');
    });

    it('should preserve the original function behavior', async () => {
      const wrapped = withApiDetails({ inputType: mockJsonSchemaRef('Test'), fn: mockHandler() });
      const result = await wrapped({} as any);
      expect(result).toBeDefined();
    });

    it('should return the same function reference', () => {
      const handler = mockHandler();
      const wrapped = withApiDetails({ fn: handler });
      expect(wrapped).toBe(handler);
    });
  });

  // MARK: readApiDetails
  describe('readApiDetails()', () => {
    it('should return _apiDetails from a wrapped function', () => {
      const details: OnCallModelFunctionApiDetails = { inputType: mockJsonSchemaRef('Test') };
      const handler = withApiDetails({ ...details, fn: mockHandler() });
      expect(readApiDetails(handler)).toBe(details);
    });

    it('should return undefined from an unwrapped function', () => {
      expect(readApiDetails(mockHandler() as any)).toBeUndefined();
    });

    it('should return undefined for null/undefined', () => {
      expect(readApiDetails(null)).toBeUndefined();
      expect(readApiDetails(undefined)).toBeUndefined();
    });
  });

  // MARK: Type Guards
  describe('type guards', () => {
    it('isOnCallHandlerApiDetails should identify handler-level details', () => {
      const details: OnCallModelFunctionApiDetails = { inputType: mockJsonSchemaRef('Test') };
      expect(isOnCallHandlerApiDetails(details)).toBe(true);
      expect(isOnCallSpecifierApiDetails(details)).toBe(false);
      expect(isOnCallCrudModelApiDetails(details)).toBe(false);
    });

    it('isOnCallSpecifierApiDetails should identify specifier-level details', () => {
      const details: OnCallSpecifierApiDetails = { specifiers: { _: { inputType: mockJsonSchemaRef('Test') } } };
      expect(isOnCallSpecifierApiDetails(details)).toBe(true);
      expect(isOnCallHandlerApiDetails(details)).toBe(false);
    });

    it('isOnCallCrudModelApiDetails should identify CRUD-model-level details', () => {
      const details: OnCallCrudModelApiDetails = { modelTypes: { profile: { inputType: mockJsonSchemaRef('Test') } } };
      expect(isOnCallCrudModelApiDetails(details)).toBe(true);
      expect(isOnCallHandlerApiDetails(details)).toBe(false);
      expect(isOnCallSpecifierApiDetails(details)).toBe(false);
    });

    it('isOnCallHandlerApiDetails should return true for empty details', () => {
      const details: OnCallModelFunctionApiDetails = {};
      expect(isOnCallHandlerApiDetails(details)).toBe(true);
    });
  });

  // MARK: Aggregation Utilities
  describe('aggregateSpecifierApiDetails()', () => {
    it('should aggregate details from config entries', () => {
      const inputA = mockJsonSchemaRef('A');
      const inputB = mockJsonSchemaRef('B');

      const result = aggregateSpecifierApiDetails({
        _: { _apiDetails: { inputType: inputA } } as OnCallModelFunctionApiDetailsRef,
        custom: { _apiDetails: { inputType: inputB } } as OnCallModelFunctionApiDetailsRef
      });

      expect(result).toBeDefined();
      expect(result!.specifiers['_']!.inputType).toBe(inputA);
      expect(result!.specifiers['custom']!.inputType).toBe(inputB);
    });

    it('should return undefined when no entries have details', () => {
      const result = aggregateSpecifierApiDetails({
        _: {} as any,
        custom: null
      });
      expect(result).toBeUndefined();
    });

    it('should skip entries without _apiDetails', () => {
      const inputA = mockJsonSchemaRef('A');
      const result = aggregateSpecifierApiDetails({
        _: { _apiDetails: { inputType: inputA } } as OnCallModelFunctionApiDetailsRef,
        noDetails: {} as any
      });

      expect(result).toBeDefined();
      expect(result!.specifiers['_']).toBeDefined();
      expect(result!.specifiers['noDetails']).toBeUndefined();
    });
  });

  describe('aggregateCrudModelApiDetails()', () => {
    it('should aggregate from model type map', () => {
      const inputType = mockJsonSchemaRef('Params');
      const result = aggregateCrudModelApiDetails({
        profile: { _apiDetails: { inputType } } as OnCallApiDetailsRef
      });

      expect(result).toBeDefined();
      expect(result!.modelTypes['profile']).toBeDefined();
    });

    it('should return undefined when no entries have details', () => {
      const result = aggregateCrudModelApiDetails({
        profile: {} as any
      });
      expect(result).toBeUndefined();
    });
  });

  describe('aggregateModelApiDetails()', () => {
    it('should aggregate from call model map', () => {
      const crudDetails: OnCallCrudModelApiDetails = { modelTypes: { widget: { inputType: mockJsonSchemaRef('X') } } };
      const result = aggregateModelApiDetails({
        create: { _apiDetails: crudDetails } as OnCallApiDetailsRef
      });

      expect(result).toBeDefined();
      expect(result!.create).toBe(crudDetails);
    });

    it('should return undefined when no entries have details', () => {
      const result = aggregateModelApiDetails({
        create: {} as any,
        read: {} as any
      });
      expect(result).toBeUndefined();
    });
  });

  // MARK: Integration — routing functions
  describe('onCallSpecifierHandler aggregation', () => {
    it('should aggregate _apiDetails from handlers', () => {
      const inputTypeA = mockJsonSchemaRef('ParamsA');
      const inputTypeB = mockJsonSchemaRef('ParamsB');

      const handlerA = withApiDetails({ inputType: inputTypeA, fn: mockHandler() });
      const handlerB = withApiDetails({ inputType: inputTypeB, fn: mockHandler() });

      const specifierHandler = onCallSpecifierHandler({
        _: handlerA as any,
        custom: handlerB as any
      });

      const details = readApiDetails(specifierHandler as unknown as OnCallApiDetailsRef);

      expect(details).toBeDefined();
      expect(isOnCallSpecifierApiDetails(details!)).toBe(true);

      const specDetails = details as OnCallSpecifierApiDetails;
      expect(specDetails.specifiers['_']!.inputType).toBe(inputTypeA);
      expect(specDetails.specifiers['custom']!.inputType).toBe(inputTypeB);
    });

    it('should not attach _apiDetails when no handlers have them', () => {
      const specifierHandler = onCallSpecifierHandler({
        _: mockHandler() as any,
        other: mockHandler() as any
      });

      const details = readApiDetails(specifierHandler as unknown as OnCallApiDetailsRef);
      expect(details).toBeUndefined();
    });

    it('should only include handlers that have api details', () => {
      const inputType = mockJsonSchemaRef('Params');
      const specifierHandler = onCallSpecifierHandler({
        _: withApiDetails({ inputType, fn: mockHandler() }) as any,
        noDetails: mockHandler() as any
      });

      const details = readApiDetails(specifierHandler as unknown as OnCallApiDetailsRef) as OnCallSpecifierApiDetails;
      expect(details.specifiers['_']).toBeDefined();
      expect(details.specifiers['noDetails']).toBeUndefined();
    });
  });

  describe('onCallCreateModel aggregation', () => {
    it('should aggregate from direct handlers', () => {
      const inputType = mockJsonSchemaRef('CreateParams');
      const handler = withApiDetails({ inputType, fn: mockHandler() });

      const createModel = onCallCreateModel({ widget: handler } as OnCallCreateModelMap<any>);
      const details = readApiDetails(createModel as unknown as OnCallApiDetailsRef) as OnCallCrudModelApiDetails;

      expect(details).toBeDefined();
      expect(isOnCallCrudModelApiDetails(details)).toBe(true);
      expect((details.modelTypes['widget'] as OnCallModelFunctionApiDetails).inputType).toBe(inputType);
    });

    it('should aggregate from specifier handlers', () => {
      const inputTypeA = mockJsonSchemaRef('DefaultParams');
      const inputTypeB = mockJsonSchemaRef('CustomParams');

      const specHandler = onCallSpecifierHandler({
        _: withApiDetails({ inputType: inputTypeA, fn: mockHandler() }) as any,
        custom: withApiDetails({ inputType: inputTypeB, fn: mockHandler() }) as any
      });

      const createModel = onCallCreateModel({ widget: specHandler } as OnCallCreateModelMap<any>);
      const details = readApiDetails(createModel as unknown as OnCallApiDetailsRef) as OnCallCrudModelApiDetails;

      expect(details).toBeDefined();
      expect(isOnCallSpecifierApiDetails(details.modelTypes['widget']!)).toBe(true);

      const specDetails = details.modelTypes['widget'] as OnCallSpecifierApiDetails;
      expect(specDetails.specifiers['_']!.inputType).toBe(inputTypeA);
      expect(specDetails.specifiers['custom']!.inputType).toBe(inputTypeB);
    });
  });

  describe('onCallModel full tree aggregation', () => {
    it('should aggregate across all CRUD operations', () => {
      const createInput = mockJsonSchemaRef('CreateParams');
      const updateInput = mockJsonSchemaRef('UpdateParams');
      const readInput = mockJsonSchemaRef('ReadParams');

      const callModelMap: OnCallModelMap = {
        create: onCallCreateModel({ widget: withApiDetails({ inputType: createInput, fn: mockHandler() }) } as OnCallCreateModelMap<any>),
        update: onCallUpdateModel({ widget: withApiDetails({ inputType: updateInput, fn: mockHandler() }) } as any),
        read: onCallReadModel({ widget: withApiDetails({ inputType: readInput, fn: mockHandler() }) } as any),
        delete: onCallDeleteModel({})
      };

      const callModel = onCallModel(callModelMap);
      const details = readApiDetails(callModel as unknown as OnCallApiDetailsRef) as OnCallModelApiDetails;

      expect(details).toBeDefined();
      expect(details.create).toBeDefined();
      expect(details.update).toBeDefined();
      expect(details.read).toBeDefined();
      expect(details.delete).toBeUndefined(); // empty map, no handlers

      const createDetails = details.create as OnCallCrudModelApiDetails;
      expect((createDetails.modelTypes['widget'] as OnCallModelFunctionApiDetails).inputType).toBe(createInput);
    });

    it('should build a complete tree with mixed direct and specifier handlers', () => {
      const directInput = mockJsonSchemaRef('DirectParams');
      const specInputA = mockJsonSchemaRef('SpecAParams');
      const specInputB = mockJsonSchemaRef('SpecBParams');

      const specHandler = onCallSpecifierHandler({
        _: withApiDetails({ inputType: specInputA, fn: mockHandler() }) as any,
        variant: withApiDetails({ inputType: specInputB, fn: mockHandler() }) as any
      });

      const callModelMap: OnCallModelMap = {
        create: onCallCreateModel({
          simple: withApiDetails({ inputType: directInput, fn: mockHandler() }),
          complex: specHandler
        } as OnCallCreateModelMap<any>),
        read: onCallReadModel({}),
        update: onCallUpdateModel({} as any),
        delete: onCallDeleteModel({})
      };

      const callModel = onCallModel(callModelMap);
      const details = readApiDetails(callModel as unknown as OnCallApiDetailsRef) as OnCallModelApiDetails;
      const createDetails = details.create as OnCallCrudModelApiDetails;

      // Direct handler
      expect(isOnCallHandlerApiDetails(createDetails.modelTypes['simple']!)).toBe(true);
      expect((createDetails.modelTypes['simple'] as OnCallModelFunctionApiDetails).inputType).toBe(directInput);

      // Specifier handler
      expect(isOnCallSpecifierApiDetails(createDetails.modelTypes['complex']!)).toBe(true);
      const complexDetails = createDetails.modelTypes['complex'] as OnCallSpecifierApiDetails;
      expect(complexDetails.specifiers['_']!.inputType).toBe(specInputA);
      expect(complexDetails.specifiers['variant']!.inputType).toBe(specInputB);
    });
  });

  // MARK: getModelApiDetails
  describe('getModelApiDetails()', () => {
    it('should pivot CRUD-first tree into model-first tree', () => {
      const createInput = mockJsonSchemaRef('CreateWidgetParams');
      const updateInput = mockJsonSchemaRef('UpdateWidgetParams');

      const callModelMap: OnCallModelMap = {
        create: onCallCreateModel({ widget: withApiDetails({ inputType: createInput, fn: mockHandler() }) } as OnCallCreateModelMap<any>),
        update: onCallUpdateModel({ widget: withApiDetails({ inputType: updateInput, fn: mockHandler() }) } as any),
        read: onCallReadModel({}),
        delete: onCallDeleteModel({})
      };

      const callModel = onCallModel(callModelMap);
      const result = getModelApiDetails(callModel as unknown as OnCallApiDetailsRef);

      expect(result).toBeDefined();
      expect(result!.models['widget']).toBeDefined();
      expect(result!.models['widget'].calls.create).toBeDefined();
      expect(result!.models['widget'].calls.update).toBeDefined();
      expect(result!.models['widget'].calls.read).toBeUndefined();
      expect(result!.models['widget'].calls.delete).toBeUndefined();

      expect((result!.models['widget'].calls.create as OnCallModelFunctionApiDetails).inputType).toBe(createInput);
      expect((result!.models['widget'].calls.update as OnCallModelFunctionApiDetails).inputType).toBe(updateInput);
    });

    it('should group multiple model types from different CRUD operations', () => {
      const createWidgetInput = mockJsonSchemaRef('CreateWidgetParams');
      const updateGadgetInput = mockJsonSchemaRef('UpdateGadgetParams');

      const callModelMap: OnCallModelMap = {
        create: onCallCreateModel({ widget: withApiDetails({ inputType: createWidgetInput, fn: mockHandler() }) } as OnCallCreateModelMap<any>),
        update: onCallUpdateModel({ gadget: withApiDetails({ inputType: updateGadgetInput, fn: mockHandler() }) } as any),
        read: onCallReadModel({}),
        delete: onCallDeleteModel({})
      };

      const callModel = onCallModel(callModelMap);
      const result = getModelApiDetails(callModel as unknown as OnCallApiDetailsRef)!;

      expect(Object.keys(result.models)).toHaveLength(2);
      expect(result.models['widget'].calls.create).toBeDefined();
      expect(result.models['widget'].calls.update).toBeUndefined();
      expect(result.models['gadget'].calls.update).toBeDefined();
      expect(result.models['gadget'].calls.create).toBeUndefined();
    });

    it('should preserve specifier details in model-first view', () => {
      const specInputA = mockJsonSchemaRef('DefaultParams');
      const specInputB = mockJsonSchemaRef('CustomParams');

      const specHandler = onCallSpecifierHandler({
        _: withApiDetails({ inputType: specInputA, fn: mockHandler() }) as any,
        custom: withApiDetails({ inputType: specInputB, mcp: { description: 'Custom operation' }, fn: mockHandler() }) as any
      });

      const callModelMap: OnCallModelMap = {
        create: onCallCreateModel({}),
        update: onCallUpdateModel({ widget: specHandler } as any),
        read: onCallReadModel({}),
        delete: onCallDeleteModel({})
      };

      const callModel = onCallModel(callModelMap);
      const result = getModelApiDetails(callModel as unknown as OnCallApiDetailsRef)!;

      const widgetUpdate = result.models['widget'].calls.update!;
      expect(isOnCallSpecifierApiDetails(widgetUpdate)).toBe(true);

      const specDetails = widgetUpdate as OnCallSpecifierApiDetails;
      expect(specDetails.specifiers['_']!.inputType).toBe(specInputA);
      expect(specDetails.specifiers['custom']!.inputType).toBe(specInputB);
      expect(specDetails.specifiers['custom']!.mcp?.description).toBe('Custom operation');
    });

    it('should return undefined when no _apiDetails are present', () => {
      const callModelMap: OnCallModelMap = {
        create: onCallCreateModel({}),
        read: onCallReadModel({}),
        update: onCallUpdateModel({} as any),
        delete: onCallDeleteModel({})
      };

      const callModel = onCallModel(callModelMap);
      expect(getModelApiDetails(callModel as unknown as OnCallApiDetailsRef)).toBeUndefined();
    });

    it('should return undefined for null/undefined input', () => {
      expect(getModelApiDetails(null)).toBeUndefined();
      expect(getModelApiDetails(undefined)).toBeUndefined();
    });
  });

  // MARK: JsonSchemaRef end-to-end
  describe('JsonSchemaRef through full chain', () => {
    it('should preserve toJsonSchema() through the entire aggregation chain', () => {
      const schema = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };
      const inputType: JsonSchemaRef = { toJsonSchema: () => schema };

      const callModelMap: OnCallModelMap = {
        create: onCallCreateModel({
          widget: onCallSpecifierHandler({
            _: withApiDetails({ inputType, fn: mockHandler() }) as any
          })
        } as OnCallCreateModelMap<any>),
        read: onCallReadModel({}),
        update: onCallUpdateModel({} as any),
        delete: onCallDeleteModel({})
      };

      const callModel = onCallModel(callModelMap);

      // Walk the full tree
      const topDetails = readApiDetails(callModel as unknown as OnCallApiDetailsRef) as OnCallModelApiDetails;
      const crudDetails = topDetails.create as OnCallCrudModelApiDetails;
      const specDetails = crudDetails.modelTypes['widget'] as OnCallSpecifierApiDetails;
      const handlerDetails = specDetails.specifiers['_'] as OnCallModelFunctionApiDetails;

      expect(handlerDetails.inputType!.toJsonSchema()).toEqual(schema);
    });
  });
});
