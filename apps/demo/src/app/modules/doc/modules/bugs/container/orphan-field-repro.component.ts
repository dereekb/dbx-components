import { ChangeDetectionStrategy, Component, type OnDestroy, type OnInit, inject, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { DbxForgeFormComponentImportsModule, DbxForgeFormContext, DbxFormSourceDirective, dbxForgeFormComponentProviders, dbxForgeTextField } from '@dereekb/dbx-form';
import { DbxCalendarScheduleSelectionStore, dbxForgeDateScheduleRangeField } from '@dereekb/dbx-form/calendar';
import { DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { DbxContentContainerDirective, DbxContentBorderDirective, DbxContentPitDirective, DbxButtonComponent, DbxButtonSpacerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

const TIMEZONE = 'America/Chicago';
const FILTER_START = new Date('2026-04-16T05:00:00.000Z');
const FILTER_END = new Date('2026-05-28T05:00:00.000Z');

interface OrphanReproFormValue {
  readonly n?: string;
  readonly dateScheduleRange?: {
    readonly start: Date;
    readonly end: Date;
    readonly w?: string;
  };
}

type ViewState = 'form' | 'success';

@Component({
  templateUrl: './orphan-field-repro.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxContentBorderDirective, DbxContentPitDirective, DbxButtonComponent, DbxButtonSpacerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxForgeFormComponentImportsModule, DbxFormSourceDirective],
  providers: [...dbxForgeFormComponentProviders(), DbxCalendarStore, DbxCalendarScheduleSelectionStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocBugsOrphanFieldReproComponent implements OnInit, OnDestroy {
  // TODO: link to production Trello/Zoho ticket once the convention exists.
  readonly context = inject(DbxForgeFormContext) as DbxForgeFormContext<OrphanReproFormValue>;

  // Start with a complete value so the form renders correctly on first mount.
  // Subsequent "Emit partial" / "Emit empty" pushes drop the dateScheduleRange
  // slot — exactly the shape that triggers NG01902 under dbxFormSourceMode="always".
  readonly source$ = new BehaviorSubject<Partial<OrphanReproFormValue>>({
    n: 'Initial',
    dateScheduleRange: {
      start: FILTER_START,
      end: FILTER_END,
      w: '8'
    }
  });

  readonly formConfig: FormConfig = {
    fields: [dbxForgeTextField({ key: 'n', label: 'Name' }), dbxForgeDateScheduleRangeField({ key: 'dateScheduleRange', required: true, outputTimezone: TIMEZONE })]
  } as FormConfig;

  readonly totalErrors = signal(0);
  readonly orphanErrors = signal(0);
  readonly lastError = signal<string>('');
  readonly viewState = signal<ViewState>('form');

  private _originalConsoleError: typeof console.error | undefined;

  ngOnInit(): void {
    this.context.config = this.formConfig;
    this._installConsolePatch();
  }

  ngOnDestroy(): void {
    this._restoreConsole();
    this.source$.complete();
  }

  resetCounters(): void {
    this.totalErrors.set(0);
    this.orphanErrors.set(0);
    this.lastError.set('');
  }

  emitComplete(): void {
    this.source$.next({
      n: 'Test',
      dateScheduleRange: {
        start: FILTER_START,
        end: FILTER_END,
        w: '8'
      }
    });
  }

  emitPartial(): void {
    this.source$.next({ n: 'Test' });
  }

  emitEmpty(): void {
    this.source$.next({});
  }

  // Mirror the production per-field setValue cascade: three partial emissions in
  // a single tick, none of which carry the dateScheduleRange slot.
  emitCascade(): void {
    this.source$.next({ n: 'A' });
    this.source$.next({ n: 'AB' });
    this.source$.next({ n: 'ABC' });
  }

  // Closest analog to school.createjob.component.ts's reset() flow:
  // unmount the form, wait 200ms (matches the production delay(200)),
  // remount it, then push a partial value that omits dateScheduleRange.
  async runResetCycle(): Promise<void> {
    this.viewState.set('success');
    await waitMs(200);
    this.viewState.set('form');
    await waitMs(200);
    this.source$.next({ n: 'After Reset' });
  }

  private _installConsolePatch(): void {
    if (this._originalConsoleError) return;

    const original = console.error.bind(console);
    this._originalConsoleError = original;

    console.error = (...args: unknown[]) => {
      const message = args
        .map((a) => {
          let result: string;
          if (typeof a === 'string') {
            result = a;
          } else if (a instanceof Error) {
            result = `${a.name}: ${a.message}`;
          } else {
            try {
              result = JSON.stringify(a);
            } catch {
              result = String(a);
            }
          }
          return result;
        })
        .join(' ');

      this.totalErrors.update((c) => c + 1);
      if (message.includes('NG01902') || message.includes('Orphan field')) {
        this.orphanErrors.update((c) => c + 1);
      }
      this.lastError.set(message.length > 240 ? `${message.slice(0, 240)}…` : message);

      original(...(args as Parameters<typeof console.error>));
    };
  }

  private _restoreConsole(): void {
    if (this._originalConsoleError) {
      console.error = this._originalConsoleError;
      this._originalConsoleError = undefined;
    }
  }
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
