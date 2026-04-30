import { Project } from 'ts-morph';
const project = new Project({ tsConfigFilePath: 'tsconfig.base.json', skipAddingFilesFromTsConfig: true });
const sf = project.addSourceFileAtPath('packages/dbx-form/src/lib/forge/field/wrapper/flex/flex.wrapper.ts');
for (const fn of sf.getFunctions()) {
  console.log(
    'fn:',
    fn.getName(),
    'exported:',
    fn.isExported(),
    'tags:',
    fn.getJsDocs().flatMap((d) => d.getTags().map((t) => t.getTagName()))
  );
}
