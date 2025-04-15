import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, Injector, input, runInInjectionContext, signal, viewChild } from '@angular/core';
import { DbxLoadingModule } from './loading.module';
import { By } from '@angular/platform-browser';
import { DbxLoadingProgressComponent } from './loading-progress.component';
import { tapLog, ValuesLoadingContext } from '@dereekb/rxjs';
import { DbxErrorComponent } from '../error';
import { DbxBasicLoadingComponent, LoadingComponentState } from './basic-loading.component';
import { filter, first } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { ErrorInput, Maybe } from '@dereekb/util';
import { DbxLoadingComponent } from './loading.component';

describe('DbxLoadingComponent', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DbxLoadingModule],
      declarations: [TestLoadingComponent]
    }).compileComponents();
  });

  function waitForState(state: LoadingComponentState): (component: DbxBasicLoadingComponent) => (checkFn: () => void) => void {
    const injector = TestBed.inject(Injector);

    return (component: DbxBasicLoadingComponent) => {
      return (checkFn: () => void) => {
        runInInjectionContext(injector, () => {
          toObservable(component.stateSignal)
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
    let fixture: ComponentFixture<TestLoadingComponent>;

    let component: TestLoadingComponent;
    let loadingComponent: DbxLoadingComponent;
    let basicLoadingComponent: DbxBasicLoadingComponent;

    let waitForComponentToBeLoading: (checkFn: () => void) => void;
    let waitForComponentToHaveContent: (checkFn: () => void) => void;
    let waitForComponentToHaveError: (checkFn: () => void) => void;

    beforeEach(async () => {
      fixture = TestBed.createComponent(TestLoadingComponent);

      component = fixture.componentInstance;
      loadingComponent = fixture.debugElement.query(By.directive(DbxLoadingComponent)).componentInstance;
      basicLoadingComponent = fixture.debugElement.query(By.directive(DbxBasicLoadingComponent)).componentInstance;

      waitForComponentToBeLoading = waitForState('loading')(basicLoadingComponent);
      waitForComponentToHaveContent = waitForState('content')(basicLoadingComponent);
      waitForComponentToHaveError = waitForState('error')(basicLoadingComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should display the content if not loading and no error', (done) => {
      component.context.setLoading(false);
      fixture.detectChanges();

      waitForComponentToHaveContent(() => {
        const testContent: HTMLElement = fixture.debugElement.query(By.css('#test-content')).nativeElement;

        expect(testContent).not.toBeNull();
        expect(testContent.textContent).toBe(TEST_CONTENT);
        done();
      });
    });

    describe('and error', () => {
      beforeEach(() => {
        component.context.setError({
          code: 'Test',
          message: 'Test'
        });

        fixture.detectChanges();
        setTimeout(() => fixture.detectChanges(), 10);
      });

      it('should display the error.', (done) => {
        waitForComponentToHaveError(() => {
          const errorComponentQueryResult = fixture.debugElement.query(By.directive(DbxErrorComponent));
          expect(errorComponentQueryResult).not.toBeNull();
          done();
        });
      });

      it('should not display the content.', (done) => {
        waitForComponentToHaveError(() => {
          const testContentQueryResult = fixture.debugElement.query(By.css('#test-content'));
          expect(testContentQueryResult).toBeNull();
          done();
        });
      });
    });

    describe('and loading', () => {
      beforeEach(() => {
        component.context.setLoading(true);

        fixture.detectChanges();
        setTimeout(() => fixture.detectChanges(), 10);
      });

      it('should display the loading progress view while loading.', (done) => {
        waitForComponentToBeLoading(() => {
          const loadingProgressQueryResult = fixture.debugElement.query(By.directive(DbxLoadingProgressComponent));
          expect(loadingProgressQueryResult).not.toBeNull();
          done();
        });
      });
    });
  });
});

const TEST_CONTENT = 'Content';

@Component({
  selector: 'dbx-test-loading-component',
  template: `
    <dbx-loading [context]="context" [text]="text()" [show]="show()">
      <div>
        <p id="test-content">${TEST_CONTENT}</p>
      </div>
    </dbx-loading>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestLoadingComponent {
  readonly show = input<Maybe<boolean>>();
  readonly text = input<Maybe<string>>();

  readonly context = new ValuesLoadingContext();
}
