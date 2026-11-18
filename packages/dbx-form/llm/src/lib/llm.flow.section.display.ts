import { type Signal } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxLlmFlowSectionDisplayConfig } from './llm.flow';

/**
 * Fully resolved display toggles of a section.
 */
export type DbxLlmFlowSectionResolvedDisplayConfig = Required<{ readonly [K in keyof DbxLlmFlowSectionDisplayConfig]: boolean }>;

/**
 * Resolves the display toggles of a section. Every part is shown unless turned off, except that a view-only section's run parts (form, raw
 * input, run buttons, history and output) are off unless turned on. The display input overrides the config.
 *
 * @param configDisplay - The section config's display.
 * @param inputDisplay - The component's display input.
 * @param viewOnly - Whether the section is view-only (DbxLlmFlowSectionConfig.viewOnly).
 * @returns The resolved toggles.
 */
export function dbxLlmFlowSectionResolvedDisplayConfig(configDisplay: Maybe<DbxLlmFlowSectionDisplayConfig>, inputDisplay: Maybe<DbxLlmFlowSectionDisplayConfig>, viewOnly?: Maybe<boolean>): DbxLlmFlowSectionResolvedDisplayConfig {
  const display = { ...configDisplay, ...inputDisplay };
  const runPart = !viewOnly; // default of the run parts: on, or off for a view-only section

  return {
    header: display.header !== false,
    form: display.form ?? runPart,
    rawInput: display.rawInput ?? runPart,
    runButtons: display.runButtons ?? runPart,
    history: display.history ?? runPart,
    output: display.output ?? runPart,
    stepNumber: display.stepNumber !== false,
    status: display.status !== false,
    collapse: display.collapse !== false
  };
}

/**
 * Provides the resolved display of a section to the components created with its injector, such as the form pop-out panel.
 *
 * Provided by DbxLlmFlowSectionComponent.
 */
export abstract class DbxLlmFlowSectionDisplay {
  abstract readonly displaySignal: Signal<DbxLlmFlowSectionResolvedDisplayConfig>;
}
