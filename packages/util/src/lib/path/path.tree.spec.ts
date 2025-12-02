import { slashPathDirectoryTree, type SlashPathDirectoryTreeNodeValue, type SlashPathDirectoryTreeNode } from './path.tree';
import { slashPathDetails } from './path';

describe('slashPathDirectoryTree', () => {
  it('should build a tree from a flat list of paths', () => {
    const paths = ['a', 'a/b', 'c', 'a/b/d'];
    const values: SlashPathDirectoryTreeNodeValue<string>[] = paths.map((path) => ({
      value: path,
      slashPathDetails: slashPathDetails(path)
    }));

    const root = slashPathDirectoryTree(values);

    expect(root.children).toBeDefined();
    expect(root.children?.length).toBe(2); // a, c

    const a = root.children?.find((x: SlashPathDirectoryTreeNode<string>) => x.value.value === 'a');
    expect(a).toBeDefined();
    expect(a?.children?.length).toBe(1); // b

    const b = a?.children?.find((x: SlashPathDirectoryTreeNode<string>) => x.value.value === 'a/b');
    expect(b).toBeDefined();
    expect(b?.children?.length).toBe(1); // d

    const d = b?.children?.find((x: SlashPathDirectoryTreeNode<string>) => x.value.value === 'a/b/d');
    expect(d).toBeDefined();

    const c = root.children?.find((x: SlashPathDirectoryTreeNode<string>) => x.value.value === 'c');
    expect(c).toBeDefined();
    expect(c?.children).toBeUndefined();
  });

  it('should build a tree from a flat list of objects with paths', () => {
    const paths = ['folder/', 'folder/folder_b/', 'folder/test.png', 'folder/test2.png', 'folder/test3.png', 'folder/folder_b/test4.png', 'folder/folder_b/test5.png'];
    const values: SlashPathDirectoryTreeNodeValue<string>[] = paths.map((path) => ({
      value: path,
      slashPathDetails: slashPathDetails(path)
    }));

    const root = slashPathDirectoryTree(values);

    expect(root.children).toBeDefined();
    expect(root.children?.length).toBe(1); // only folder

    const childrenWithDepthZero = root.children?.filter((x) => x.depth === 0);
    expect(childrenWithDepthZero?.length).toBe(1);
    expect(childrenWithDepthZero?.[0].value.value).toBe('folder/');
  });

  it('should handle ignore values with missing parents', () => {
    const paths = ['a/b/c'];
    const values: SlashPathDirectoryTreeNodeValue<string>[] = paths.map((path) => ({
      value: path,
      slashPathDetails: slashPathDetails(path)
    }));

    const root = slashPathDirectoryTree(values);
    expect(root.children?.length).toBe(0);
  });

  describe('options', () => {
    describe('includeChildrenWithMissingParentFolder=true', () => {
      it('should include children without parent folders', () => {
        const paths = ['a/b/c'];
        const values: SlashPathDirectoryTreeNodeValue<string>[] = paths.map((path) => ({
          value: path,
          slashPathDetails: slashPathDetails(path)
        }));

        const root = slashPathDirectoryTree(values, { includeChildrenWithMissingParentFolder: true });
        expect(root.children?.length).toBe(1);
        expect(root.children?.[0].value.value).toBe('a/b/c');
      });
    });
  });
});
