import { DbxActionContextStoreSourceInstance, DbxActionDirective } from '@dereekb/dbx-core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, Injector, input, runInInjectionContext, viewChild } from '@angular/core'; // Updated imports
import { DbxLoadingModule } from './loading.module';
import { By } from '@angular/platform-browser';
import { DbxLoadingProgressComponent } from './loading-progress.component';
import { DbxErrorComponent } from '../error';
import { DbxBasicLoadingComponent, LoadingComponentState } from './basic-loading.component';
import { DbxActionModule } from '../action/action.module';
import { filter, first } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop'; // Added import
import { Maybe } from '@dereekb/util';

describe('DbxActionLoadingContextDirective', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DbxLoadingModule, DbxActionModule],
      declarations: [LoadingComponent]
    }).compileComponents();
  });

  // Updated waitForState to work with signals
  function waitForState(state: LoadingComponentState): (component: DbxBasicLoadingComponent) => (checkFn: () => void) => void {
    const injector = TestBed.inject(Injector);

    return (component: DbxBasicLoadingComponent) => {
      return (checkFn: () => void) => {
        runInInjectionContext(injector, () => {
          // Use runInInjectionContext
          toObservable(component.stateSignal) // Use stateSignal and toObservable
            .pipe(
              filter((x) => x === state),
              first()
            )
            .subscribe(checkFn);
        });
      };
    };
  }

  describe('with content', () => {
    let fixture: ComponentFixture<LoadingComponent>;
    let component: LoadingComponent;
    let basicLoadingComponent: DbxBasicLoadingComponent;
    let dbxActionDirective: DbxActionDirective;
    let dbxActionContextStoreSourceInstance: DbxActionContextStoreSourceInstance;

    let waitForComponentToBeLoading: (checkFn: () => void) => void;
    let waitForComponentToHaveContent: (checkFn: () => void) => void;
    let waitForComponentToHaveError: (checkFn: () => void) => void;

    beforeEach(async () => {
      fixture = TestBed.createComponent(LoadingComponent);
      component = fixture.componentInstance;
      basicLoadingComponent = fixture.debugElement.query(By.directive(DbxBasicLoadingComponent)).componentInstance;
      fixture.detectChanges(); // Detect changes to initialize viewChild

      dbxActionDirective = component.dbxActionDirective(); // Access viewChild signal
      dbxActionContextStoreSourceInstance = dbxActionDirective.sourceInstance;

      // Use string states matching DbxBasicLoadingComponent
      waitForComponentToBeLoading = waitForState('loading')(basicLoadingComponent);
      waitForComponentToHaveContent = waitForState('content')(basicLoadingComponent);
      waitForComponentToHaveError = waitForState('error')(basicLoadingComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should display the content if state is idle.', (done) => {
      dbxActionContextStoreSourceInstance.reset();
      fixture.detectChanges();

      waitForComponentToHaveContent(() => {
        const testContent: HTMLElement = fixture.debugElement.query(By.css('#test-content')).nativeElement;
        expect(testContent).not.toBeNull();
        expect(testContent.textContent).toBe(TEST_CONTENT);
        done();
      });
    });

    it('should display loading if state is working.', (done) => {
      dbxActionContextStoreSourceInstance.startWorking();
      fixture.detectChanges();

      waitForComponentToBeLoading(() => {
        const loadingProgressQueryResult = fixture.debugElement.query(By.directive(DbxLoadingProgressComponent));
        expect(loadingProgressQueryResult).not.toBeNull();
        done();
      });
    });

    it('should display error if state is error.', (done) => {
      dbxActionContextStoreSourceInstance.reject(new Error());
      fixture.detectChanges();

      waitForComponentToHaveError(() => {
        const errorQueryResult = fixture.debugElement.query(By.directive(DbxErrorComponent));
        expect(errorQueryResult).not.toBeNull();
        done();
      });
    });
  });
});

const TEST_CONTENT = 'Content';

@Component({
  template: `
    <div dbxActionContext>
      <dbx-loading dbxActionLoadingContext [text]="text()" [show]="show()">
        <div>
          <p id="test-content">${TEST_CONTENT}</p>
        </div>
      </dbx-loading>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class LoadingComponent {
  readonly show = input<Maybe<boolean>>();
  readonly text = input<Maybe<string>>();

  // Use viewChild signal
  readonly dbxActionDirective = viewChild.required(DbxActionDirective);
}
