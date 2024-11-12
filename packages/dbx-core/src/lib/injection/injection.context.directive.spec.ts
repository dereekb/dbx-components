import { failDueToSuccess } from '@dereekb/util/test';
import { DbxInjectionContextDirective } from './injection.context.directive';
import { DbxInjectionComponentModule } from './injection.component.module';
import { Component, OnDestroy, Type, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By, BrowserModule } from '@angular/platform-browser';
import { waitForMs } from '@dereekb/util';

const EXISTING_CONTENT_ID = 'existing-content';
const EXISTING_CONTENT = 'Existing Content';

const CUSTOM_CONTENT_ID = 'custom-content';
const CUSTOM_CONTENT = 'Custom Content';

// TODO(TEST): add tests showing AbstractForwardDbxInjectionContextDirective usage.

@Component({
  template: `
    <span id="${CUSTOM_CONTENT_ID}">${CUSTOM_CONTENT}</span>
  `
})
class TestInjectionContent implements OnDestroy {
  destroyed = false;

  ngOnDestroy(): void {
    this.destroyed = true;
  }
}

@Component({
  selector: 'test-existing-content',
  template: `
    <span id="${EXISTING_CONTENT_ID}">${EXISTING_CONTENT}</span>
  `
})
class TestExistingInjectionContent implements OnDestroy {
  destroyed = false;

  ngOnDestroy(): void {
    this.destroyed = true;
  }
}

@Component({
  template: `
    <div *dbxInjectionContext>
      <test-existing-content></test-existing-content>
    </div>
  `
})
class TestInjectionContextDirective<T = any> {
  @ViewChild(DbxInjectionContextDirective, { static: true })
  injectionContextDirective?: DbxInjectionContextDirective<T>;
}

describe('DbxInjectionContextDirective', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BrowserModule, DbxInjectionComponentModule],
      declarations: [TestInjectionContent, TestExistingInjectionContent, TestInjectionContextDirective],
      providers: []
    }).compileComponents();
  });

  buildTestsWithClass(TestInjectionContextDirective, 'element');

  function buildTestsWithClass<C extends TestInjectionContextDirective>(type: Type<C>, selector: string): void {
    describe(`selector "${selector}"`, () => {
      let testComponent: TestInjectionContextDirective;
      let fixture: ComponentFixture<TestInjectionContextDirective>;
      let directive: DbxInjectionContextDirective;

      beforeEach(async () => {
        fixture = TestBed.createComponent(type);
        testComponent = fixture.componentInstance;

        expect(testComponent).toBeDefined();

        directive = fixture.componentInstance.injectionContextDirective as DbxInjectionContextDirective<any>;
        fixture.detectChanges();
      });

      afterEach(() => {
        fixture.destroy();
      });

      function assetExistingContentVisible() {
        const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`#${EXISTING_CONTENT_ID}`)).nativeElement;
        expect(anchorElement).not.toBeNull();
        expect(anchorElement.textContent).toBe(EXISTING_CONTENT);
      }

      function assetCustomContentVisible() {
        const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`#${CUSTOM_CONTENT_ID}`)).nativeElement;
        expect(anchorElement).not.toBeNull();
        expect(anchorElement.textContent).toBe(CUSTOM_CONTENT);
      }

      it('should show existing content', () => {
        assetExistingContentVisible();
      });

      it('should destroy the existing content on destruction.', () => {
        const content: TestExistingInjectionContent = fixture.debugElement.query(By.css(`#${EXISTING_CONTENT_ID}`)).componentInstance;

        expect(content.destroyed).toBe(false);

        fixture.destroy();

        expect(content.destroyed).toBe(true);
      });

      describe('config input', () => {
        it('should show the config-injected content.', () => {
          directive.config = {
            componentClass: TestInjectionContent
          };

          fixture.detectChanges();
          assetCustomContentVisible();
        });

        it('should show original content when config is removed.', () => {
          directive.config = {
            componentClass: TestInjectionContent
          };

          fixture.detectChanges();
          assetCustomContentVisible();

          directive.config = undefined;
          fixture.detectChanges();

          assetExistingContentVisible();
        });
      });

      describe('showContext()', () => {
        it('should show the config-injected content.', (done) => {
          directive
            .showContext({
              config: {
                componentClass: TestInjectionContent
              },
              use: (instance) => {
                expect(instance).toBeDefined();

                fixture.detectChanges();
                assetCustomContentVisible();

                return waitForMs(200);
              }
            })
            .then(() => {
              done();
            });
        });

        it('should show the config-injected content then back to the normal content when done.', (done) => {
          assetExistingContentVisible();

          directive
            .showContext({
              config: {
                componentClass: TestInjectionContent
              },
              use: (instance) => {
                expect(instance).toBeDefined();

                fixture.detectChanges();

                assetCustomContentVisible();

                return waitForMs(200);
              }
            })
            .then(() => {
              fixture.detectChanges();

              assetExistingContentVisible();

              done();
            });
        });

        it('should forward any error thrown in "use()".', (done) => {
          directive
            .showContext({
              config: {
                componentClass: TestInjectionContent
              },
              use: () => {
                throw new Error(); // throw an error
              }
            })
            .then(
              () => {
                failDueToSuccess();
              },
              (e) => {
                expect(e).toBeDefined();
                done();
              }
            );
        });
      });

      describe('resetContext()', () => {
        it('should reset the context immediately without use() returning.', (done) => {
          directive
            .showContext({
              config: {
                componentClass: TestInjectionContent
              },
              use: () => waitForMs(2000)
            })
            .then(
              () => {
                failDueToSuccess();
              },
              (e) => {
                expect(e).toBeDefined();

                // check the existing content is back.
                assetExistingContentVisible();

                done();
              }
            );

          fixture.detectChanges();

          directive.resetContext();
        });

        it('should not delete existing content if called without a context.', () => {
          directive.resetContext();

          fixture.detectChanges();

          directive.resetContext();

          fixture.detectChanges();

          assetExistingContentVisible();
        });

        it('reset, show, reset, show, reset, show.', (done) => {
          function showContext(i = 0) {
            assetExistingContentVisible();

            directive
              .showContext({
                config: {
                  componentClass: TestInjectionContent
                },
                use: () => waitForMs(2000)
              })
              .then(
                () => {
                  failDueToSuccess();
                },
                (e) => {
                  expect(e).toBeDefined();

                  // check the existing content is back.
                  assetExistingContentVisible();

                  if (i < 3) {
                    showContext(i + 1);
                  } else {
                    done();
                  }
                }
              );

            directive.resetContext();
          }

          setTimeout(() => showContext());
        });
      });
    });
  }
});
