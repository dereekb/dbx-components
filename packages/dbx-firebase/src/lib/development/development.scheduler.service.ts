import { DbxAuthService } from '@dereekb/dbx-core';
import { tap, switchMap, BehaviorSubject, Observable, interval, combineLatest, map, exhaustMap, distinctUntilChanged, shareReplay } from 'rxjs';
import { Initialized, Milliseconds, runAsyncTasksForValues } from '@dereekb/util';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { lazyFrom, SubscriptionObject, switchMapWhileTrue } from '@dereekb/rxjs';
import { FirebaseDevelopmentFunctions, ScheduledFunctionDevelopmentFirebaseFunctionListEntry, ScheduledFunctionDevelopmentFirebaseFunctionListResult, ScheduledFunctionDevelopmentFunctionTypeEnum } from '@dereekb/firebase';

/**
 * Whether or not the scheduler should be enabled.
 */
export const DEFAULT_FIREBASE_DEVELOPMENT_SCHEDULER_ENABLED_TOKEN = new InjectionToken('DefaultDbxFirebaseDevelopmentSchedulerEnabled');

/**
 * Service used for hitting the scheduler in the development environment using the
 */
@Injectable()
export class DbxFirebaseDevelopmentSchedulerService implements Initialized {
  readonly dbxAuthService = inject(DbxAuthService);
  readonly firebaseDevelopmentFunctions = inject(FirebaseDevelopmentFunctions);

  private readonly _sub = new SubscriptionObject();
  private readonly _enabled = new BehaviorSubject<boolean>(inject<boolean>(DEFAULT_FIREBASE_DEVELOPMENT_SCHEDULER_ENABLED_TOKEN, { optional: true }) !== false);

  private readonly _timerInterval = new BehaviorSubject<Milliseconds>(60 * 1000);
  private readonly _error = new BehaviorSubject<boolean>(false);

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

  init(): void {
    this._sub.subscription = this.running$
      .pipe(
        switchMapWhileTrue(() => {
          console.log('DbxFirebaseDevelopmentSchedulerService enabled.');
          return combineLatest([this._timerInterval, this.schedulerList$]).pipe(
            switchMap(([timerInterval, schedulerList]) => {
              const executionOrder: string[] = schedulerList.map((x) => x.name);

              return interval(timerInterval).pipe(
                exhaustMap(() => {
                  console.log('Running scheduled tasks in order... ', executionOrder);

                  return runAsyncTasksForValues(executionOrder, (taskName) => this.runScheduledFunction(taskName), { sequential: true, retriesAllowed: false })
                    .then(() => true)
                    .catch((e) => {
                      console.log('Failed running scheduled task: ', e);
                      this._error.next(true);
                      return false;
                    });
                }),
                tap((success) => {
                  if (success) {
                    console.log('Successfully finished running all scheduled tasks.');
                    this._error.next(false);
                  }
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
