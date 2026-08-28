import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TimeDistanceCountdownPipe } from '@dereekb/dbx-core';
import { switchMap } from 'rxjs';
import { type CalendarDocumentStore } from '../store/calendar.document.store';
import { DbxFirebaseCalendarIcsRotateButtonComponent } from './calendar.ics.rotate.button.component';

/**
 * The ICS link rotation control, with the prose explaining why it is unavailable when it is.
 *
 * Split from {@link DbxFirebaseCalendarIcsRotateButtonComponent} rather than folded into it because the two
 * have incompatible layout contracts. A bare button is a fixed-size control a caller can put in a toolbar or
 * a button row and trust not to move; this grows and shrinks by a line of text as the calendar's state
 * changes. Callers that need the predictable one take the button directly.
 *
 * Both disabled reasons are stated here, since a disabled control with no explanation is the one thing the
 * bare button cannot fix on its own.
 */
@Component({
  selector: 'dbx-firebase-calendar-ics-rotate',
  template: `
    <dbx-firebase-calendar-ics-rotate-button [calendarDocumentStore]="calendarDocumentStore()"></dbx-firebase-calendar-ics-rotate-button>
    @if (!existsSignal()) {
      <div class="dbx-small dbx-hint dbx-pt2">This calendar does not exist yet, so there is no link to revoke.</div>
    } @else if (throttledUntilSignal(); as throttledUntil) {
      <div class="dbx-small dbx-hint dbx-pt2">This link was rotated recently. It can be rotated again {{ throttledUntil | timeCountdownDistance }}.</div>
    }
  `,
  host: { class: 'dbx-firebase-calendar-ics-rotate' },
  imports: [DbxFirebaseCalendarIcsRotateButtonComponent, TimeDistanceCountdownPipe],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseCalendarIcsRotateComponent {
  /**
   * Store for the calendar whose link is rotated. Handed straight to the button.
   */
  readonly calendarDocumentStore = input.required<CalendarDocumentStore>();

  readonly calendarDocumentStore$ = toObservable(this.calendarDocumentStore);

  readonly existsSignal = toSignal(this.calendarDocumentStore$.pipe(switchMap((x) => x.exists$)), { initialValue: false });

  readonly isThrottledSignal = toSignal(this.calendarDocumentStore$.pipe(switchMap((x) => x.isIcsRotateThrottled$)), { initialValue: false });

  readonly nextIcsRotateAtSignal = toSignal(this.calendarDocumentStore$.pipe(switchMap((x) => x.nextIcsRotateAt$)));

  /**
   * The time the throttle lifts, or undefined when a rotation is allowed right now.
   *
   * Gated on the throttle rather than rendered from the date alone: `nextIcsRotateAt` stays populated once
   * the window has passed, and a hint counting down to a time already gone reads as a bug.
   */
  readonly throttledUntilSignal = computed(() => {
    // both read unconditionally, so the computed tracks them on every run
    const isThrottled = this.isThrottledSignal();
    const nextIcsRotateAt = this.nextIcsRotateAtSignal();

    return isThrottled ? nextIcsRotateAt : undefined;
  });
}
