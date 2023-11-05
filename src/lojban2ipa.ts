import lojban from 'lojban';
import { canonicalizeValsi } from './utils/fns.js';

function krulermorna(text: string): string {
  text = text.replace(/(?<=[aeiouy])u([aeiouy])/g, 'w$1');
  text = text.replace(/(?<=[aeiouy])i([aeiouy])/g, 'ɩ$1');
  text = text.replace(/u([aeiouy])/g, 'w$1');
  text = text.replace(/i([aeiouy])/g, 'ɩ$1');
  text = text.replace(/au/g, 'ḁ');
  text = text.replace(/ai/g, 'ą');
  text = text.replace(/ei/g, 'ę');
  text = text.replace(/oi/g, 'ǫ');
  text = text.replace(/'/g, 'h');
  return text;
}

const C = '[bdgjvzcfkpstxlmnr]';
// const V = '(?:a|e|i|o|u)';
// const I = '(?:ai|ei|oi|au|ḁ|ą|ę|ǫ)';
// const D =
//   '(pl|pr|fl|fr|bl|br|vl|vr|cp|cf|ct|ck|cm|cn|cl|cr|jb|jv|jd|jg|jm|sp|sf|st|sk|sm|sn|sl|sr|zb|zv|zd|zg|zm|tc|tr|ts|kl|kr|dj|dr|dz|gl|gr|ml|mr|xl|xr)';
// const T =
//   '(cfr|cfl|sfr|sfl|jvr|jvl|zvr|zvl|cpr|cpl|spr|spl|jbr|jbl|zbr|zbl|ckr|ckl|skr|skl|jgr|jgl|zgr|zgl|ctr|str|jdr|zdr|cmr|cml|smr|sml|jmr|jml|zmr|zml)';
// const R = `((?!${D})${C}${C})`;
// const J = '(i|u)(?=[aeiouyḁąęǫ])';
const h = "[h']";

const ipaVits: Record<string, string> = {
  a: 'aː',
  "a\\b(?!')": 'aː',
  e: 'ɛ:',
  "e\\b(?!')": 'ɛ:',
  i: 'i:',
  o: 'ɔ:',
  u: 'u:',
  y: 'ə',
  ą: 'aj',
  ę: 'ɛj',
  "ę\\b(?!')": 'ɛj',
  ǫ: 'ɔj',
  ḁ: 'aʊ',
  ɩa: 'jaː',
  ɩe: 'jɛ:',
  ɩi: 'ji:',
  ɩo: 'jɔ:',
  ɩu: 'ju:',
  ɩy: 'jə',
  ɩ: 'j',
  wa: 'waː',
  we: 'wɛ:',
  wi: 'wi:',
  wo: 'wɔ:',
  wu: 'wu:',
  wy: 'wə',
  w: 'w',
  c: 'ʃ',
  j: 'ʒ',
  s: 's',
  z: 'z',
  f: 'f',
  ev: 'ɛ:ʔv',
  v: 'v',
  x: 'x',
  "'": 'h',
  dj: 'dʒ',
  tc: 'tʃ',
  dz: 'ʣ',
  ts: 'ʦ',
  'r(?=[^aeiouyḁąęǫ])': 'rr.',
  'r(?=[aeiouyḁąęǫ])': 'ɹ',
  n: 'n',
  m: 'm',
  l: 'l',
  b: 'b',
  d: 'd',
  g: 'g',
  k: 'k',
  p: 'p',
  t: 't',
  h: 'h',
  // '\\.': 'ʔ',
  '\\.': '.',
};

const vowelPattern = /[aeiouyąęǫḁ]/;
const vowelComingPattern = /(?=[aeiouyąęǫḁ])/;
// const diphthongComingPattern = /(?=[ąęǫḁ])/;

const questionWords = ['ma', 'mo', 'xu'];
// const starterWords = (['le', 'lo', 'lei', 'loi']);
const terminatorWords = ['ku', 'kei', 'vau', "ku'o", "li'u", "le'u", "ge'u", "zo'u"];
const mijymaho = ['cu'];
const seplyvla = ["ni'o", '.i', "no'i"];

export function lojban2ipaPolly(text: string): string {
  const parsed = lojban.romoi_lahi_cmaxes(text);
  if (parsed.tcini == 'fliba') return '';
  const parsedMap = parsed.kampu.filter((i: any) => i[0] !== 'drata');
  text = parsedMap
    .map((i: any) => canonicalizeValsi(i[1]))
    .join(' ')
    .replace(/-/g, '');
  const words = text.split(' ');
  let rebuiltWords: any[] = [];
  //   let questionSentence = false;

  for (let index in words) {
    const word = words[index] as string;
    let modifiedWord = krulermorna(word);
    // rebuiltWord = rebuiltWord.replace(new RegExp(`(${V}.*?)(${C})`,'g'),'$1.$2')

    let prefix = '';
    let postfix = '';

    let prefixCommand = [];
    let postfixCommand = [];
    // if (RegExp(`^.*${C}\\.$`).test(modifiedWord)) {
    //   prefixCommand.unshift('<break time="1ms" strength="x-weak" />');
    //   postfixCommand.push('<break time="1ms" strength="x-weak" />');
    // } else if (RegExp(`^\\.(?:${V}|${I}).*$`).test(modifiedWord)) {
    //   prefixCommand.unshift('<break time="1ms" strength="x-weak" />');
    // }

    if (seplyvla.includes(word)) {
      //   postfix = '?';
      prefixCommand.unshift('</s><s>');
    } else if (questionWords.includes(word)) {
      //   postfix = '?';
      prefixCommand.unshift('<break time="1ms" strength="x-weak" />');
    }

    // if (starterWords.includes(word)) {
    //   prefixCommand = '<break time="1ms" strength="x-weak" />' + prefixCommand;
    // }
    else if (
      terminatorWords.includes(word) &&
      words[parseInt(index) + 1] &&
      !terminatorWords.includes(words[parseInt(index) + 1] as string)
    ) {
      postfixCommand.push('<break time="1ms" strength="x-weak" />');
    }

    if (mijymaho.includes(word)) {
      postfix = postfix + 'ʔ';
      // postfixCommand.push('<break time="1ms" strength="x-weak" />');
    }

    // if (index === '0' || seplyvla.includes(word)) {
    //   prefix = '</s>\n<s>' + prefix;
    // }

    const splitWord = modifiedWord.split(vowelComingPattern);
    const headWord = splitWord.slice(0, -2);
    const tailWord = splitWord.slice(-2);
    if (
      tailWord.length === 2 &&
      (tailWord[0] ?? '').length > 0 &&
      tailWord[0]?.[0]?.match(vowelPattern) &&
      tailWord[1]?.[0]?.match(vowelPattern)
    ) {
      let head = headWord.join('');
      if (head === '') {
        modifiedWord = head + 'ˈ' + tailWord.join('');
      } else {
        head = head.replace(RegExp(`(${C}|${h})$`), "ˈ$1");
        modifiedWord = head + tailWord.join('');
      }
    }
    //  else if (
    //   tailWord.length === 2 &&
    //   (tailWord[0] ?? '').length > 0 &&
    //   tailWord[1]?.[0]?.match(diphthongComingPattern)
    // ) {
    //   const headWord = splitWord.slice(0, -2);
    //   modifiedWord = headWord.join('') + tailWord[0] + 'ˈ' + tailWord[1];
    // }

    // if (!(parseInt(index) - 1 >= 0 && starterWords.includes(words[parseInt(index) - 1] as string))) {
    //   prefix = '<break time="1ms" strength="x-weak" />' + prefix;
    // }

    let rebuiltWord = '';
    let consumed = 1;

    for (let i = 0; i < modifiedWord.length; i++) {
      const tail = modifiedWord.substring(i);
      let matched = false;
      for (const [attr, val] of Object.entries(ipaVits).sort((a, b) => b[0].length - a[0].length)) {
        const pattern = new RegExp('^' + attr);
        const matches = tail.match(pattern);

        if (matches && matches.length > 0) {
          const match = matches[0];
          consumed = match.length;
          rebuiltWord += val;
          matched = true;
          break;
        }
      }

      if (!matched) {
        rebuiltWord += modifiedWord[i];
      }

      i += consumed - 1;
    }

    rebuiltWords.push({
      prefixCommand,
      prefix,
      rebuiltWord,
      postfix,
      postfixCommand,
      word,
    });
  }

  for (const i in rebuiltWords) {
    const rebuiltWord = rebuiltWords[i];
    const nextWord = rebuiltWords[parseInt(i) + 1];
    if (
      nextWord &&
      !rebuiltWord.postfixCommand.length &&
      !nextWord.prefixCommand.length &&
      !nextWord.prefix &&
      (parsedMap as any)[parseInt(i)][0] === 'cmavo' &&
      (parsedMap as any)[parseInt(i) + 1][0] === 'cmavo'
    ) {
      rebuiltWords[parseInt(i) + 1].prefixCommand = rebuiltWord.prefixCommand;
      rebuiltWords[parseInt(i) + 1].prefix = rebuiltWord.prefix;
      rebuiltWords[parseInt(i) + 1].rebuiltWord = rebuiltWord.rebuiltWord + rebuiltWord.postfix + nextWord.rebuiltWord;
      rebuiltWords[parseInt(i) + 1].word = rebuiltWord.word + ' ' + nextWord.word;
      rebuiltWords[i] = null;
    }
  }

  rebuiltWords = rebuiltWords.filter(Boolean);
  rebuiltWords = rebuiltWords.map((w) => {
    const { prefixCommand, prefix, rebuiltWord, postfix, postfixCommand, word } = w;
    return `${[...new Set(prefixCommand)].join('')}<phoneme alphabet="ipa" ph="${
      prefix + rebuiltWord + postfix
    }">${word}</phoneme>${[...new Set(postfixCommand)].join('')}`;
  });

  let output = rebuiltWords.join('');
  output = output.replace(/ {2,}/g, ' ');
  output = output.replace(/, ?(?=,)/g, '');

  //   if (questionSentence) {
  //     output += '?';
  //   } else if (vowelPattern.test(text.charAt(text.length - 1))) {
  //     output += '.';
  //   }
  // console.log(output);
  return `<speak><prosody rate="x-slow"><s>${output}<break time="1ms" strength="x-weak" /></s></prosody></speak>`;
}

// Example usage:
// const result = lojban2ipaPolly('sipnybzu coi amkau gauxai matriocka amnadiia');
// const result = lojban2ipaPolly("merpe'ajitstic porto ckafre'ole"); //
// console.log(result);
