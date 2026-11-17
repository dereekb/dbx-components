import { type Signal } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxLlmFlowSectionDisplayConfig } from './llm.flow';

/**
 * Fully resolved display toggles of a section.
 */
export type DbxLlmFlowSectionResolvedDisplayConfig = Required<{ readonly [K in keyof DbxLlmFlowSectionDisplayConfig]: boolean }>;

/**
 * Resolves the display toggles of a section. Every part, including the step number, is shown unless turned off. The display input overrides
 * the config.
 *
 * @param configDisplay - The section config's display.
 * @param inputDisplay - The component's display input.
 * @returns The resolved toggles.
 */
export function dbxLlmFlowSectionResolvedDisplayConfig(configDisplay: Maybe<DbxLlmFlowSectionDisplayConfig>, inputDisplay: Maybe<DbxLlmFlowSectionDisplayConfig>): DbxLlmFlowSectionResolvedDisplayConfig {
  const display = { ...configDisplay, ...inputDisplay };
  return {
    header: display.header !== false,
    form: display.form !== false,
    rawInput: display.rawInput !== false,
    runButtons: display.runButtons !== false,
    history: display.history !== false,
    output: display.output !== false,
    stepNumber: display.stepNumber !== false,
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
