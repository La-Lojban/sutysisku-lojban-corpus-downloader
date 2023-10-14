import dotenv from 'dotenv';
dotenv.config();
import winston, { format } from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

import fs from 'fs-extra';
import path from 'path';

import peggy from 'peggy';
import SyntacticActionsPlugin from 'pegjs-syntactic-actions';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Dict } from './types/index.js';
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

const ruleNames = (grammarSrc) => {
  return grammarSrc
    .split('\n')
    .map((_) => _.split('=')[0].trim())
    .filter(Boolean);
};

function convertCmavoToPegString(leicmavo: string[]) {
  return leicmavo
    .map((cmavo) => {
      return cmavo
        .split('')
        .map((s) => s.replace("'", 'h'))
        .join(' ');
    })
    .join(' / ');
}
export async function generatePEGGrammar(valsi: Dict = {}) {
  logger.info('generating lojban PEG grammar');

  const selmaho: Dict = {};
  for (const key in valsi) {
    const def = valsi[key];
    if (def.s && ['cmavo', 'experimental cmavo'].includes(def.t)) {
      const coreSelmaho = def.s.replace(/[0-9]+.*/, '');
      selmaho[coreSelmaho] = (selmaho[coreSelmaho] ?? []).concat([key]);
    }
  }
  const grammarRules = fs
    .readFileSync(path.join(__dirname, './grammars/camxes.peg'))
    .toString()
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^[^a-zA-Z0-9_].*?$/, '')
        .replace(/#.*/, '')
        .trim(),
    )
    .filter(Boolean)
    .map((line) => {
      const [rule, rhs] = line.split('<-').map((i) => i.trim());
      return { rule, rhs };
    });
  for (const rule of grammarRules) {
    const leicmavo = selmaho[rule.rule];
    if (leicmavo) {
      rule.rhs = `&cmavo ( ${convertCmavoToPegString(leicmavo)} ) &post_word`;
    }
  }
  const grammarSrc = grammarRules.map((r) => `${r.rule} = ${r.rhs}`).join('\n');
  fs.outputFileSync(path.join(__dirname, '../data/grammars/camxes-cnino.peg'), grammarSrc);
  const parser = peggy.generate(grammarSrc, {
    // cache: true,
    trace: false,
    output: 'source',
    allowedStartRules: ruleNames(grammarSrc),
    format: 'commonjs',
    plugins: [new SyntacticActionsPlugin()],
  });
  fs.outputFileSync(path.join(__dirname, '../data/grammars/camxes.js'), parser);
  logger.info('new PEG grammar parser generated');
}

generatePEGGrammar();
// console.log(peggy.generate);

// import p from '../grammars/camxes.cjs';
// const result = p.parse('coi');

// console.log(JSON.stringify( result)); // outputs "boo"
