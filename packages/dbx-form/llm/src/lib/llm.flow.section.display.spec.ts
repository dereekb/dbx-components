import { describe, it, expect } from 'vitest';
import { dbxLlmFlowSectionResolvedDisplayConfig } from './llm.flow.section.display';

describe('dbxLlmFlowSectionResolvedDisplayConfig()', () => {
  it('should show every part, including the step number and the status chip, by default', () => {
    const result = dbxLlmFlowSectionResolvedDisplayConfig(undefined, undefined);
    expect(result).toEqual({ header: true, form: true, rawInput: true, runButtons: true, history: true, output: true, stepNumber: true, status: true, collapse: true });
  });

  it('should hide the step number only when turned off', () => {
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ stepNumber: true }, undefined).stepNumber).toBe(true);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ stepNumber: null }, undefined).stepNumber).toBe(true);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ stepNumber: false }, undefined).stepNumber).toBe(false);
  });

  it('should hide the status chip only when turned off', () => {
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ status: true }, undefined).status).toBe(true);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ status: null }, undefined).status).toBe(true);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ status: undefined }, undefined).status).toBe(true);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ status: false }, undefined).status).toBe(false);
  });

  it('should let the input display override the config display', () => {
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ stepNumber: true }, { stepNumber: false }).stepNumber).toBe(false);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ stepNumber: false }, { stepNumber: true }).stepNumber).toBe(true);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ rawInput: false }, { rawInput: true }).rawInput).toBe(true);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ status: true }, { status: false }).status).toBe(false);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ status: false }, { status: true }).status).toBe(true);
  });

  describe('view-only', () => {
    it('should turn the run parts off and keep the header, step number, status chip and collapse button on by default', () => {
      const result = dbxLlmFlowSectionResolvedDisplayConfig(undefined, undefined, true);
      expect(result).toEqual({ header: true, form: false, rawInput: false, runButtons: false, history: false, output: false, stepNumber: true, status: true, collapse: true });
    });

    it('should let an explicit true in the config display turn a run part back on', () => {
      expect(dbxLlmFlowSectionResolvedDisplayConfig({ output: true }, undefined, true).output).toBe(true);
    });

    it('should let an explicit true in the input display turn a run part back on', () => {
      expect(dbxLlmFlowSectionResolvedDisplayConfig(undefined, { runButtons: true }, true).runButtons).toBe(true);
    });

    it('should keep a run part off when set to null or undefined in either layer', () => {
      expect(dbxLlmFlowSectionResolvedDisplayConfig({ form: null }, undefined, true).form).toBe(false);
      expect(dbxLlmFlowSectionResolvedDisplayConfig({ form: undefined }, undefined, true).form).toBe(false);
      expect(dbxLlmFlowSectionResolvedDisplayConfig(undefined, { form: null }, true).form).toBe(false);
      expect(dbxLlmFlowSectionResolvedDisplayConfig({ form: true }, { form: undefined }, true).form).toBe(false);
    });

    it('should resolve the same as before when viewOnly is false, null or undefined', () => {
      const configDisplay = { rawInput: false, stepNumber: null };
      const inputDisplay = { history: false };
      const expected = dbxLlmFlowSectionResolvedDisplayConfig(configDisplay, inputDisplay);

      expect(expected).toEqual({ header: true, form: true, rawInput: false, runButtons: true, history: false, output: true, stepNumber: true, status: true, collapse: true });
      expect(dbxLlmFlowSectionResolvedDisplayConfig(configDisplay, inputDisplay, false)).toEqual(expected);
      expect(dbxLlmFlowSectionResolvedDisplayConfig(configDisplay, inputDisplay, null)).toEqual(expected);
      expect(dbxLlmFlowSectionResolvedDisplayConfig(configDisplay, inputDisplay, undefined)).toEqual(expected);
    });
  });
});
