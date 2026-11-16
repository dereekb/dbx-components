import { NgModule } from '@angular/core';
import { DbxLlmFlowDirective } from './llm.flow.directive';
import { DbxLlmFlowSectionDirective } from './llm.flow.section.directive';
import { DbxLlmFlowSectionRunDirective } from './llm.flow.section.run.directive';
import { DbxLlmFlowSectionFormDirective } from './llm.flow.section.form.directive';
import { DbxLlmFlowSectionRawInputComponent } from './llm.flow.section.rawinput.component';
import { DbxLlmFlowSectionRunButtonsComponent } from './llm.flow.section.run.buttons.component';
import { DbxLlmFlowSectionHistoryListComponent } from './llm.flow.section.history.list.component';
import { DbxLlmFlowSectionHistoryButtonComponent } from './llm.flow.section.history.button.component';
import { DbxLlmFlowSectionHistoryPopoverComponent } from './llm.flow.section.history.popover.component';
import { DbxLlmFlowSectionOutputComponent, DbxLlmFlowSectionOutputDirective } from './llm.flow.section.output.component';
import { DbxLlmFlowSectionFormPanelComponent } from './llm.flow.section.form.panel.component';
import { DbxLlmFlowSectionComponent } from './llm.flow.section.component';
import { DbxLlmFlowComponent } from './llm.flow.component';

const importsAndExports = [
  DbxLlmFlowDirective,
  DbxLlmFlowSectionDirective,
  DbxLlmFlowSectionRunDirective,
  DbxLlmFlowSectionFormDirective,
  DbxLlmFlowSectionRawInputComponent,
  DbxLlmFlowSectionRunButtonsComponent,
  DbxLlmFlowSectionHistoryListComponent,
  DbxLlmFlowSectionHistoryButtonComponent,
  DbxLlmFlowSectionHistoryPopoverComponent,
  DbxLlmFlowSectionOutputComponent,
  DbxLlmFlowSectionOutputDirective,
  DbxLlmFlowSectionFormPanelComponent,
  DbxLlmFlowSectionComponent,
  DbxLlmFlowComponent
];

/**
 * Imports and exports every @dereekb/dbx-form/llm directive and component.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxLlmFlowModule {}
