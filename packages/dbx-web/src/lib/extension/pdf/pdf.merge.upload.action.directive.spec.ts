import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { defer, filter, firstValueFrom, of } from 'rxjs';
import { DbxActionDirective, DbxActionState, type DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergeUploadActionDirective } from './pdf.merge.upload.action.directive';

const MERGED_BLOB = new Blob(['merged'], { type: 'application/pdf' });
let mergeOutputReads = 0;

const FAKE_STORE = {
  mergeOutput$: defer(() => {
    mergeOutputReads += 1;
    return of(MERGED_BLOB);
  })
};

@Component({
  template: `
    <div dbxAction>
      <button dbxPdfMergeUploadAction>Upload</button>
    </div>
  `,
  imports: [DbxActionDirective, DbxPdfMergeUploadActionDirective],
  providers: [{ provide: DbxPdfMergeEditorStore, useValue: FAKE_STORE }]
})
class TestDbxPdfMergeUploadActionComponent {
  readonly directive = viewChild.required(DbxActionDirective);
}

describe('DbxPdfMergeUploadActionDirective', () => {
  let fixture: ComponentFixture<TestDbxPdfMergeUploadActionComponent>;

  beforeEach(async () => {
    mergeOutputReads = 0;
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(TestDbxPdfMergeUploadActionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  function sourceInstance(): DbxActionContextStoreSourceInstance<Blob> {
    return fixture.componentInstance.directive().sourceInstance as DbxActionContextStoreSourceInstance<Blob>;
  }

  it('should ready the store merge output as the action value when triggered', async () => {
    const source = sourceInstance();
    source.trigger();

    await firstValueFrom(source.actionState$.pipe(filter((x) => x === DbxActionState.VALUE_READY)));
    const state = await firstValueFrom(source.state$);

    expect(state.value).toBe(MERGED_BLOB);
    expect(mergeOutputReads).toBe(1);
  });

  it('should register no value snapshot, so a snapshot never starts a merge', () => {
    expect(sourceInstance().valueSnapshot()).toBeUndefined();
    expect(mergeOutputReads).toBe(0);
  });
});
