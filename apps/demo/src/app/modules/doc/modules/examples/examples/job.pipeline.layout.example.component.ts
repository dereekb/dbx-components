import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { type DbxButtonStyle, DbxAvatarComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxChipDirective, DbxSectionComponent } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';

interface JobPipelineCandidate {
  readonly name: string;
  readonly role: string;
}

interface JobPipelineStage {
  readonly label: string;
  readonly count: number;
  readonly candidates: ReadonlyArray<JobPipelineCandidate>;
}

const JOB_PIPELINE_STAGES: ReadonlyArray<JobPipelineStage> = [
  {
    label: 'Sourced',
    count: 24,
    candidates: [
      { name: 'Alex Chen', role: 'VP Engineering, Lorem Pay' },
      { name: 'Marcus Park', role: 'CTO, Ipsum Ramp' },
      { name: 'Priya Desai', role: 'Engineering Director, Dolor Coin' }
    ]
  },
  {
    label: 'Screening',
    count: 8,
    candidates: [
      { name: 'Daniel Kim', role: 'Director, Sit Stays' },
      { name: 'Sarah Johnson', role: 'VP Engineering, Amet Notes' },
      { name: 'Miguel Santos', role: 'Senior Director, Elit Chat' }
    ]
  },
  {
    label: 'Interviews',
    count: 5,
    candidates: [
      { name: 'Emily Zhang', role: 'Head of Engineering, Sed Linear' },
      { name: 'James Wilson', role: 'CTO, Tempor Design' },
      { name: 'Lisa Park', role: 'Engineering Director, Magna Docs' }
    ]
  },
  {
    label: 'Offer',
    count: 2,
    candidates: [
      { name: 'David Kim', role: 'VP Engineering, Aliqua Bank' },
      { name: 'Rachel Green', role: 'CTO, Veniam Cards' }
    ]
  }
];

const JOB_PIPELINE_OTHER_TABS: ReadonlyArray<string> = ['Overview', 'Candidates', 'Activity', 'Notes', 'Files'];

/**
 * Static job pipeline page mockup: a `<dbx-section>` page header with the
 * job's details in its hint and the page actions in its `sectionHeader`
 * slot, a start-aligned `<mat-tab-group>`, and a board of stage columns —
 * one outlined `<mat-card>` per stage with a tinted header bar (stage
 * name, a small `grey` `<dbx-chip>` count, and an icon-only arrow
 * `<dbx-button>`) over that stage's candidates.
 *
 * The header bar is a plain `<div>` placed before `<mat-card-content>`, so
 * it spans the card edge to edge; the card clips it to its rounded corners
 * with `overflow: hidden`. Each candidate row is a `.dbx-flex-bar` of a
 * 40px `<dbx-avatar [avatarName]>` (initials on a curated color, sized
 * through `--dbx-avatar-size`) and a `.dbx-flex-fill-0` text column whose
 * lines truncate with `.dbx-text-truncate`.
 *
 * The board is a single-row grid: `gdAuto="column"` flows the stages into
 * columns and `gdColumns="minmax(180px, 1fr)!"` (the trailing `!` sets
 * `grid-auto-columns`) sizes every column however many stages there are.
 * The columns share the row while they fit and the board scrolls sideways
 * (`overflow-x: auto`) once they would drop under 180px, so the stages stay
 * in order instead of wrapping one onto a second row. The grid stretches the
 * columns to the same height, so a short stage keeps its full column. The
 * "Add Candidate" `<dbx-button>` uses the app's `demo-inverse`
 * color template. Every button opens a `MatSnackBar` so each action is
 * demonstrably wired.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug layout-job-pipeline
 * @dbxDocsUiExampleCategory layout
 * @dbxDocsUiExampleSummary Job pipeline page — dbx-section header with job details and actions, start-aligned mat-tab-group, and a sideways-scrolling board of stage mat-cards, each with a tinted header bar (name, dbx-chip count, arrow button) over dbx-avatar candidate rows.
 * @dbxDocsUiExampleRelated dbx-section, mat-tab-group, mat-card, dbx-chip, dbx-avatar, dbx-button, button-spacer, dbx-flex-bar, dbx-flex-fill-0, dbx-text-truncate, dbx-spacer
 */
@Component({
  selector: 'doc-job-pipeline-layout-example',
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxAvatarComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxChipDirective, DbxSectionComponent, MatCardModule, MatTabsModule, FlexLayoutModule],
  styles: [
    `
      .doc-job-pipeline-page {
        background: var(--mat-sys-surface-container-low);
        border-radius: var(--mat-sys-corner-large);
      }

      .doc-job-pipeline-board {
        overflow-x: auto;
      }

      .doc-job-pipeline-stage {
        overflow: hidden;
      }

      .doc-job-pipeline-stage-header {
        background: var(--mat-sys-surface-container);
        padding: var(--dbx-padding-1) var(--dbx-padding-1) var(--dbx-padding-1) var(--dbx-padding-3);
      }

      .doc-job-pipeline-avatar {
        --dbx-avatar-size: 40px;
      }
    `
  ],
  template: `
    <dbx-docs-ui-example header="Job Pipeline Layout" hint="Page header + tabs over a sideways-scrolling board of stage columns with candidate rows.">
      <dbx-docs-ui-example-info>
        <p>
          The page header is a
          <code>&lt;dbx-section [h]="1"&gt;</code>
          whose
          <code>hint</code>
          carries the job's details and whose
          <code>sectionHeader</code>
          slot holds the actions: a flat
          <code>&lt;dbx-button icon="add"&gt;</code>
          on the
          <code>demo-inverse</code>
          color template and a stroked
          <code>iconOnly</code>
          overflow button. The tabs are a start-aligned
          <code>&lt;mat-tab-group&gt;</code>
          .
        </p>
        <p>
          Each stage is an outlined
          <code>&lt;mat-card&gt;</code>
          . Its header bar is a plain
          <code>&lt;div&gt;</code>
          placed before
          <code>&lt;mat-card-content&gt;</code>
          so it spans the card edge to edge, painted with
          <code>--mat-sys-surface-container</code>
          and clipped to the card's corners by
          <code>overflow: hidden</code>
          on the card. The bar holds the stage name, a
          <code>&lt;dbx-chip [small]="true" color="grey"&gt;</code>
          count, a
          <code>.dbx-spacer</code>
          , and an icon-only arrow
          <code>&lt;dbx-button&gt;</code>
          with an
          <code>ariaLabel</code>
          .
        </p>
        <p>
          Candidate rows are
          <code>.dbx-flex-bar</code>
          rows of a 40px
          <code>&lt;dbx-avatar [avatarName]&gt;</code>
          (sized through
          <code>--dbx-avatar-size</code>
          ) beside a
          <code>.dbx-flex-fill-0</code>
          column whose lines truncate with
          <code>.dbx-text-truncate</code>
          . The board is a single-row grid —
          <code>gdAuto="column"</code>
          with
          <code>gdColumns="minmax(180px, 1fr)!"</code>
          , where the trailing
          <code>!</code>
          sets
          <code>grid-auto-columns</code>
          — so every stage gets a column however many there are. The columns share the row when they fit and the board scrolls sideways (
          <code>overflow-x: auto</code>
          ) once they would drop under 180px, keeping the stages in order rather than wrapping a stage onto a second row. The columns stretch to the same height, so a short stage keeps its full column.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-p4 doc-job-pipeline-page">
          <dbx-section header="VP of Engineering" [h]="1" hint="Series B Fintech · San Francisco, CA · $250K – $350K">
            <div sectionHeader class="dbx-flex-bar">
              <dbx-button flat icon="add" text="Add Candidate" [buttonStyle]="addCandidateButtonStyle" (buttonClick)="showClicked('Add Candidate')"></dbx-button>
              <dbx-button-spacer></dbx-button-spacer>
              <dbx-button stroked iconOnly icon="more_horiz" ariaLabel="More actions" (buttonClick)="showClicked('More')"></dbx-button>
            </div>
            <mat-tab-group mat-stretch-tabs="false" mat-align-tabs="start">
              <mat-tab label="Pipeline">
                <div class="dbx-pt4 doc-job-pipeline-board" gdAuto="column" gdColumns="minmax(180px, 1fr)!" gdGap="var(--dbx-padding-3)">
                  @for (stage of stages; track stage.label) {
                    <mat-card class="doc-job-pipeline-stage" appearance="outlined">
                      <div class="dbx-flex-bar doc-job-pipeline-stage-header">
                        <span class="dbx-text-title-small dbx-pr2">{{ stage.label }}</span>
                        <dbx-chip [small]="true" color="grey">{{ stage.count }}</dbx-chip>
                        <span class="dbx-spacer"></span>
                        <dbx-button iconOnly icon="arrow_forward" [ariaLabel]="'Open ' + stage.label" (buttonClick)="showClicked(stage.label)"></dbx-button>
                      </div>
                      <mat-card-content class="dbx-pt3">
                        @for (candidate of stage.candidates; track candidate.name) {
                          <div class="dbx-flex-bar dbx-pb3">
                            <dbx-avatar class="doc-job-pipeline-avatar" [avatarName]="candidate.name"></dbx-avatar>
                            <div class="dbx-flex-fill-0 dbx-pl3">
                              <div class="dbx-text-title-small dbx-text-truncate">{{ candidate.name }}</div>
                              <div class="dbx-text-body-small dbx-hint dbx-text-truncate">{{ candidate.role }}</div>
                            </div>
                          </div>
                        }
                      </mat-card-content>
                    </mat-card>
                  }
                </div>
              </mat-tab>
              @for (tab of otherTabs; track tab) {
                <mat-tab [label]="tab">
                  <p class="dbx-hint dbx-pt4">{{ tab }} would go here.</p>
                </mat-tab>
              }
            </mat-tab-group>
          </dbx-section>
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocJobPipelineLayoutExampleComponent {
  private readonly _snackBar = inject(MatSnackBar);

  readonly stages = JOB_PIPELINE_STAGES;
  readonly otherTabs = JOB_PIPELINE_OTHER_TABS;

  readonly addCandidateButtonStyle: DbxButtonStyle = { color: { template: 'demo-inverse' } };

  showClicked(label: string): void {
    this._snackBar.open(`You clicked: ${label}`, 'Dismiss', { duration: 3000 });
  }
}
