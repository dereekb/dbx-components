import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { DbxActionDirective, DbxButtonDirective } from '@dereekb/dbx-core';
import { DbxFileUploadActionSyncDirective } from './upload.action.directive';

/**
 * Verifies the generalized {@link DbxFileUploadActionSyncDirective} can drive a plain `<button dbxButton>`
 * (which provides {@link DbxActionWorkable} via {@link provideDbxButton}) -- not just a file upload component.
 */
describe('DbxFileUploadActionSyncDirective', () => {
  let testComponent: TestDbxFileUploadActionSyncOnButtonComponent;
  let fixture: ComponentFixture<TestDbxFileUploadActionSyncOnButtonComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(TestDbxFileUploadActionSyncOnButtonComponent);
    testComponent = fixture.componentInstance;

    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should be created and wire onto the button', () => {
    expect(testComponent.sync()).toBeDefined();
    expect(testComponent.button()).toBeDefined();
  });

  it('should reflect the action working state onto the button', () => {
    const button = testComponent.button();
    const directive = testComponent.directive();

    expect(button.workingSignal()).toBe(false);

    directive.sourceInstance.trigger();
    fixture.detectChanges();
    expect(button.workingSignal()).toBe(true);

    directive.sourceInstance.readyValue(1);
    fixture.detectChanges();
    directive.sourceInstance.resolve(1);
    fixture.detectChanges();
    expect(button.workingSignal()).toBe(false);
  });

  it('should reflect the action disabled state onto the button', () => {
    const button = testComponent.button();
    const directive = testComponent.directive();

    directive.sourceInstance.disable();
    fixture.detectChanges();
    expect(button.disabledSignal()).toBe(true);

    directive.sourceInstance.enable();
    fixture.detectChanges();
    expect(button.disabledSignal()).toBe(false);
  });
});

@Component({
  template: `
    <div dbxAction>
      <button dbxButton dbxFileUploadActionSync>Upload</button>
    </div>
  `,
  standalone: true,
  imports: [DbxActionDirective, DbxButtonDirective, DbxFileUploadActionSyncDirective]
})
class TestDbxFileUploadActionSyncOnButtonComponent {
  readonly directive = viewChild.required<DbxActionDirective<number, number>>(DbxActionDirective);
  readonly button = viewChild.required(DbxButtonDirective);
  readonly sync = viewChild.required(DbxFileUploadActionSyncDirective);
}
