import { type Injector } from '@angular/core';
import { type MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { type DbxDetachInstance, type DbxDetachKey, type DbxDetachOverlayConfig, type DbxDetachService, DbxInjectionDialogComponent, type DbxInjectionDialogComponentConfig } from '@dereekb/dbx-web';
import { type DbxLlmFlowSectionKey } from './llm.flow';
import { DbxLlmFlowSectionFormPanelComponent, type DbxLlmFlowSectionFormPanelData } from './llm.flow.section.form.panel.component';

/**
 * Default overlay config of a detached section form panel.
 */
export const DEFAULT_DBX_LLM_FLOW_SECTION_FORM_DETACH_OVERLAY_CONFIG: DbxDetachOverlayConfig = { width: '520px', height: '640px', isDraggable: true };

let dbxLlmFlowSectionFormDetachKeyIndex = 0;

/**
 * Creates a detach key for a section's form panel that is unique to the calling section instance.
 *
 * @param sectionKey - The section key.
 * @returns A unique detach key.
 */
export function dbxLlmFlowSectionFormDetachKey(sectionKey: DbxLlmFlowSectionKey): DbxDetachKey {
  dbxLlmFlowSectionFormDetachKeyIndex += 1;
  return `dbx-llm-flow-section-form-${dbxLlmFlowSectionFormDetachKeyIndex}-${sectionKey}`;
}

/**
 * Config for {@link openDbxLlmFlowSectionFormDialog}.
 */
export interface OpenDbxLlmFlowSectionFormDialogConfig extends Omit<DbxInjectionDialogComponentConfig<DbxLlmFlowSectionFormPanelComponent>, 'componentConfig' | 'injector'> {
  /**
   * The section's injector. The panel shares its DbxLlmFlowSectionStore.
   */
  readonly injector: Injector;
}

/**
 * Opens the section's form panel in a modal dialog.
 *
 * @param matDialog - The MatDialog.
 * @param config - The dialog config, with the section's injector.
 * @returns The dialog ref.
 */
export function openDbxLlmFlowSectionFormDialog(matDialog: MatDialog, config: OpenDbxLlmFlowSectionFormDialogConfig): MatDialogRef<DbxInjectionDialogComponent<DbxLlmFlowSectionFormPanelComponent>, void> {
  const data: DbxLlmFlowSectionFormPanelData = { mode: 'dialog' };
  return DbxInjectionDialogComponent.openDialog(matDialog, {
    width: '720px',
    height: '80vh',
    maxWidth: '96vw',
    ...config,
    componentConfig: { componentClass: DbxLlmFlowSectionFormPanelComponent, data }
  });
}

/**
 * Config for {@link openDbxLlmFlowSectionFormDetach}.
 */
export interface OpenDbxLlmFlowSectionFormDetachConfig {
  /**
   * The section's injector. The panel shares its DbxLlmFlowSectionStore.
   */
  readonly injector: Injector;
  /**
   * The detach key. See dbxLlmFlowSectionFormDetachKey().
   */
  readonly key: DbxDetachKey;
  readonly overlay?: DbxDetachOverlayConfig;
}

/**
 * Opens the section's form panel in a floating, draggable detach window, so the output stays visible.
 *
 * The caller owns the entry: remove it with DbxDetachService.remove(key) when the section is destroyed, because the panel's store dies with it.
 *
 * @param detachService - The DbxDetachService.
 * @param config - The detach config, with the section's injector.
 * @returns The detach instance.
 */
export function openDbxLlmFlowSectionFormDetach(detachService: DbxDetachService, config: OpenDbxLlmFlowSectionFormDetachConfig): DbxDetachInstance<DbxLlmFlowSectionFormPanelComponent> {
  const data: DbxLlmFlowSectionFormPanelData = { mode: 'detach' };
  const instance = detachService.init({
    componentClass: DbxLlmFlowSectionFormPanelComponent,
    injector: config.injector,
    key: config.key,
    data,
    overlay: { ...DEFAULT_DBX_LLM_FLOW_SECTION_FORM_DETACH_OVERLAY_CONFIG, ...config.overlay }
  });

  instance.detach();
  return instance;
}
