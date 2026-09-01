import { describe, expect, it } from 'vitest';
import { type FormSpace, formSpaceConverter, FormSpaceFileValidationState, FormSpaceProcessingState, FormSpaceState } from './formspace';

const createdAt = new Date('2026-01-02T03:04:05.000Z');
const updatedAt = new Date('2026-01-02T05:04:05.000Z');
const submittedAt = new Date('2026-01-02T06:04:05.000Z');
const completedAt = new Date('2026-01-02T07:04:05.000Z');
const expiresAt = new Date('2026-01-09T03:04:05.000Z');

describe('formSpaceConverter', () => {
  const model: FormSpace = {
    t: 'demo_example',
    n: 'My Application',
    s: FormSpaceState.SUBMITTED,
    ps: FormSpaceProcessingState.PROCESSING,
    d: { fullName: 'Ada', message: 'Hello' },
    u: 'user123',
    o: 'pr/user123',
    m: 'gb/abc123',
    uc: 3,
    fi: 5,
    f: [
      { sl: 'resume', sf: 'sf1', n: 'resume.pdf', v: FormSpaceFileValidationState.NONE, at: createdAt },
      { sl: 'documents', sf: 'sf2', n: 'proof.pdf', v: FormSpaceFileValidationState.INVALID, r: 'not a readable pdf', fr: null, at: createdAt, vat: updatedAt }
    ],
    pn: 'nb/abc/n/def',
    pat: updatedAt,
    cat: createdAt,
    uat: updatedAt,
    sat: submittedAt,
    cpat: completedAt,
    eat: expiresAt
  };

  it('should round-trip every field', () => {
    const data = formSpaceConverter.mapFunctions.to(model);
    const result = formSpaceConverter.mapFunctions.from(data);

    expect(result.t).toBe('demo_example');
    expect(result.n).toBe('My Application');
    expect(result.s).toBe(FormSpaceState.SUBMITTED);
    expect(result.ps).toBe(FormSpaceProcessingState.PROCESSING);
    expect(result.d).toEqual({ fullName: 'Ada', message: 'Hello' });
    expect(result.u).toBe('user123');
    expect(result.o).toBe('pr/user123');
    expect(result.m).toBe('gb/abc123');
    expect(result.uc).toBe(3);
    expect(result.fi).toBe(5);
    expect(result.pn).toBe('nb/abc/n/def');

    expect(result.f).toHaveLength(2);
    expect(result.f[0]).toEqual({ sl: 'resume', sf: 'sf1', n: 'resume.pdf', v: FormSpaceFileValidationState.NONE, at: expect.any(Date) });
    expect(result.f[0].at).toBeSameSecondAs(createdAt);
    expect(result.f[1].sf).toBe('sf2');
    expect(result.f[1].v).toBe(FormSpaceFileValidationState.INVALID);
    expect(result.f[1].r).toBe('not a readable pdf');
    expect(result.f[1].vat).toBeSameSecondAs(updatedAt);
    // a null optional reads back as absent, not as an explicit null
    expect(result.f[1].fr).toBeUndefined();
    expect(result.pat).toBeSameSecondAs(updatedAt);
    expect(result.cat).toBeSameSecondAs(createdAt);
    expect(result.uat).toBeSameSecondAs(updatedAt);
    expect(result.sat).toBeSameSecondAs(submittedAt);
    expect(result.cpat).toBeSameSecondAs(completedAt);
    expect(result.eat).toBeSameSecondAs(expiresAt);
  });

  it('should default the states and the upload counter for a minimal document', () => {
    const result = formSpaceConverter.mapFunctions.from({
      t: 'demo_example',
      u: 'user123'
    } as never);

    expect(result.s).toBe(FormSpaceState.DRAFT);
    expect(result.ps).toBe(FormSpaceProcessingState.INIT_OR_NONE);
    expect(result.uc).toBe(0);
    expect(result.fi).toBe(0); // a document written before `fi` existed reads back as 0
    // a document written before `f` existed reads back as an empty folder, not as undefined
    expect(result.f).toEqual([]);
  });

  it('should clear rather than persist empty form data', () => {
    const data = formSpaceConverter.mapFunctions.to({ ...model, d: {} }) as Record<string, unknown>;
    expect(data['d']).toBeNull();
  });
});
