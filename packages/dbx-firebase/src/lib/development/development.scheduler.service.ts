import { DbxAuthService } from '@dereekb/dbx-core';
import { tap, switchMap, BehaviorSubject, Observable, interval, combineLatest, map, exhaustMap, distinctUntilChanged, shareReplay } from 'rxjs';
import { Initialized, Milliseconds, PromiseUtility } from '@dereekb/util';
import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { lazyFrom, SubscriptionObject, switchMapWhileTrue, tapLog } from '@dereekb/rxjs';
import { FirebaseDevelopmentFunctions, ScheduledFunctionDevelopmentFirebaseFunctionListEntry, ScheduledFunctionDevelopmentFirebaseFunctionListResult, ScheduledFunctionDevelopmentFunctionTypeEnum } from '@dereekb/firebase';

/**
 * Whether or not the scheduler should be enabled.
 */
export const DEFAULT_FIREBASE_DEVELOPMENT_SCHEDULER_ENABLED_TOKEN = new InjectionToken('DefaultDbxFirebaseDevelopmentSchedulerEnabled');

/**
 * Service used for hitting the scheduler in the development environment using the
 */
@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseDevelopmentSchedulerService implements Initialized {
  private _sub = new SubscriptionObject();
  private _enabled = new BehaviorSubject<boolean>(this._startEnabled !== false);
  private _timerInterval = new BehaviorSubject<Milliseconds>(60 * 1000);
  private _error = new BehaviorSubject<boolean>(false);

  readonly enabled$ = this._enabled.asObservable();
  readonly running$ = combineLatest([this._enabled, this.dbxAuthService.authUserState$.pipe(map((x) => x === 'user'))]).pipe(
    map(([enabled, userReady]) => enabled && userReady),
    distinctUntilChanged(),
    shareReplay(1)
  );
  readonly timerInterval$ = this._timerInterval.asObservable();
  readonly error$ = this._error.pipe(distinctUntilChanged());

  readonly schedulerList$: Observable<ScheduledFunctionDevelopmentFirebaseFunctionListEntry[]> = lazyFrom(() => {
    return this.firebaseDevelopmentFunctions
      .scheduledFunction({ type: ScheduledFunctionDevelopmentFunctionTypeEnum.LIST })
      .then((result) => {
        const list = result as ScheduledFunctionDevelopmentFirebaseFunctionListResult;
        return list.list;
      })
      .catch((e) => {
        console.error('Failed to retrieve development schedule list from server.', e);
        throw e;
      });
  });

  constructor(@Optional() @Inject(DEFAULT_FIREBASE_DEVELOPMENT_SCHEDULER_ENABLED_TOKEN) private _startEnabled: boolean, readonly dbxAuthService: DbxAuthService, readonly firebaseDevelopmentFunctions: FirebaseDevelopmentFunctions) {}

  init(): void {
    this._sub.subscription = this.running$
      .pipe(
        tapLog('DbxFirebaseDevelopmentSchedulerService enabled state:'),
        switchMapWhileTrue(() => {
          return combineLatest([this._timerInterval, this.schedulerList$]).pipe(
            switchMap(([timerInterval, schedulerList]) => {
              const executionOrder: string[] = schedulerList.map((x) => x.name);

              return interval(timerInterval).pipe(
                exhaustMap(() => {
                  console.log('Running scheduled tasks in order... ', executionOrder);

                  return PromiseUtility.runTasksForValues(executionOrder, (taskName) => this.runScheduledFunction(taskName), { sequential: true, retriesAllowed: 0, retryWait: 0 }).catch((e) => {
                    console.log('Failed running scheduled task: ', e);
                    this._error.next(true);
                  });
                }),
                tap(() => {
                  console.log('Successfully finished running all scheduled tasks.');
                  this._error.next(false);
                })
              );
            })
          );
        })
      )
      .subscribe();
  }

  runScheduledFunction(taskName: string) {
    return this.firebaseDevelopmentFunctions.scheduledFunction({
      run: taskName,
      type: ScheduledFunctionDevelopmentFunctionTypeEnum.RUN
    });
  }

  setTimer(timerInterval: number) {
    this._timerInterval.next(timerInterval);
  }
}
