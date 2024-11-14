const vscode = require('vscode');

// https://marketplace.visualstudio.com/items?itemName=EXCEEDSYSTEM.vscode-macros

/**
 * Macro configuration settings
 * { [name: string]: {              ... Name of the macro
 *    no: number,                   ... Order of the macro
 *    func: ()=> string | undefined ... Name of the body of the macro function
 *  }
 * }
 */
module.exports.macroCommands = {
  ReplaceConstructorWithInject: {
    no: 2,
    func: replaceConstructorWithInjectors
  }
};

function replaceConstructorWithInjectors() {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    // Return an error message if necessary.
    return 'Editor is not opening.';
  }

  const document = editor.document;
  const text = document.getText();

  // Regular expressions to find class declarations and the constructor
  const classRegex = /class\s+(\w+)\s*(.*)\s?{[^]*?}/;
  const constructorRegex = /constructor\s*\(([^]*?)\)\s*{\s*(super\({[^]*}\);)?([^]*?)}/;

  // Match the class declaration
  const classMatch = classRegex.exec(text);

  if (!classMatch) {
    vscode.window.showErrorMessage('No class found in the document.');
    return;
  }

  const classStart = classMatch.index;
  const classEnd = classStart + classMatch[0].length;
  const classBody = classMatch[0];

  const classStartPosition = document.positionAt(classStart);
  const classLineStart = classStartPosition.line;

  const classNextLine = classLineStart + 1;
  const classNextLineText = document.lineAt(classNextLine).text.trim();
  const insertNewNextLineAfterClass = classNextLineText !== '';

  // Match the constructor within the class body
  const constructorMatch = constructorRegex.exec(text);

  if (!constructorMatch) {
    vscode.window.showErrorMessage('No constructor found in the class.');
    return;
  }

  const constructorStart = constructorMatch.index;
  const constructorEnd = constructorStart + constructorMatch[0].length;
  const constructorText = constructorMatch[0];

  // Get the line number of the constructor
  const constructorStartPosition = document.positionAt(constructorStart);
  const constructorEndPosition = document.positionAt(constructorEnd);
  const constructorLineStart = constructorStartPosition.line;
  const constructorLineEnd = constructorEndPosition.line;

  const nextLine = constructorLineEnd + 1;
  const nextLineText = document.lineAt(nextLine).text.trim();
  const deleteNextLine = nextLineText === '';

  // vscode.window.showInformationMessage('Constructor Text:' + constructorText); // Log the constructor text

  // Extract the constructor parameters (text between parentheses) and split them into an array
  const constructorParamsMatch = constructorMatch[1];

  // vscode.window.showInformationMessage('Constructor Match: ' + constructorParamsMatch); // Log the constructor text

  if (!constructorParamsMatch) {
    vscode.window.showErrorMessage('No constructor parameters could be derived: ' + constructorParamsMatch);
    return;
  }

  const constructorParams = constructorParamsMatch.trim();

  // vscode.window.showInformationMessage('constructorParams: ' + constructorParams); // Log the constructor text

  const constructorSuperMatch = constructorMatch[2]?.trim() ?? '';
  const constructorNonSuperContentMatch = constructorMatch[3]?.trim() ?? '';
  const constructorBodyMatch = constructorSuperMatch + constructorNonSuperContentMatch;

  const shouldRestoreConstructor = Boolean(constructorBodyMatch);

  const paramArray = constructorParams
    .split(',')
    .map((param) => param.trim())
    .filter((param) => param.length > 0); // Remove empty strings

  // vscode.window.showInformationMessage('Constructor Params: ' + paramArray); // Log the parameters array

  if (paramArray.length === 0) {
    vscode.window.showErrorMessage('The constructor appears to be empty.');
    return;
  }

  const isClassMemberDeclarationRegex = /\s?(readonly|public|private|protected)\s?/;

  const paramsBreakdown = paramArray.map((x) => {
    const isClassMemberToMove = isClassMemberDeclarationRegex.test(x);
    return [isClassMemberToMove, x];
  });

  // vscode.window.showInformationMessage('Params breakdown: ' + paramsBreakdown); // Log the parameters array

  // constructor input that does not have readonly/public/private/protected
  const constructorVariableParamsArray = paramsBreakdown.filter((x) => !x[0]).map((x) => x[1]);

  if (shouldRestoreConstructor) {
    // vscode.window.showInformationMessage('Will restore constructor with content.' + constructorVariableParamsArray); // Log the parameters array
  }

  // constructor input that are variable declarations
  const classMemberParamsArray = paramsBreakdown.filter((x) => x[0]).map((x) => x[1]);

  if (!classMemberParamsArray.length) {
    vscode.window.showErrorMessage('The constructor appears have no class member declarations.');
    return;
  }

  const injectedParamStrings = classMemberParamsArray.map((x) => {
    const paramSplit = x.split(': ');

    const firstPart = paramSplit[0];
    const secondPart = paramSplit[1];

    return `${firstPart} = inject(${secondPart});`;
  });

  vscode.window.showInformationMessage('Inject lines: ' + classMemberParamsArray); // Log the parameters array

  return editor
    .edit((editBuilder) => {
      let insertionPosition = new vscode.Position(classLineStart, 0).translate(1, 0); // go to next line

      // Remove the constructor
      // editBuilder.delete(new vscode.Range(document.positionAt(constructorStart), document.positionAt(constructorEnd)));

      // Remove the entire line containing the constructor
      const deleteConstructorEnd = new vscode.Position(constructorLineEnd + (deleteNextLine ? 2 : 1), 0);

      editBuilder.delete(
        new vscode.Range(
          new vscode.Position(constructorLineStart, 0), // Start of the line
          deleteConstructorEnd // Start of the end line
        )
      );

      if (shouldRestoreConstructor) {
        // restore the constructor minus the injected parts
        const constructorVariables = constructorVariableParamsArray.join(', ');
        let constructorBody = `{ };`;

        if (constructorSuperMatch || constructorNonSuperContentMatch) {
          constructorBody = `{\n`;

          if (constructorSuperMatch) {
            constructorBody += `${constructorSuperMatch}\n`;
          }

          if (constructorNonSuperContentMatch) {
            constructorBody += `${constructorNonSuperContentMatch}\n`;
          }

          constructorBody += `}\n`;
        }

        editBuilder.insert(new vscode.Position(constructorLineStart, 0), `constructor(${constructorVariables}) ${constructorBody}`);
      }

      // Insert the injects at the start of the class body, right after the opening brace
      injectedParamStrings.forEach((x) => {
        editBuilder.insert(insertionPosition, `\n${x}`);
      });

      editBuilder.insert(insertionPosition, `\n\n`);
    })
    .then(() => {
      // format the document results
      return vscode.commands.executeCommand('editor.action.formatDocument');
    });
}
