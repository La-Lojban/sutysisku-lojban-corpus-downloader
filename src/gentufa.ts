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

import peggy from 'peggy';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import SyntacticActionsPlugin from 'pegjs-syntactic-actions';

import { Dict } from './types/index.js';

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

const ruleNames = (grammarSrc: string) => {
  return grammarSrc
    .split('\n')
    .map((_) => _.split('=')[0]?.trim())
    .filter(Boolean) as string[];
};

function sortArrayByLength(arr: string[]) {
  return arr.sort(function (a, b) {
    return b.length - a.length;
  });
}

function convertCmavoToPegString(leicmavo: string[]) {
  return sortArrayByLength(
    leicmavo.map((cmavo) => {
      return cmavo
        .split('')
        .map((s) => s.replace("'", 'h'))
        .join(' ');
    }),
  ).join(' / ');
}
export async function generatePEGGrammar(
  opts: { path: string; ignoredRules: string[]; allowedStartRules: string[] },
  valsi: Dict = {},
) {
  logger.info('generating lojban PEG grammar');

  const selmaho: Dict = {};
  for (const key in valsi) {
    const def = valsi[key];
    if (def.s && ['cmavo', 'experimental cmavo'].includes(def.t)) {
      const coreSelmaho = def.s.replace(/[0-9]+.*/, '');
      selmaho[coreSelmaho] = (selmaho[coreSelmaho] ?? []).concat([key]);
      const coreSubselmaho = def.s.replace(/([0-9]+)[a-z].*/, '$1');
      if (coreSelmaho !== coreSubselmaho) {
        selmaho[coreSubselmaho] = (selmaho[coreSubselmaho] ?? []).concat([key]);
      }
    }
  }
  // console.log(JSON.stringify(selmaho, null, 2));
  const grammarRules = fs
    .readFileSync(opts.path)
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
    if (!rule.rule) continue;
    const leicmavo = selmaho[rule.rule];
    if (leicmavo) {
      rule.rhs = `&cmavo ( ${convertCmavoToPegString(leicmavo)} ) &post_word`;
    }
  }
  const grammarSrc = grammarRules.map((r) => `${r.rule} = ${r.rhs}`).join('\n');
  const parser = peggy.generate(grammarSrc, {
    cache: true,
    trace: false,
    output: 'source' as any,
    allowedStartRules: [...new Set((ruleNames(grammarSrc) ?? []).concat(opts.allowedStartRules ?? []))],
    format: 'commonjs',
    plugins: [new SyntacticActionsPlugin({ ignoredRules: opts.ignoredRules ?? [] })],
  }) as any;
  logger.info('new PEG grammar parser generated');
  return { source: grammarSrc, generated: parser };
}

// console.log(peggy.generate);

// import p from '../grammars/camxes.cjs';
// const result = p.parse('coi');

// console.log(JSON.stringify( result)); // outputs "boo"
