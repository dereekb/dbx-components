import { toObservable } from '@angular/core/rxjs-interop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, Injector, runInInjectionContext, signal, viewChild } from '@angular/core';
import { DbxLoadingModule } from './loading.module';
import { By } from '@angular/platform-browser';
import { DbxLoadingProgressComponent } from './loading-progress.component';
import { ErrorInput } from '@dereekb/util';
import { LoadingComponentState, DbxBasicLoadingComponent } from './basic-loading.component';
import { DbxErrorComponent } from '../error/error.component';
import { filter, first } from 'rxjs';

describe('DbxBasicLoadingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DbxLoadingModule],
      declarations: [BasicLoadingWithContentComponent, BasicLoadingWithCustomErrorComponent, BasicLoadingWithCustomLoadingComponent]
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
    let fixture: ComponentFixture<BasicLoadingWithContentComponent>;
    let component: BasicLoadingWithContentComponent;

    let waitForComponentToBeLoading: (checkFn: () => void) => void;
    let waitForComponentToHaveContent: (checkFn: () => void) => void;
    let waitForComponentToHaveError: (checkFn: () => void) => void;

    beforeEach(() => {
      fixture = TestBed.createComponent(BasicLoadingWithContentComponent);
      component = fixture.componentInstance;

      component.loadingSignal.set(false);
      fixture.detectChanges();

      waitForComponentToBeLoading = waitForState('loading')(component.component()!);
      waitForComponentToHaveContent = waitForState('content')(component.component()!);
      waitForComponentToHaveError = waitForState('error')(component.component()!);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should display the content while not loading.', (done) => {
      waitForComponentToHaveContent(() => {
        expect(component.loadingSignal()).toBe(false);
        const testContent: HTMLElement = fixture.debugElement.query(By.css('#test-content')).nativeElement;
        expect(testContent).not.toBeNull();
        expect(testContent.textContent).toBe(TEST_CONTENT);
        done();
      });
    });

    describe('and loading', () => {
      beforeEach(async () => {
        component.loadingSignal.set(true);
        fixture.detectChanges();
      });

      it('should not display the content.', (done) => {
        waitForComponentToBeLoading(() => {
          const testContentQueryResult = fixture.debugElement.query(By.css('#test-content'));
          expect(testContentQueryResult).toBeNull();
          done();
        });
      });

      it('should display the loading progress view.', (done) => {
        const injector = TestBed.inject(Injector);

        waitForComponentToBeLoading(() => {
          runInInjectionContext(injector, () => {
            toObservable(fixture.componentInstance.component()?.hasNoCustomLoadingSignal!)
              .pipe(
                filter((x) => x),
                first()
              )
              .subscribe((hasNoCustomLoading) => {
                expect(hasNoCustomLoading).toBe(true);
                const loadingProgressQueryResult = fixture.debugElement.query(By.directive(DbxLoadingProgressComponent));
                expect(loadingProgressQueryResult).not.toBeNull();
                done();
              });
          });
        });
      });

      it('should not detect custom loading content (that does not exist).', (done) => {
        const injector = TestBed.inject(Injector);

        waitForComponentToBeLoading(() => {
          fixture.detectChanges();
          runInInjectionContext(injector, () => {
            toObservable(fixture.componentInstance.component()?.hasNoCustomLoadingSignal!)
              .pipe(
                filter((x) => x),
                first()
              )
              .subscribe((hasNoCustomLoading) => {
                expect(hasNoCustomLoading).toBe(true);
                done();
              });
          });
        });
      });
    });

    describe('and error', () => {
      beforeEach(() => {
        component.errorSignal.set({
          code: 'Test',
          message: 'Test'
        });

        fixture.detectChanges();
      });

      it('should not display the content.', (done) => {
        waitForComponentToHaveError(() => {
          const testContentQueryResult = fixture.debugElement.query(By.css('#test-content'));
          expect(testContentQueryResult).toBeNull();
          done();
        });
      });

      it('should display the error view.', (done) => {
        waitForComponentToHaveError(() => {
          const errorComponentQueryResult = fixture.debugElement.query(By.directive(DbxErrorComponent));
          expect(errorComponentQueryResult).not.toBeNull();
          done();
        });
      });

      it('should not detect custom error content (that does not exist).', (done) => {
        const injector = TestBed.inject(Injector);

        waitForComponentToHaveError(() => {
          fixture.detectChanges();
          runInInjectionContext(injector, () => {
            toObservable(fixture.componentInstance.component()?.hasNoCustomErrorSignal!)
              .pipe(
                filter((x) => x),
                first()
              )
              .subscribe((hasNoCustomError) => {
                expect(hasNoCustomError).toBe(true);
                done();
              });
          });
        });
      });
    });
  });

  describe('with custom error', () => {
    let fixture: ComponentFixture<BasicLoadingWithCustomErrorComponent>;
    let component: BasicLoadingWithCustomErrorComponent;

    let waitForComponentToHaveError: (checkFn: () => void) => void;

    beforeEach(async () => {
      fixture = TestBed.createComponent(BasicLoadingWithCustomErrorComponent);
      component = fixture.componentInstance;
      waitForComponentToHaveError = waitForState('error')(component.component()!);

      component.errorSignal.set({
        code: 'Test',
        message: 'Test'
      });

      fixture.detectChanges();
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should display the custom error content on error.', (done) => {
      waitForComponentToHaveError(() => {
        const customError: HTMLElement = fixture.debugElement.query(By.css('#test-error')).nativeElement;
        expect(customError).not.toBeNull();
        expect(customError.textContent).toBe(CUSTOM_ERROR_CONTENT);
        done();
      });
    });

    it('should detect the custom error content.', (done) => {
      waitForComponentToHaveError(() => {
        const injector = TestBed.inject(Injector);

        runInInjectionContext(injector, () => {
          toObservable(component.component()?.hasNoCustomErrorSignal!)
            .pipe(
              filter((x) => !x),
              first()
            )
            .subscribe((hasNoCustomError) => {
              expect(hasNoCustomError).toBe(false);
              done();
            });
        });
      });
    });
  });

  describe('with custom loading', () => {
    let fixture: ComponentFixture<BasicLoadingWithCustomLoadingComponent>;
    let component: BasicLoadingWithCustomLoadingComponent;

    let waitForComponentToBeLoading: (checkFn: () => void) => void;

    beforeEach(async () => {
      fixture = TestBed.createComponent(BasicLoadingWithCustomLoadingComponent);
      component = fixture.componentInstance;
      component.loadingSignal.set(true);
      fixture.detectChanges();
      waitForComponentToBeLoading = waitForState('loading')(component.component()!);
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('should display the custom loading content while loading.', (done) => {
      waitForComponentToBeLoading(() => {
        const customLoading: HTMLElement = fixture.debugElement.query(By.css('#custom-loading')).nativeElement;
        expect(customLoading).not.toBeNull();
        expect(customLoading.textContent).toBe(CUSTOM_LOADING_CONTENT);
        done();
      });
    });

    it('should detect the custom loading content.', (done) => {
      waitForComponentToBeLoading(() => {
        fixture.detectChanges();
        const injector = TestBed.inject(Injector);

        runInInjectionContext(injector, () => {
          toObservable(component.component()?.hasNoCustomLoadingSignal!)
            .pipe(
              filter((x) => !x),
              first()
            )
            .subscribe((hasNoCustomLoading) => {
              expect(hasNoCustomLoading).toBe(false);
              done();
            });
        });
      });
    });
  });
});

const TEST_CONTENT = 'Content';
const CUSTOM_LOADING_CONTENT = 'Custom Loading...';
const CUSTOM_ERROR_CONTENT = 'Error.';

@Component({
  template: `
    <dbx-basic-loading [loading]="loadingSignal()" [error]="errorSignal()">
      <div>
        <p id="test-content">${TEST_CONTENT}</p>
      </div>
    </dbx-basic-loading>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class BasicLoadingWithContentComponent {
  readonly loadingSignal = signal(true);
  readonly errorSignal = signal<ErrorInput | undefined>(undefined);

  readonly component = viewChild.required(DbxBasicLoadingComponent);
}

@Component({
  template: `
    <dbx-basic-loading [error]="errorSignal()">
      <div error>
        <p id="test-error">${CUSTOM_ERROR_CONTENT}</p>
      </div>
    </dbx-basic-loading>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class BasicLoadingWithCustomErrorComponent {
  readonly errorSignal = signal<ErrorInput | undefined>(undefined);
  readonly component = viewChild.required(DbxBasicLoadingComponent);
}

@Component({
  template: `
    <dbx-basic-loading [loading]="loadingSignal()">
      <div>Content</div>
      <div loading>
        <p id="custom-loading">${CUSTOM_LOADING_CONTENT}</p>
      </div>
    </dbx-basic-loading>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class BasicLoadingWithCustomLoadingComponent {
  readonly loadingSignal = signal(true);
  readonly component = viewChild.required(DbxBasicLoadingComponent);
}
