import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type PercentNumber } from '@dereekb/util';
import { type DbxButtonStyle, type DbxColorInput, DbxAnchorComponent, DbxAvatarComponent, DbxButtonComponent, DbxChipDirective, DbxSectionComponent, DbxSubSectionComponent } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';

type CoachingHomeGoalStatus = 'on_track' | 'ahead' | 'not_started';

interface CoachingHomeGoal {
  readonly label: string;
  readonly status: CoachingHomeGoalStatus;
  readonly progress: PercentNumber;
}

interface CoachingHomeGoalStatusDisplay {
  readonly statusLabel: string;
  readonly statusColor: DbxColorInput;
}

interface CoachingHomeGoalView extends CoachingHomeGoal, CoachingHomeGoalStatusDisplay {}

interface CoachingHomeReflection {
  readonly prompt: string;
  readonly date: string;
  readonly text: string;
}

const COACHING_HOME_GOAL_STATUS_DISPLAY: Record<CoachingHomeGoalStatus, CoachingHomeGoalStatusDisplay> = {
  on_track: { statusLabel: 'On track', statusColor: 'success' },
  ahead: { statusLabel: 'Ahead', statusColor: 'success' },
  not_started: { statusLabel: 'Not started', statusColor: 'warn' }
};

const COACHING_HOME_GOALS: ReadonlyArray<CoachingHomeGoal> = [
  { label: 'Improve executive presence', status: 'on_track', progress: 80 },
  { label: 'Build a high-performing team', status: 'on_track', progress: 60 },
  { label: 'Strengthen stakeholder influence', status: 'ahead', progress: 70 },
  { label: 'Plan next career chapter', status: 'not_started', progress: 0 }
];

const COACHING_HOME_REFLECTIONS: ReadonlyArray<CoachingHomeReflection> = [
  { prompt: 'What went well this week?', date: 'Apr 17', text: 'Felt more confident in the board meeting. Used the frameworks we discussed.' },
  { prompt: 'Biggest challenge right now?', date: 'Apr 10', text: 'Navigating competing priorities across teams.' },
  { prompt: 'Key takeaway', date: 'Apr 3', text: 'The importance of creating space for strategic thinking.' }
];

/**
 * Static coaching "home" page mockup: a `<dbx-section>` greeting header,
 * an "Upcoming Session" `<mat-card>` with the coach's `<dbx-avatar>` and
 * the session's actions, then two `<dbx-subsection>` rows — "Your Goals"
 * and "Recent Reflections" — whose `sectionHeader` slot holds a
 * right-aligned "View all →" `<dbx-anchor>` link.
 *
 * Each goal card shows a `<dbx-chip [small]>` status pill and a
 * determinate `<mat-progress-bar>` with its percent. The goal's status maps
 * to its chip label and color in TS (`COACHING_HOME_GOAL_STATUS_DISPLAY`),
 * so the template binds one view object per goal; the chip's default tone
 * gives the tonal pill (`success` for on track / ahead, `warn` for not
 * started). The bars re-point `--mat-progress-bar-active-indicator-color`
 * at `--dbx-success-color`. The "with James Carter" pill is a `grey`
 * `<dbx-chip>`, and the "Join Session" `<dbx-button>` uses the app's
 * `demo-inverse` color template so it flips with the theme.
 *
 * The session card sits in a
 * `gdColumns="repeat(auto-fill, minmax(min(100%, max(440px, 50%)), 1fr))"`
 * grid. Each track is at least half the row, so there are never more than
 * two, and once half the row is under 440px — about where the card's
 * buttons stop fitting side by side — only one full-width track fits. It
 * switches on the row's own width instead of a viewport breakpoint, which
 * fired too late once a sidenav narrowed the content. The goal and
 * reflection rows use
 * `gdColumns="repeat(auto-fit, minmax(…, 1fr))"`, so they reflow 4 → 2 → 1
 * and 3 → 1 as the viewport narrows. The reflection cards keep a 160px
 * `min-height` so a short entry still reads as a card, including when the
 * row stacks to one column. Every button and link opens a
 * `MatSnackBar` so each action is demonstrably wired.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug layout-coaching-home
 * @dbxDocsUiExampleCategory layout
 * @dbxDocsUiExampleSummary Coaching home page — dbx-section greeting header, an upcoming-session mat-card with a dbx-avatar and actions, and dbx-subsection rows of goal cards (dbx-chip status + mat-progress-bar) and reflection cards with "View all" links.
 * @dbxDocsUiExampleRelated dbx-section, dbx-subsection, dbx-avatar, dbx-chip, mat-progress-bar, mat-card, mat-divider, dbx-button, dbx-anchor, dbx-link-hover, dbx-flex-bar
 */
@Component({
  selector: 'doc-coaching-home-layout-example',
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxAnchorComponent, DbxAvatarComponent, DbxButtonComponent, DbxChipDirective, DbxSectionComponent, DbxSubSectionComponent, MatCardModule, MatDividerModule, MatProgressBar, FlexLayoutModule],
  styles: [
    `
      .doc-coaching-home-page {
        background: var(--mat-sys-surface-container-low);
        border-radius: var(--mat-sys-corner-large);
      }

      .doc-coaching-home-session-avatar {
        --dbx-avatar-size: 88px;
      }

      .doc-coaching-home-goal-progress {
        --mat-progress-bar-active-indicator-color: var(--dbx-success-color);
      }

      .doc-coaching-home-reflection {
        min-height: 160px;
      }
    `
  ],
  template: `
    <dbx-docs-ui-example header="Coaching Home Layout" hint="Greeting header + upcoming session card over rows of goal progress cards and reflection cards.">
      <dbx-docs-ui-example-info>
        <p>
          The greeting is a
          <code>&lt;dbx-section [h]="1"&gt;</code>
          whose
          <code>hint</code>
          carries the subtitle line. The "Upcoming Session" card is an outlined
          <code>&lt;mat-card&gt;</code>
          with the coach's
          <code>&lt;dbx-avatar [avatarName]&gt;</code>
          (initials on a curated color when there is no image), a
          <code>&lt;dbx-chip color="grey"&gt;</code>
          for the "with" line, and a flat
          <code>&lt;dbx-button&gt;</code>
          on the
          <code>demo-inverse</code>
          color template beside a stroked one. It sits in a
          <code>gdColumns="repeat(auto-fill, minmax(min(100%, max(440px, 50%)), 1fr))"</code>
          grid: each track is at least half the row, so there are never more than two, and once half the row drops under 440px a single full-width track is all that fits. The card switches on the width it actually has rather than on a viewport breakpoint, so a sidenav or a narrow container doesn't leave it squeezed
          into half a row.
        </p>
        <p>
          "Your Goals" and "Recent Reflections" are each a
          <code>&lt;dbx-subsection&gt;</code>
          whose
          <code>sectionHeader</code>
          slot holds a right-aligned "View all →"
          <code>&lt;dbx-anchor&gt;</code>
          with a
          <code>.dbx-link-hover</code>
          label. Each goal's status maps to its chip label and color in TS, and the chip's default tone gives the tonal pill —
          <code>success</code>
          for on track and ahead,
          <code>warn</code>
          for not started. The progress is a determinate
          <code>&lt;mat-progress-bar&gt;</code>
          whose indicator is re-pointed at
          <code>--dbx-success-color</code>
          through
          <code>--mat-progress-bar-active-indicator-color</code>
          .
        </p>
        <p>
          Both card rows use
          <code>gdColumns="repeat(auto-fit, minmax(…, 1fr))"</code>
          , so the goals reflow 4 → 2 → 1 and the reflections 3 → 1 as the viewport narrows. Each reflection card is a
          <code>.dbx-flex-bar</code>
          prompt and date over a
          <code>&lt;mat-divider&gt;</code>
          and the entry text, with a 160px
          <code>min-height</code>
          so a short entry doesn't leave a squat card, including when the row stacks to one column.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-p4 doc-coaching-home-page">
          <dbx-section header="Good morning, Sarah." [h]="1" hint="Here's your coaching progress and upcoming sessions.">
            <div class="dbx-pt3 dbx-pb4" gdColumns="repeat(auto-fill, minmax(min(100%, max(440px, 50%)), 1fr))">
              <mat-card appearance="outlined">
                <mat-card-content>
                  <h3 class="dbx-text-title-medium dbx-m0 dbx-pb3">Upcoming Session</h3>
                  <div fxLayout="row" fxLayout.lt-sm="column" fxLayoutAlign="start center" fxLayoutAlign.lt-sm="start start" fxLayoutGap="var(--dbx-padding-4)">
                    <dbx-avatar class="doc-coaching-home-session-avatar" avatarName="James Carter"></dbx-avatar>
                    <div class="dbx-flex-fill">
                      <div class="dbx-text-body-small dbx-hint dbx-pb1">Thu, Apr 24 · 10:00 – 11:00 AM</div>
                      <div class="dbx-text-title-large dbx-pb2">Leadership presence and influence</div>
                      <dbx-chip color="grey">with James Carter</dbx-chip>
                      <div class="dbx-pt3" fxLayout="row wrap" fxLayoutGap="var(--dbx-padding-2)">
                        <dbx-button flat text="Join Session" [buttonStyle]="joinButtonStyle" (buttonClick)="showClicked('Join Session')"></dbx-button>
                        <dbx-button stroked text="Add to Calendar" (buttonClick)="showClicked('Add to Calendar')"></dbx-button>
                      </div>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
            <dbx-subsection header="Your Goals" [h]="3">
              <dbx-anchor sectionHeader [anchor]="viewAllGoalsAnchor">
                <span class="dbx-hint dbx-link-hover">View all →</span>
              </dbx-anchor>
              <div class="dbx-pb4" gdColumns="repeat(auto-fit, minmax(200px, 1fr))" gdGap="var(--dbx-padding-3)">
                @for (goal of goals; track goal.label) {
                  <mat-card appearance="outlined">
                    <mat-card-content>
                      <div class="dbx-text-title-small dbx-pb2">{{ goal.label }}</div>
                      <dbx-chip [small]="true" [color]="goal.statusColor">{{ goal.statusLabel }}</dbx-chip>
                      <div class="dbx-flex-bar dbx-pt3">
                        <mat-progress-bar class="dbx-flex-fill doc-coaching-home-goal-progress" mode="determinate" [value]="goal.progress"></mat-progress-bar>
                        <span class="dbx-text-body-small dbx-hint dbx-pl3">{{ goal.progress }}%</span>
                      </div>
                    </mat-card-content>
                  </mat-card>
                }
              </div>
            </dbx-subsection>
            <dbx-subsection header="Recent Reflections" [h]="3">
              <dbx-anchor sectionHeader [anchor]="viewAllReflectionsAnchor">
                <span class="dbx-hint dbx-link-hover">View all →</span>
              </dbx-anchor>
              <div gdColumns="repeat(auto-fit, minmax(260px, 1fr))" gdGap="var(--dbx-padding-3)">
                @for (reflection of reflections; track reflection.prompt) {
                  <mat-card class="doc-coaching-home-reflection" appearance="outlined">
                    <mat-card-content>
                      <div class="dbx-flex-bar dbx-pb2">
                        <span class="dbx-text-title-small dbx-flex-fill">{{ reflection.prompt }}</span>
                        <span class="dbx-text-body-small dbx-hint dbx-pl3">{{ reflection.date }}</span>
                      </div>
                      <mat-divider class="dbx-mb2"></mat-divider>
                      <p class="dbx-hint">{{ reflection.text }}</p>
                    </mat-card-content>
                  </mat-card>
                }
              </div>
            </dbx-subsection>
          </dbx-section>
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocCoachingHomeLayoutExampleComponent {
  private readonly _snackBar = inject(MatSnackBar);

  readonly goals: ReadonlyArray<CoachingHomeGoalView> = COACHING_HOME_GOALS.map((goal) => ({ ...goal, ...COACHING_HOME_GOAL_STATUS_DISPLAY[goal.status] }));
  readonly reflections = COACHING_HOME_REFLECTIONS;

  readonly joinButtonStyle: DbxButtonStyle = { color: { template: 'demo-inverse' } };

  readonly viewAllGoalsAnchor = this._anchorFor('View all goals');
  readonly viewAllReflectionsAnchor = this._anchorFor('View all reflections');

  showClicked(label: string): void {
    this._snackBar.open(`You clicked: ${label}`, 'Dismiss', { duration: 3000 });
  }

  private _anchorFor(label: string): ClickableAnchor {
    return {
      onClick: () => this.showClicked(label)
    };
  }
}
