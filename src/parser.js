import fs from 'fs-extra';
import path from 'path';

import peggy from 'peggy';
import SyntacticActionsPlugin from 'pegjs-syntactic-actions';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/*
  get dump
  get dict {[class]: cmavo[]}

  parse grammar into {[rule]: right part}
  for each class check if in grammar we have line with it, if yes, replace line
  merge grammar back
  generate parser 
  upload it

*/
// const parser = peggy.generate(`
// validWord = @word:$[a-z]+ &{ return options.validWords.includes(word) }
// `);

// const result = parser.parse("boo", {
//   validWords: [ "boo", "baz", "boop" ]
// });

// console.log(result);

const grammarSrc = fs
  .readFileSync(path.join(__dirname, '../grammars/camxes.peg'))
  .toString()
  .split('\n')
  .map((line) =>
    line
      .trim()
      .replace(/^[^a-zA-Z0-9_].*?$/, '')
      .replace(/#.*/, '')
      .trim()
      .replace(/^([a-zA-Z0-9_]+)[\t ]*<-[\t ]*/, '$1 = '),
  )
  .filter(Boolean)
  .join('\n');

const ruleNames = (grammarSrc) => {
  return grammarSrc
    .split('\n')
    .map((_) => _.split('=')[0].trim())
    .filter(Boolean);
};

// console.log(peggy.generate);
const parser = peggy.generate(grammarSrc, {
  cache: true,
  trace: false,
  output: 'source',
  allowedStartRules: ruleNames(grammarSrc),
  format: 'es',
  plugins: [new SyntacticActionsPlugin()],
});
fs.writeFileSync(path.join(__dirname, '../grammars/camxes.js'), parser);

// import p from '../grammars/camxes.cjs';
// const result = p.parse('coi');

// console.log(JSON.stringify( result)); // outputs "boo"
