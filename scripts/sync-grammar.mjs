import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../packages/shared/syntaxes/qtn.tmLanguage.json', import.meta.url);
const destinations = [
  '../packages/vscode-extension/syntaxes/qtn.tmLanguage.json',
  '../packages/jetbrains-plugin/src/main/resources/bundles/qtn.tmbundle/Syntaxes/qtn.tmLanguage.json',
  '../packages/vs-extension/Grammars/qtn.tmLanguage.json',
];
const check = process.argv.includes('--check');
const grammar = await readFile(source);
for (const destination of destinations) {
  const file = new URL(destination, import.meta.url);
  if (check) {
    const copy = await readFile(file).catch(() => null);
    if (!copy?.equals(grammar)) {
      console.error(`${destination} is out of sync; run npm run sync-grammar`);
      process.exitCode = 1;
    }
  } else {
    await writeFile(file, grammar);
  }
}
