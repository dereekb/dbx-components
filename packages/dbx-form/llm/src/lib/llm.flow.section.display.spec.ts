import { describe, it, expect } from 'vitest';
import { dbxLlmFlowSectionResolvedDisplayConfig } from './llm.flow.section.display';

describe('dbxLlmFlowSectionResolvedDisplayConfig()', () => {
  it('should show every part, including the step number, by default', () => {
    const result = dbxLlmFlowSectionResolvedDisplayConfig(undefined, undefined);
    expect(result).toEqual({ header: true, form: true, rawInput: true, runButtons: true, history: true, output: true, stepNumber: true });
  });

  it('should hide the step number only when turned off', () => {
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ stepNumber: true }, undefined).stepNumber).toBe(true);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ stepNumber: null }, undefined).stepNumber).toBe(true);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ stepNumber: false }, undefined).stepNumber).toBe(false);
  });

  it('should let the input display override the config display', () => {
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ stepNumber: true }, { stepNumber: false }).stepNumber).toBe(false);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ stepNumber: false }, { stepNumber: true }).stepNumber).toBe(true);
    expect(dbxLlmFlowSectionResolvedDisplayConfig({ rawInput: false }, { rawInput: true }).rawInput).toBe(true);
  });
});
