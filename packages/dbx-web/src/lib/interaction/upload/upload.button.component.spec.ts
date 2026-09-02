import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { type FileAcceptFilterTypeStringArray } from './upload.accept';
import { DbxFileUploadButtonComponent } from './upload.button.component';

function testFile(name: string, type: string): File {
  return new File(['x'], name, { type });
}

const FILES = [testFile('a.png', 'image/png'), testFile('b.png', 'image/png'), testFile('c.png', 'image/png'), testFile('d.pdf', 'application/pdf')];

/**
 * The picker has no concept of a count limit — it will hand back as many files as the user selects — so the
 * button is the only thing standing between an over-large selection and the upload.
 */
describe('DbxFileUploadButtonComponent max files', () => {
  let testComponent: TestDbxFileUploadButtonComponent;
  let fixture: ComponentFixture<TestDbxFileUploadButtonComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbxFileUploadButtonComponent);
    testComponent = fixture.componentInstance;

    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should cap a selection made against a non-function accept', () => {
    testComponent.multipleSignal.set(true);
    testComponent.maxFilesSignal.set(2);
    fixture.detectChanges();

    const result = testComponent.button().filesAcceptedFunctionSignal()(FILES);

    expect(result.accepted).toEqual([FILES[0], FILES[1]]);
    expect(result.rejected).toEqual([FILES[2], FILES[3]]);
  });

  it('should leave a selection uncapped when no limit is set', () => {
    testComponent.multipleSignal.set(true);
    fixture.detectChanges();

    const result = testComponent.button().filesAcceptedFunctionSignal()(FILES);
    expect(result.accepted).toEqual(FILES);
  });

  it('should take only the first file while multiple is off', () => {
    const result = testComponent.button().filesAcceptedFunctionSignal()(FILES);
    expect(result.accepted).toEqual([FILES[0]]);
  });

  it('should accept nothing once the limit reaches 0', () => {
    testComponent.multipleSignal.set(true);
    testComponent.maxFilesSignal.set(0);
    fixture.detectChanges();

    const result = testComponent.button().filesAcceptedFunctionSignal()(FILES);
    expect(result.accepted).toEqual([]);
  });

  it('should apply the limit after a function accept has filtered by type', () => {
    testComponent.multipleSignal.set(true);
    testComponent.maxFilesSignal.set(2);
    testComponent.button().setAccept((x) => x.type === 'image/png');
    fixture.detectChanges();

    const result = testComponent.button().filesAcceptedFunctionSignal()(FILES);

    expect(result.acceptedType).toEqual([FILES[0], FILES[1], FILES[2]]);
    expect(result.accepted).toEqual([FILES[0], FILES[1]]);
  });

  it('should take the limit pushed in by setMaxFiles over the input', () => {
    testComponent.multipleSignal.set(true);
    testComponent.maxFilesSignal.set(3);
    fixture.detectChanges();

    testComponent.button().setMaxFiles(1);
    fixture.detectChanges();

    const result = testComponent.button().filesAcceptedFunctionSignal()(FILES);
    expect(result.accepted).toEqual([FILES[0]]);
  });
});

@Component({
  template: `
    <dbx-file-upload-button [accept]="acceptSignal()" [multiple]="multipleSignal()" [maxFiles]="maxFilesSignal()"></dbx-file-upload-button>
  `,
  imports: [DbxFileUploadButtonComponent]
})
class TestDbxFileUploadButtonComponent {
  readonly button = viewChild.required(DbxFileUploadButtonComponent);

  readonly acceptSignal = signal<FileAcceptFilterTypeStringArray>(['image/*', '.pdf']);
  readonly multipleSignal = signal<Maybe<boolean>>(undefined);
  readonly maxFilesSignal = signal<Maybe<number>>(undefined);
}
