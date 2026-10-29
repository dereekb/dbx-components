import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { type Maybe } from '@dereekb/util';
import { type DbxButtonStyle, type DbxColorInput, type DbxColorTone, DbxAvatarComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxColorDirective, DbxIconTileComponent, DbxSectionComponent, DbxTimelineItemDirective } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';

type ProgramJourneyStepState = 'complete' | 'current' | 'upcoming';

interface ProgramJourneyStep {
  readonly label: string;
  readonly icon: string;
  readonly state: ProgramJourneyStepState;
  /**
   * Whether the step's marker can be clicked. Defaults to true. A step that can't be opened renders its marker as a plain tile that looks the same as the others.
   */
  readonly clickable?: Maybe<boolean>;
}

interface ProgramJourneyStepStateDisplay {
  readonly status: string;
  readonly markerColor: DbxColorInput;
  readonly markerTone?: Maybe<DbxColorTone>;
  /**
   * Colors the connector leading into the step. Upcoming steps leave it unset so their connector keeps the default line.
   */
  readonly connectorColor?: Maybe<DbxColorInput>;
}

interface ProgramJourneyStepView extends ProgramJourneyStep, ProgramJourneyStepStateDisplay {
  readonly title: string;
  /**
   * Whether the marker renders as a button. Resolved from {@link ProgramJourneyStep.clickable}.
   */
  readonly markerClickable: boolean;
  /**
   * Accessible name for the step's marker button, which shows only an icon.
   */
  readonly markerAriaLabel: string;
}

interface ProgramJourneyFocusItem {
  readonly label: string;
  readonly date: string;
  readonly done: boolean;
}

const PROGRAM_JOURNEY_INVERSE_COLOR: DbxColorInput = { template: 'demo-inverse' };

const PROGRAM_JOURNEY_STEP_STATE_DISPLAY: Record<ProgramJourneyStepState, ProgramJourneyStepStateDisplay> = {
  complete: { status: 'Complete', markerColor: 'success', connectorColor: 'success' },
  current: { status: 'In Progress', markerColor: PROGRAM_JOURNEY_INVERSE_COLOR, connectorColor: PROGRAM_JOURNEY_INVERSE_COLOR },
  upcoming: { status: 'Upcoming', markerColor: 'grey', markerTone: 18 }
};

const PROGRAM_JOURNEY_STEPS: ReadonlyArray<ProgramJourneyStep> = [
  { label: 'Discovery', icon: 'explore', state: 'complete' },
  { label: 'Goal Setting', icon: 'flag', state: 'complete' },
  { label: 'Development', icon: 'trending_up', state: 'current' },
  { label: 'Integration', icon: 'hub', state: 'upcoming' },
  { label: 'Review', icon: 'rate_review', state: 'upcoming', clickable: false }
];

const PROGRAM_JOURNEY_FOCUS_ITEMS: ReadonlyArray<ProgramJourneyFocusItem> = [
  { label: 'Session: Personal brand and influence', date: 'Apr 24', done: true },
  { label: 'Complete reflection exercise', date: 'Apr 28', done: true },
  { label: 'Practice stakeholder communication framework', date: 'May 1', done: false }
];

const PROGRAM_JOURNEY_OTHER_TABS: ReadonlyArray<string> = ['Sessions', 'Goals', 'Assessments', 'Resources', 'Notes'];

/**
 * Static "Leadership Development Program" page mockup: a `<dbx-section>`
 * page header with a subtitle line and its actions, a start-aligned
 * `<mat-tab-group>`, a `.dbx-timeline` progress row across the program's
 * phases, and a responsive two-card row below it — a "Current Focus"
 * checklist `<mat-card>` beside a "Your Coach" profile `<mat-card>`.
 *
 * The timeline maps each step's state to its colors in TS
 * (`PROGRAM_JOURNEY_STEP_STATE_DISPLAY`) so the template binds one view
 * object per step: complete steps are a full `success` `<dbx-icon-tile>`,
 * the current step the app's `demo-inverse` color template (the same
 * surface as the "Schedule Session" button, so it flips with the theme),
 * and upcoming steps a tonal `grey`. `[dbxColor]` on each
 * `.dbx-timeline-item` colors the connector leading into it, so the line
 * fills up to the step in progress and stays the default outline after it.
 * The steps use the `[dbxTimelineItem]` directive, and `[dbxTimelineItemCurrent]`
 * marks the step in progress, so on a narrow viewport — where the timeline
 * scrolls sideways — it opens centered on that step instead of on the
 * finished steps at its start. Each marker is clickable: the tile sits in
 * a `<dbx-button class="dbx-button-icon-tile">`, which hugs the round tile
 * and overlays the button's hover/press/focus state layer on every color
 * variant, with an `ariaLabel` naming the step and its status since the
 * button shows only an icon. A step with `clickable: false` (Review here)
 * renders the bare tile instead of a disabled button, so it looks the same
 * as the others but has no hover layer, pointer, or tab stop.
 *
 * The card row uses Angular Flex Layout's
 * `gdColumns="3fr 2fr" gdColumns.lt-md="1fr"` so the cards sit side by
 * side on desktop and stack below tablet width. Checklist rows are
 * `.dbx-flex-bar` rows with a small round `<dbx-icon-tile>` check (full
 * `success` when done, tonal `grey` when pending) sized through the
 * `--dbx-icon-tile-*` tokens. The coach avatar is `<dbx-avatar>` with an
 * `avatarName`, so it renders initials on a curated color with no image.
 * Every button opens a `MatSnackBar` so each action is demonstrably wired.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug layout-program-journey
 * @dbxDocsUiExampleCategory layout
 * @dbxDocsUiExampleSummary Program journey page — dbx-section header with actions, start-aligned mat-tab-group, a dbx-timeline progress row of colored icon tiles, and a responsive row of a checklist mat-card beside a coach profile mat-card with a dbx-avatar.
 * @dbxDocsUiExampleRelated dbx-section, mat-tab-group, dbx-timeline, dbx-timeline-item, timeline-item, dbx-icon-tile, dbx-button-icon-tile, dbx-color, dbx-avatar, mat-card, dbx-button, button-spacer, dbx-flex-bar
 */
@Component({
  selector: 'doc-program-journey-layout-example',
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxAvatarComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxColorDirective, DbxIconTileComponent, DbxSectionComponent, DbxTimelineItemDirective, MatCardModule, MatTabsModule, FlexLayoutModule],
  styles: [
    `
      .doc-program-journey-page {
        background: var(--mat-sys-surface-container-low);
        border-radius: var(--mat-sys-corner-large);
      }

      .doc-program-journey-focus-check {
        --dbx-icon-tile-width: 24px;
        --dbx-icon-tile-height: 24px;
        --dbx-icon-tile-min-width: 24px;
        --dbx-icon-tile-padding: 0;
        --dbx-icon-tile-icon-size: 16px;
      }
    `
  ],
  template: `
    <dbx-docs-ui-example header="Program Journey Layout" hint="Page header + tabs + a dbx-timeline progress row over a checklist card and a coach profile card.">
      <dbx-docs-ui-example-info>
        <p>
          The page header is a
          <code>&lt;dbx-section [h]="1"&gt;</code>
          whose
          <code>hint</code>
          carries the subtitle line and whose
          <code>sectionHeader</code>
          slot holds the actions: a flat
          <code>&lt;dbx-button&gt;</code>
          on the
          <code>demo-inverse</code>
          color template and a stroked
          <code>iconOnly</code>
          overflow button. The tabs are a
          <code>&lt;mat-tab-group mat-stretch-tabs="false" mat-align-tabs="start"&gt;</code>
          .
        </p>
        <p>
          The progress row is a
          <code>.dbx-timeline</code>
          of
          <code>.dbx-timeline-item</code>
          steps with round
          <code>&lt;dbx-icon-tile&gt;</code>
          markers. Each step's state maps to its marker color in TS — full
          <code>success</code>
          when complete,
          <code>demo-inverse</code>
          for the step in progress, tonal
          <code>grey</code>
          when upcoming — and
          <code>[dbxColor]</code>
          on the item colors the connector leading into it, so the line fills up to the current step. The steps use the
          <code>[dbxTimelineItem]</code>
          directive, and
          <code>[dbxTimelineItemCurrent]</code>
          marks the step in progress: on a narrow viewport the timeline scrolls sideways, and it opens centered on that step rather than on the finished steps at its start.
        </p>
        <p>
          Each marker is clickable. The tile is wrapped in a
          <code>&lt;dbx-button class="dbx-button-icon-tile"&gt;</code>
          , which hugs the round tile and lays the button's hover, press, and focus state layer over every color variant — full, tonal, and the inverse current step. The button's
          <code>ariaLabel</code>
          names the step and its status, since the button itself shows only an icon. The Review step can't be opened yet, so its marker skips the button and renders the bare tile — rather than a disabled button, which would grey it out — and looks the same as the others with no hover layer, pointer, or tab stop.
        </p>
        <p>
          The two cards below are outlined
          <code>&lt;mat-card&gt;</code>
          s in a
          <code>gdColumns="3fr 2fr" gdColumns.lt-md="1fr"</code>
          grid that stacks below tablet width. Checklist rows are
          <code>.dbx-flex-bar</code>
          rows with a small round check tile sized through the
          <code>--dbx-icon-tile-*</code>
          tokens, and the coach is a
          <code>&lt;dbx-avatar [avatarName]&gt;</code>
          , which renders initials on a curated color when there is no image.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-p4 doc-program-journey-page">
          <dbx-section header="Leadership Development Program" [h]="1" hint="Executive coaching program · 6 months · Started Jan 2024">
            <div sectionHeader class="dbx-flex-bar">
              <dbx-button flat text="Schedule Session" [buttonStyle]="scheduleButtonStyle" (buttonClick)="showClicked('Schedule Session')"></dbx-button>
              <dbx-button-spacer></dbx-button-spacer>
              <dbx-button stroked iconOnly icon="more_horiz" (buttonClick)="showClicked('More')"></dbx-button>
            </div>
            <mat-tab-group mat-stretch-tabs="false" mat-align-tabs="start">
              <mat-tab label="Journey">
                <div class="dbx-pt4">
                  <div class="dbx-timeline dbx-pb4">
                    @for (step of steps; track step.label) {
                      <div dbxTimelineItem [dbxTimelineItemCurrent]="step.state === 'current'" [dbxColor]="step.connectorColor">
                        @if (step.markerClickable) {
                          <dbx-button class="dbx-button-icon-tile" [ariaLabel]="step.markerAriaLabel" (buttonClick)="showClicked(step.title)">
                            <dbx-icon-tile [icon]="step.icon" [dbxColor]="step.markerColor" [dbxColorTone]="step.markerTone" [round]="true"></dbx-icon-tile>
                          </dbx-button>
                        } @else {
                          <dbx-icon-tile [icon]="step.icon" [dbxColor]="step.markerColor" [dbxColorTone]="step.markerTone" [round]="true"></dbx-icon-tile>
                        }
                        <span class="dbx-text-label-large">{{ step.title }}</span>
                        <span class="dbx-text-body-small dbx-hint">{{ step.status }}</span>
                      </div>
                    }
                  </div>
                  <div gdColumns="3fr 2fr" gdColumns.lt-md="1fr" gdGap="var(--dbx-padding-3)">
                    <mat-card appearance="outlined">
                      <mat-card-content>
                        <h3 class="dbx-text-title-medium dbx-m0 dbx-pb3">Current Focus: Executive Presence</h3>
                        @for (item of focusItems; track item.label) {
                          <div class="dbx-flex-bar dbx-pb2">
                            <dbx-icon-tile class="doc-program-journey-focus-check" icon="check" [round]="true" [dbxColor]="item.done ? 'success' : 'grey'" [dbxColorTone]="item.done ? null : 18"></dbx-icon-tile>
                            <span class="dbx-flex-fill dbx-pl3">{{ item.label }}</span>
                            <span class="dbx-text-body-small dbx-hint dbx-pl3">{{ item.date }}</span>
                          </div>
                        }
                      </mat-card-content>
                    </mat-card>
                    <mat-card appearance="outlined">
                      <mat-card-content>
                        <h3 class="dbx-text-title-medium dbx-m0 dbx-pb3">Your Coach</h3>
                        <div fxLayout="row" fxLayoutAlign="start start" fxLayoutGap="var(--dbx-padding-3)">
                          <dbx-avatar avatarName="Morgan Lee"></dbx-avatar>
                          <div class="dbx-flex-fill">
                            <div class="dbx-text-title-large">Morgan Lee</div>
                            <div class="dbx-text-body-small dbx-hint">Executive Coach</div>
                            <div class="dbx-text-body-small dbx-hint dbx-pb3">Leadership & Strategy</div>
                            <div fxLayout="row wrap" fxLayoutGap="var(--dbx-padding-2)">
                              <dbx-button stroked icon="chat_bubble_outline" text="Message" (buttonClick)="showClicked('Message')"></dbx-button>
                              <dbx-button stroked text="View Profile" (buttonClick)="showClicked('View Profile')"></dbx-button>
                            </div>
                          </div>
                        </div>
                      </mat-card-content>
                    </mat-card>
                  </div>
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
export class DocProgramJourneyLayoutExampleComponent {
  private readonly _snackBar = inject(MatSnackBar);

  readonly steps: ReadonlyArray<ProgramJourneyStepView> = PROGRAM_JOURNEY_STEPS.map((step, i) => {
    const display = PROGRAM_JOURNEY_STEP_STATE_DISPLAY[step.state];
    const title = `${i + 1}. ${step.label}`;
    return { ...step, ...display, title, markerClickable: step.clickable ?? true, markerAriaLabel: `${title}, ${display.status}` };
  });
  readonly focusItems = PROGRAM_JOURNEY_FOCUS_ITEMS;
  readonly otherTabs = PROGRAM_JOURNEY_OTHER_TABS;

  readonly scheduleButtonStyle: DbxButtonStyle = { color: PROGRAM_JOURNEY_INVERSE_COLOR };

  showClicked(label: string): void {
    this._snackBar.open(`You clicked: ${label}`, 'Dismiss', { duration: 3000 });
  }
}
