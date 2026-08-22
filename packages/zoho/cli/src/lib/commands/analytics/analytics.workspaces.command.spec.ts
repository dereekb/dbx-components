import { describe, expect, it } from 'vitest';
import { confirmedDeleteWorkspaceId } from './analytics.workspaces.command';

const WORKSPACE_ID = '1767024000000060001';

describe('confirmedDeleteWorkspaceId()', () => {
  it('should return the workspace id when --confirm repeats it', () => {
    expect(confirmedDeleteWorkspaceId(WORKSPACE_ID, WORKSPACE_ID)).toBe(WORKSPACE_ID);
  });

  it('should fail when --confirm is missing, since the delete cannot be undone', () => {
    expect(() => confirmedDeleteWorkspaceId(WORKSPACE_ID, undefined)).toThrow();
    expect(() => confirmedDeleteWorkspaceId(WORKSPACE_ID, '')).toThrow();
  });

  it('should fail when --confirm names a different workspace', () => {
    // the guard's whole point: two workspace ids differ by a digit in the middle, and the one that
    // gets deleted is the positional, not the one that was checked
    expect(() => confirmedDeleteWorkspaceId(WORKSPACE_ID, '1767024000000060002')).toThrow();
  });

  it('should fail rather than accept a truthy confirmation that is not the id', () => {
    // --confirm is a string option, so `--confirm` alone yields '' and `--confirm yes` yields 'yes';
    // neither may pass as consent for this workspace
    expect(() => confirmedDeleteWorkspaceId(WORKSPACE_ID, 'yes')).toThrow();
    expect(() => confirmedDeleteWorkspaceId(WORKSPACE_ID, 'true')).toThrow();
  });
});
