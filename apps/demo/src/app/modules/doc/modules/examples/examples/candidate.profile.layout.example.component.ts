import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type DbxButtonStyle, type DbxColorInput, DbxAnchorComponent, DbxAvatarComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxChipDirective, DbxColorDirective, DbxIconTileComponent } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';

interface CandidateProfileTag {
  readonly label: string;
  readonly icon: string;
  /**
   * Chip color. Omitted tags use the tonal `grey` chip.
   */
  readonly color?: Maybe<DbxColorInput>;
}

interface CandidateProfileContactLine {
  readonly label: string;
  readonly icon: string;
}

interface CandidateProfileActivity {
  readonly type: string;
  readonly icon: string;
  readonly title: string;
  readonly time: string;
  readonly text: string;
}

interface CandidateProfileSearch {
  readonly title: string;
  readonly company: string;
  readonly status: string;
}

const CANDIDATE_PROFILE_TAGS: ReadonlyArray<CandidateProfileTag> = [
  { label: 'San Francisco, CA', icon: 'location_on' },
  { label: 'Open to new opportunities', icon: 'schedule' },
  { label: 'High Priority', icon: 'flag', color: 'warn' }
];

const CANDIDATE_PROFILE_SKILLS: ReadonlyArray<string> = ['Engineering Leadership', 'Scaling Teams', 'Fintech', 'B2B SaaS', 'Go-to-Market'];

const CANDIDATE_PROFILE_CONTACT_LINES: ReadonlyArray<CandidateProfileContactLine> = [
  { label: 'alex.chen@example.com', icon: 'mail_outline' },
  { label: '+1 (415) 555-0187', icon: 'call' },
  { label: 'San Francisco, CA', icon: 'location_on' }
];

const CANDIDATE_PROFILE_ACTIVITY: ReadonlyArray<CandidateProfileActivity> = [
  { type: 'Email', icon: 'mail_outline', title: 'Re: Introduction to advisory', time: '2h ago', text: "Thanks for the thoughtful note. I'd be open to learning more about the role and the team." },
  { type: 'Call', icon: 'call', title: 'Initial conversation', time: '3d ago', text: 'Discussed background, interests, and potential opportunities.' },
  { type: 'Note', icon: 'edit_note', title: 'Strong candidate for Series B fintech search', time: '3d ago', text: 'Great experience and cultural fit. Follow up next week.' }
];

const CANDIDATE_PROFILE_SEARCHES: ReadonlyArray<CandidateProfileSearch> = [
  { title: 'VP Engineering', company: 'Lorem AI', status: 'Active' },
  { title: 'Head of Platform', company: 'Series B Fintech', status: 'Pipeline' }
];

const CANDIDATE_PROFILE_OTHER_TABS: ReadonlyArray<string> = ['Activity', 'Experience', 'Skills', 'Documents', 'Searches', 'Notes'];

/**
 * Static candidate profile page mockup: a header with a large
 * `<dbx-avatar>`, the name and title, a row of small `<dbx-chip>` tags
 * with inline `<mat-icon>`s, and the page actions; a start-aligned
 * `<mat-tab-group>`; then two rows of outlined `<mat-card>`s — "About"
 * (bio plus a wrap of skill chips) beside "Contact", and "Recent Activity"
 * beside "Searches".
 *
 * The card rows are flex rows that wrap (`.doc-candidate-profile-row`):
 * the main card is `flex: 2 1 420px` and the side card `flex: 1 1 260px`,
 * so they share a row about 2:1 while there is room for both bases and
 * the side card drops below the main one once there isn't. That switches
 * on the row's own width rather than a viewport breakpoint, and the cards
 * in a row stretch to the same height. The header wraps the same way, so
 * the actions fall below the name on a narrow page.
 *
 * Card headings are `<h3 class="dbx-m0 dbx-pb3">`; the two lower cards put
 * the heading in a `.dbx-flex-bar` with a "View all →" `<dbx-anchor>`.
 * Contact and activity rows lead with small tonal `grey`
 * `<dbx-icon-tile>`s sized through the `--dbx-icon-tile-*` tokens, and the
 * LinkedIn mark is a `primary` tile with projected "in" text instead of
 * an icon. Activity rows truncate their text with `.dbx-text-truncate`
 * inside a `.dbx-flex-fill-0` column. The "Add to Search" `<dbx-button>`
 * uses the app's `demo-inverse` color template. Every button and link
 * opens a `MatSnackBar` so each action is demonstrably wired.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug layout-candidate-profile
 * @dbxDocsUiExampleCategory layout
 * @dbxDocsUiExampleSummary Candidate profile page — dbx-avatar header with icon dbx-chip tags and actions, start-aligned mat-tab-group, and wrapping 2:1 rows of mat-cards: an About card with skill chips, a Contact card with icon-tile rows, a Recent Activity list, and a Searches list.
 * @dbxDocsUiExampleRelated dbx-avatar, dbx-chip, mat-icon, mat-tab-group, mat-card, dbx-icon-tile, dbx-color, dbx-button, button-spacer, dbx-anchor, dbx-link-hover, dbx-flex-bar, dbx-flex-fill-0, dbx-text-truncate
 */
@Component({
  selector: 'doc-candidate-profile-layout-example',
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxAnchorComponent, DbxAvatarComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxChipDirective, DbxColorDirective, DbxIconTileComponent, MatCardModule, MatIconModule, MatTabsModule, FlexLayoutModule],
  styles: [
    `
      .doc-candidate-profile-page {
        background: var(--mat-sys-surface-container-low);
        border-radius: var(--mat-sys-corner-large);
      }

      .doc-candidate-profile-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--dbx-padding-4);
      }

      .doc-candidate-profile-header-info {
        flex: 1 1 280px;
        min-width: 0;
      }

      .doc-candidate-profile-wrap {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--dbx-padding-2);
      }

      .doc-candidate-profile-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--dbx-padding-3);
      }

      .doc-candidate-profile-main {
        flex: 2 1 420px;
        min-width: 0;
      }

      .doc-candidate-profile-side {
        flex: 1 1 260px;
        min-width: 0;
      }

      .doc-candidate-profile-small-tile {
        --dbx-icon-tile-width: 32px;
        --dbx-icon-tile-height: 32px;
        --dbx-icon-tile-min-width: 32px;
        --dbx-icon-tile-padding: 0;
        --dbx-icon-tile-icon-size: 18px;
        --dbx-icon-tile-font-size: 14px;
        --dbx-icon-tile-font-weight: 700;
      }

      .doc-candidate-profile-activity-type {
        flex: 0 0 56px;
      }
    `
  ],
  template: `
    <dbx-docs-ui-example header="Candidate Profile Layout" hint="Avatar header with tags + tabs over wrapping rows of About / Contact and Recent Activity / Searches cards.">
      <dbx-docs-ui-example-info>
        <p>
          The header is a large
          <code>&lt;dbx-avatar [avatarName]&gt;</code>
          beside the name, title, and a row of
          <code>&lt;dbx-chip [small]&gt;</code>
          tags that lead with an inline
          <code>&lt;mat-icon inline&gt;</code>
          (tonal
          <code>grey</code>
          , and
          <code>warn</code>
          for "High Priority"), with the page actions on the right. The header is a wrapping flex row, so on a narrow page the actions fall below the name. The tabs are a start-aligned
          <code>&lt;mat-tab-group&gt;</code>
          .
        </p>
        <p>
          The cards sit in two wrapping flex rows: the main card is
          <code>flex: 2 1 420px</code>
          and the side card
          <code>flex: 1 1 260px</code>
          , so they share a row about 2:1 while both fit and the side card drops below the main one once they don't. That depends on the row's own width rather than on a viewport breakpoint, and the cards in a row stretch to the same height. Card headings are
          <code>&lt;h3 class="dbx-m0 dbx-pb3"&gt;</code>
          , and the lower cards pair theirs with a "View all →"
          <code>&lt;dbx-anchor&gt;</code>
          in a
          <code>.dbx-flex-bar</code>
          .
        </p>
        <p>
          Contact and activity rows lead with small tonal
          <code>&lt;dbx-icon-tile&gt;</code>
          s sized through the
          <code>--dbx-icon-tile-*</code>
          tokens. The LinkedIn mark is a
          <code>primary</code>
          tile with projected "in" text instead of an icon, styled by
          <code>--dbx-icon-tile-font-size</code>
          /
          <code>--dbx-icon-tile-font-weight</code>
          . Activity text truncates with
          <code>.dbx-text-truncate</code>
          inside a
          <code>.dbx-flex-fill-0</code>
          column, so long notes end in an ellipsis instead of widening the card.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-p4 doc-candidate-profile-page">
          <div class="doc-candidate-profile-header">
            <dbx-avatar avatarName="Alex Chen" avatarSize="large"></dbx-avatar>
            <div class="doc-candidate-profile-header-info">
              <h1 class="dbx-text-display-small dbx-m0 dbx-pb1">Alex Chen</h1>
              <p class="dbx-text-body-large dbx-hint dbx-m0 dbx-pb3">VP of Engineering · Fintech & B2B SaaS</p>
              <div class="doc-candidate-profile-wrap">
                @for (tag of tags; track tag.label) {
                  <dbx-chip [small]="true" [color]="tag.color ?? 'grey'">
                    <mat-icon inline class="dbx-icon-spacer">{{ tag.icon }}</mat-icon>
                    {{ tag.label }}
                  </dbx-chip>
                }
              </div>
            </div>
            <div class="dbx-flex-bar">
              <dbx-button flat text="Add to Search" [buttonStyle]="addToSearchButtonStyle" (buttonClick)="showClicked('Add to Search')"></dbx-button>
              <dbx-button-spacer></dbx-button-spacer>
              <dbx-button stroked iconOnly icon="more_horiz" ariaLabel="More actions" (buttonClick)="showClicked('More')"></dbx-button>
            </div>
          </div>
          <mat-tab-group class="dbx-pt3" mat-stretch-tabs="false" mat-align-tabs="start">
            <mat-tab label="Overview">
              <div class="dbx-pt4 doc-candidate-profile-row">
                <mat-card class="doc-candidate-profile-main" appearance="outlined">
                  <mat-card-content>
                    <h3 class="dbx-text-title-medium dbx-m0 dbx-pb3">About</h3>
                    <p class="dbx-text-body-large dbx-pb3">Experienced engineering leader with 12+ years building and scaling high-performing teams at high-growth B2B SaaS companies. Most recently led engineering at Lorem Pay, where she scaled the team from 50 to 300+.</p>
                    <div class="doc-candidate-profile-wrap">
                      @for (skill of skills; track skill) {
                        <dbx-chip color="grey">{{ skill }}</dbx-chip>
                      }
                    </div>
                  </mat-card-content>
                </mat-card>
                <mat-card class="doc-candidate-profile-side" appearance="outlined">
                  <mat-card-content>
                    <h3 class="dbx-text-title-medium dbx-m0 dbx-pb3">Contact</h3>
                    @for (line of contactLines; track line.icon) {
                      <div class="dbx-flex-bar dbx-pb2">
                        <dbx-icon-tile class="doc-candidate-profile-small-tile" [icon]="line.icon" [round]="true" dbxColor="grey" [dbxColorTone]="18"></dbx-icon-tile>
                        <span class="dbx-text-body-medium dbx-pl3">{{ line.label }}</span>
                      </div>
                    }
                    <div class="dbx-pt2 doc-candidate-profile-wrap">
                      <dbx-icon-tile class="doc-candidate-profile-small-tile" dbxColor="primary">in</dbx-icon-tile>
                      <dbx-button stroked text="LinkedIn" (buttonClick)="showClicked('LinkedIn')"></dbx-button>
                      <dbx-button stroked icon="description" text="View Resume" (buttonClick)="showClicked('View Resume')"></dbx-button>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
              <div class="dbx-pt3 doc-candidate-profile-row">
                <mat-card class="doc-candidate-profile-main" appearance="outlined">
                  <mat-card-content>
                    <div class="dbx-flex-bar dbx-pb3">
                      <h3 class="dbx-text-title-medium dbx-m0 dbx-flex-fill">Recent Activity</h3>
                      <dbx-anchor [anchor]="viewAllActivityAnchor">
                        <span class="dbx-text-body-small dbx-hint dbx-link-hover">View all →</span>
                      </dbx-anchor>
                    </div>
                    @for (item of activity; track item.title) {
                      <div class="dbx-pb3" fxLayout="row" fxLayoutAlign="start start" fxLayoutGap="var(--dbx-padding-3)">
                        <dbx-icon-tile class="doc-candidate-profile-small-tile" [icon]="item.icon" dbxColor="grey" [dbxColorTone]="18"></dbx-icon-tile>
                        <span class="dbx-text-body-medium doc-candidate-profile-activity-type">{{ item.type }}</span>
                        <div class="dbx-flex-fill-0">
                          <div class="dbx-flex-bar">
                            <span class="dbx-text-title-small dbx-flex-fill-0 dbx-text-truncate">{{ item.title }}</span>
                            <span class="dbx-text-body-small dbx-hint dbx-nowrap dbx-pl3">{{ item.time }}</span>
                          </div>
                          <div class="dbx-text-body-small dbx-hint dbx-text-truncate">{{ item.text }}</div>
                        </div>
                      </div>
                    }
                  </mat-card-content>
                </mat-card>
                <mat-card class="doc-candidate-profile-side" appearance="outlined">
                  <mat-card-content>
                    <div class="dbx-flex-bar dbx-pb3">
                      <h3 class="dbx-text-title-medium dbx-m0 dbx-flex-fill">Searches</h3>
                      <dbx-anchor [anchor]="viewAllSearchesAnchor">
                        <span class="dbx-text-body-small dbx-hint dbx-link-hover">View all →</span>
                      </dbx-anchor>
                    </div>
                    @for (search of searches; track search.title) {
                      <div class="dbx-flex-bar dbx-pb3">
                        <dbx-icon-tile class="doc-candidate-profile-small-tile" icon="work_outline" dbxColor="primary"></dbx-icon-tile>
                        <div class="dbx-flex-fill-0 dbx-pl3">
                          <div class="dbx-text-title-small dbx-text-truncate">{{ search.title }}</div>
                          <div class="dbx-text-body-small dbx-hint dbx-text-truncate">{{ search.company }} · {{ search.status }}</div>
                        </div>
                      </div>
                    }
                  </mat-card-content>
                </mat-card>
              </div>
            </mat-tab>
            @for (tab of otherTabs; track tab) {
              <mat-tab [label]="tab">
                <p class="dbx-hint dbx-pt4">{{ tab }} would go here.</p>
              </mat-tab>
            }
          </mat-tab-group>
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocCandidateProfileLayoutExampleComponent {
  private readonly _snackBar = inject(MatSnackBar);

  readonly tags = CANDIDATE_PROFILE_TAGS;
  readonly skills = CANDIDATE_PROFILE_SKILLS;
  readonly contactLines = CANDIDATE_PROFILE_CONTACT_LINES;
  readonly activity = CANDIDATE_PROFILE_ACTIVITY;
  readonly searches = CANDIDATE_PROFILE_SEARCHES;
  readonly otherTabs = CANDIDATE_PROFILE_OTHER_TABS;

  readonly addToSearchButtonStyle: DbxButtonStyle = { color: { template: 'demo-inverse' } };

  readonly viewAllActivityAnchor = this._anchorFor('View all activity');
  readonly viewAllSearchesAnchor = this._anchorFor('View all searches');

  showClicked(label: string): void {
    this._snackBar.open(`You clicked: ${label}`, 'Dismiss', { duration: 3000 });
  }

  private _anchorFor(label: string): ClickableAnchor {
    return {
      onClick: () => this.showClicked(label)
    };
  }
}
