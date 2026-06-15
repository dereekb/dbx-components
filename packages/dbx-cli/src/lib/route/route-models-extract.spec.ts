import { describe, expect, it } from 'vitest';
import { Project } from 'ts-morph';
import { extractComponentRouteModelTags } from './route-models-extract.js';

function sourceFileFor(text: string) {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  return project.createSourceFile('component.ts', text, { overwrite: true });
}

describe('extractComponentRouteModelTags', () => {
  it('collects every @dbxRouteModel* tag declared on the named class', () => {
    const sourceFile = sourceFileFor(`
/**
 * @dbxRouteModel profile :uid - The profile
 * @dbxRouteModelList jobWorkerTimesheet
 */
export class WorkerComponent {}
`);
    const tags = extractComponentRouteModelTags(sourceFile, 'WorkerComponent');
    expect(tags).toEqual([
      { name: 'dbxRouteModel', text: 'profile :uid - The profile' },
      { name: 'dbxRouteModelList', text: 'jobWorkerTimesheet' }
    ]);
  });

  it('ignores non-route-model tags on the class', () => {
    const sourceFile = sourceFileFor(`
/**
 * @Component selector stuff
 * @dbxRouteModel worker :uid
 */
export class WorkerComponent {}
`);
    const tags = extractComponentRouteModelTags(sourceFile, 'WorkerComponent');
    expect(tags).toEqual([{ name: 'dbxRouteModel', text: 'worker :uid' }]);
  });

  it('returns an empty list when the class is absent', () => {
    const sourceFile = sourceFileFor(`export class OtherComponent {}`);
    expect(extractComponentRouteModelTags(sourceFile, 'MissingComponent')).toEqual([]);
  });

  it('returns an empty list when the class carries no route-model tags', () => {
    const sourceFile = sourceFileFor(`
/**
 * Just a component.
 */
export class PlainComponent {}
`);
    expect(extractComponentRouteModelTags(sourceFile, 'PlainComponent')).toEqual([]);
  });
});
