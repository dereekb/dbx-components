import { DbxInjectionTemplateConfig, DbxInjectionComponentConfig } from './injection';
import { DbxInjectionComponent } from './injection.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input, Type, ViewChild, OnDestroy } from '@angular/core';
import { By, BrowserModule } from '@angular/platform-browser';
import { DbxInjectionComponentModule } from './injection.component.module';

const CUSTOM_CONTENT_ID = 'custom-content';
const CUSTOM_CONTENT = 'Custom Content';

@Component({
  template: `
    <span id="${CUSTOM_CONTENT_ID}">${CUSTOM_CONTENT}</span>
  `
})
class TestInjectionComponentContent implements OnDestroy {

  destroyed = false;

  ngOnDestroy(): void {
    this.destroyed = true;
  }

}

@Component({})
abstract class TestInjectionComponent<T = any> {

  @Input()
  config?: DbxInjectionComponentConfig;

  @Input()
  template?: DbxInjectionTemplateConfig;

  @ViewChild(DbxInjectionComponent, { static: true })
  injectedComponent?: DbxInjectionComponent<T>;

}

@Component({
  template: `
    <div dbxInjection [config]="config" [template]="template"></div>
  `
})
class TestInjectionComponentWithElement<T = any> extends TestInjectionComponent<T> { }

@Component({
  template: `
    <dbx-injection [config]="config" [template]="template"></dbx-injection>
  `
})
class TestInjectionComponentWithAttribute<T = any> extends TestInjectionComponent<T> { }

describe('DbxInjectionComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        BrowserModule,
        DbxInjectionComponentModule
      ],
      declarations: [
        TestInjectionComponentContent,
        TestInjectionComponentWithElement,
        TestInjectionComponentWithAttribute,
      ],
      providers: []
    }).compileComponents();
  });

  buildTestsWithComponentClass(TestInjectionComponentWithElement, 'element');
  buildTestsWithComponentClass(TestInjectionComponentWithAttribute, 'attribute');

  function buildTestsWithComponentClass<C extends TestInjectionComponent>(type: Type<C>, selector: string): void {

    describe(`selector "${selector}"`, () => {

      let testComponent: TestInjectionComponent;
      let fixture: ComponentFixture<TestInjectionComponent>;

      beforeEach(async () => {
        fixture = TestBed.createComponent(type);
        testComponent = fixture.componentInstance;
        fixture.detectChanges();
      });

      describe('with config', () => {

        beforeEach(async () => {
          testComponent.config = {
            componentClass: TestInjectionComponentContent
          };

          fixture.detectChanges();
        });

        afterEach(() => {
          fixture.destroy();
        });

        it('should show content', () => {
          const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`#${CUSTOM_CONTENT_ID}`)).nativeElement;
          expect(anchorElement).not.toBeNull();
          expect(anchorElement.textContent).toBe(CUSTOM_CONTENT);
        });


        it('should show destroy the content when config is cleared.', () => {
          let instance: TestInjectionComponentContent;

          testComponent.config = {
            componentClass: TestInjectionComponentContent,
            init: (x) => {
              instance = x;
            }
          };

          fixture.detectChanges();

          expect(instance!).toBeDefined();
          expect(instance!.destroyed).toBe(false);

          // clear the item
          testComponent.config = undefined;

          fixture.detectChanges();

          // check is destroyed
          expect(instance!.destroyed).toBe(true);

        });

        // todo: test injecting data.

        // todo: test with template view being defaulted to when config isn't available.

      });

    });

  }

});
