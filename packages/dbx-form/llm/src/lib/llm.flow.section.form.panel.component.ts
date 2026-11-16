import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { cleanSubscription, DBX_INJECTION_COMPONENT_DATA, DbxInjectionComponent } from '@dereekb/dbx-core';
import { DbxDetachContentComponent, DbxDetachControlsComponent } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { distinctUntilChanged, filter, map, pairwise, withLatestFrom } from 'rxjs';
import { type DbxLlmFlowSectionFormPopoutMode } from './llm.flow';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';
import { dbxLlmFlowSectionFormComponentInjectionConfig } from './llm.flow.section.form';
import { DbxLlmFlowSectionRawInputComponent } from './llm.flow.section.rawinput.component';
import { DbxLlmFlowSectionRunButtonsComponent } from './llm.flow.section.run.buttons.component';

/**
 * Injection data of a DbxLlmFlowSectionFormPanelComponent.
 */
export interface DbxLlmFlowSectionFormPanelData {
  /**
   * How the panel is shown. A detached panel renders the detach window controls.
   */
  readonly mode?: Maybe<DbxLlmFlowSectionFormPopoutMode>;
}

/**
 * The shared pop-out content of a section: a header, a second live instance of the section's form, the raw input and the run buttons.
 *
 * Created with the section's Injector, so it shares the section store; the form stays in sync with the inline form through the store. It
 * closes through the section store (closeFormPopout()), including on run start when the section's formPopout config sets closeOnRun.
 */
@Component({
  selector: 'dbx-llm-flow-section-form-panel',
  template: `
    @if (isDetachedSignal()) {
      <dbx-detach-content class="dbx-llm-flow-section-form-panel-detach">
        <dbx-detach-controls controls [header]="labelSignal()"></dbx-detach-controls>
        <ng-container [ngTemplateOutlet]="panelBody"></ng-container>
      </dbx-detach-content>
    } @else {
      <div class="dbx-llm-flow-section-form-panel-header dbx-text-title-medium">{{ labelSignal() }}</div>
      <ng-container [ngTemplateOutlet]="panelBody"></ng-container>
    }
    <ng-template #panelBody>
      <div class="dbx-llm-flow-section-form-panel-body">
        @if (formInjectionConfigSignal(); as formConfig) {
          @if (!formHiddenSignal()) {
            <div class="dbx-llm-flow-section-form">
              <dbx-injection [config]="formConfig"></dbx-injection>
            </div>
          }
        }
        @if (showRawInputSignal()) {
          <dbx-llm-flow-section-raw-input></dbx-llm-flow-section-raw-input>
        }
        <div class="dbx-llm-flow-section-form-panel-actions">
          <dbx-llm-flow-section-run-buttons></dbx-llm-flow-section-run-buttons>
        </div>
      </div>
    </ng-template>
  `,
  host: {
    class: 'dbx-llm-flow-section-form-panel'
  },
  imports: [NgTemplateOutlet, DbxInjectionComponent, DbxDetachContentComponent, DbxDetachControlsComponent, DbxLlmFlowSectionRawInputComponent, DbxLlmFlowSectionRunButtonsComponent]
})
export class DbxLlmFlowSectionFormPanelComponent {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);
  readonly data = inject<Maybe<DbxLlmFlowSectionFormPanelData>>(DBX_INJECTION_COMPONENT_DATA, { optional: true });

  readonly configSignal = toSignal(this.sectionStore.config$);
  readonly formHiddenSignal = toSignal(this.sectionStore.formHidden$, { initialValue: false });
  readonly formComponentSignal = toSignal(this.sectionStore.config$.pipe(map((x) => x?.formComponent)));
  readonly autoBindFormSignal = toSignal(this.sectionStore.config$.pipe(map((x) => x?.autoBindForm)));

  readonly isDetachedSignal = computed(() => this.data?.mode === 'detach');
  readonly labelSignal = computed(() => this.configSignal()?.label ?? 'Input');
  readonly showRawInputSignal = computed(() => this.configSignal()?.display?.rawInput !== false);
  readonly formInjectionConfigSignal = computed(() => dbxLlmFlowSectionFormComponentInjectionConfig(this.formComponentSignal(), this.autoBindFormSignal(), this.sectionStore));

  constructor() {
    // close when a run starts and the config asks for it
    cleanSubscription(
      this.sectionStore.isRunning$
        .pipe(
          distinctUntilChanged(),
          pairwise(),
          filter(([wasRunning, isRunning]) => !wasRunning && isRunning),
          withLatestFrom(this.sectionStore.config$),
          filter(([, config]) => Boolean(config?.formPopout && config.formPopout.closeOnRun))
        )
        .subscribe(() => this.close())
    );
  }

  close(): void {
    this.sectionStore.closeFormPopout();
  }
}
