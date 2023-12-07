import dotenv from 'dotenv';
dotenv.config();

import fastXMLParser from 'fast-xml-parser';
import axios from 'axios';
import MDBReader from 'mdb-reader';
import fs from 'fs-extra';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import RakutenMA from '../node_modules/rakutenma/rakutenma.js';

import * as lojban from 'lojban';
import * as R from 'ramda';
import { bais, jbobangu, langs, predefinedLangs, scales } from './consts.js';
import { to } from 'await-to-js';
import objectHash from 'object-hash';
import pkg from '@piercefreeman/brotli-compress';
const { compress } = pkg;
import he from 'he';

import winston, { format } from 'winston';
import { preprocessDefinitionForVectors, roundToDecimals, uniques } from './utils/fns.js';
import type { Dict } from './types/index.js';
import { generate as generateMuplis, generateXraste } from './muplis.js';

import { TextEmbeddingModel } from './inference/index.js';

import { processWords as generateAudio } from './sance.js';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generatePEGGrammar } from './gentufa.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = winston.createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

export function getCLIArgs() {
  try {
    return process.argv.slice(2).map((i) => i.replace(/^--/, ''));
    // eslint-disable-next-line no-empty
  } catch (error: any) {
    logger.error(error?.message);
  }
  return [];
}

const pathVersio = path.join(__dirname, '../data/versio.json');

export async function updateXmlDumps(args: string[]) {
  fs.copySync(path.join(__dirname, '../default-data'), path.join(__dirname, '../data'));

  fs.outputFileSync(pathVersio, '{}');
  const erroredLangs: string[] = [];
  const valsi: Dict = {};
  const defs: Dict[] = [];
  if (args.includes('download')) {
    logger.info('〉 downloading dumps');
    for (const language of langs) {
      if (!predefinedLangs.includes(language)) erroredLangs.push(...(await downloadSingleDump({ language })));
    }
    logger.info('downloaded dumps');
    if (erroredLangs.length > 0) {
      logger.error(erroredLangs.toString());
    }
  }

  const modelMetadata = {
    id: 'mini-lm-v2-quant',
    title: 'Quantized mini model for sentence embeddings',
    encoderPath: './data/dumps/mini-lm-v2-quant.brotli',
    outputEncoderName: 'last_hidden_state',
    tokenizerPath: './data/dumps/mini-lm-v2-quant.tokenizer.brotli',
    padTokenID: 0,
    readmeUrl: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2',
  };

  const model = await TextEmbeddingModel.create(modelMetadata);

  logger.info('〉 generating compressed dictionaries');

  // const dicts: Dict = {};
  for (const language of predefinedLangs.concat(langs)) {
    try {
      const { words, segerna, dump } = await ningauPaLaSutysisku(language, undefined, { model });
      // if (language === 'en') dicts[language] = dump;
      if (predefinedLangs.includes(segerna)) {
        valsi[segerna] = [...new Set((valsi[segerna] ?? []).concat(words))];
        (defs as any)[segerna] = { ...dump, ...((defs as any)[segerna] ?? {}) };
      } else {
        valsi['lojban'] = [...new Set((valsi['lojban'] ?? []).concat(words))];
        (defs as any)['lojban'] = { ...dump, ...((defs as any)['lojban'] ?? {}) };
      }
    } catch (error) {
      logger.error('updating la sutysisku: ' + (error as Error).message);
      erroredLangs.push(language);
    }
  }
  logger.info('generated compressed dictionaries');

  const {
    deksi,
    tsv: { jb2en, en2jb },
  } = await generateMuplis();

  const { words } = await ningauPaLaSutysisku('muplis', deksi, { model });
  valsi['lojban'] = [...new Set((valsi['lojban'] ?? []).concat(words))];
  // dicts.muplis = dump;

  fs.outputFileSync(path.join(__dirname, '../data/dumps/muplis-jb2en.tsv'), jb2en);
  fs.outputFileSync(path.join(__dirname, '../data/dumps/muplis-en2jb.tsv'), en2jb);

  // logger.info('〉 generating embeddings dictionaries');

  // Object.keys(dicts.muplis).forEach((key) => {
  //   if (dicts.en[key]) {
  //     dicts.en[key].n = ((dicts.en[key].n ?? '') + ' ' + dicts.muplis[key].d).trim();
  //   } else {
  //     dicts.en[key] = dicts.muplis[key];
  //   }
  // });
  // const [keys, values] = [
  //   Object.keys(dicts.en),
  //   Object.values(dicts.en).map((i) =>
  //     preprocessDefinitionForVectors((i as Dict).d + ' ' + (i as Dict).n + ' ' + (i as Dict).g || ''),
  //   ),
  // ];
  // const chunkSize = 50;
  // const chunks = splitArray(values, chunkSize);

  // let vectorDict: string[] = [];
  // for (let i = 0; i < chunks.length; i++) {
  //   const chunk = chunks[i];
  //   if (!chunk) continue;
  //   const processed = await model.infer(chunk);
  //   const vectors: string[] = processed.vectors.map((vector: number[], j: number) =>
  //     [
  //       keys[i * chunkSize + j],
  //       vector
  //         .map((res) => roundToDecimals(res, 2, false))
  //         .join(',')
  //         .replace(/,-/g, '-')
  //         .replace(/,0,/g, ',,'),
  //     ].join('\t'),
  //   );
  //   vectorDict.push(...vectors);
  // }
  // const strVectors = vectorDict.join('\n');
  // fs.outputFileSync(path.join(__dirname, '../data/parsed/en-vektori.tsv'), strVectors);
  // const compressed = await compress(Buffer.from(strVectors));
  // fs.outputFileSync(path.join(__dirname, '../data/parsed/en-vektori.tsv') + '.bin', compressed);

  // const hash = objectHash(vectorDict);
  // const jsonTimes: { [key: string]: string } = JSON.parse(fs.readFileSync(pathVersio, { encoding: 'utf8' }));
  // jsonTimes['en-vektori'] = hash + '-' + '1';
  // fs.outputFileSync(pathVersio, JSON.stringify(jsonTimes));

  // logger.info('generated embeddings dictionaries');

  const xraste = await generateXraste();
  if (xraste) {
    await ningauPaLaSutysisku('xraste', xraste.deksi, { model });
    fs.outputFileSync(path.join(__dirname, '../data/parsed/parsed-xraste.json'), JSON.stringify(xraste.full));
  } else {
    process.exit();
  }

  //TODO: process all words from valsi not under lojban key

  const { generated, source } = await generatePEGGrammar(
    {
      path: path.join(__dirname, './grammars/camxes.peg'),
      allowedStartRules: ['text'],
      ignoredRules: ['INDICATOR_2', 'INDICATOR_2_TAIL'],
    },
    (defs as any)['lojban'],
  );
  fs.outputFileSync(path.join(__dirname, '../data/grammars/camxes-secnegau.peg'), source);
  fs.outputFileSync(path.join(__dirname, '../data/grammars/camxes.js'), generated);

  try {
    await generateAudio(valsi.lojban.sort());
  } catch (error: unknown) {
    if (error instanceof Error) logger.error(error?.message);
  }

  return uniques(erroredLangs);
}

async function downloadSingleDump({ language }: { language: string }) {
  const Cookie = process.env['JBOVLASTE_COOKIE'];
  const url = `https://jbovlaste.lojban.org/export/xml-export.html?lang=${language}`;
  const [err, response] = await to(
    axios.get(url, {
      headers: {
        Cookie,
      },
    }),
  );
  const erroredLangs: string[] = [];
  if (err) {
    erroredLangs.push(language);
    return erroredLangs;
  }
  const t = path.join(__dirname, `../data/dumps/${language}`);
  fs.outputFileSync(`${t}.xml.temp`, response.data);
  const jsonDoc = fastParse(`${t}.xml.temp`);
  fs.outputFileSync(`${t}.json`, JSON.stringify(jsonDoc));
  fs.moveSync(`${t}.xml.temp`, `${t}.xml`, { overwrite: true });
  return erroredLangs;
}

async function generateLoglanDexieDictionary() {
  const buffer = (
    await axios.get('https://github.com/torrua/LOD/blob/master/source/LoglanDictionary.mdb?raw=true', {
      responseType: 'arraybuffer',
    })
  ).data;
  // const buffer = readFileSync("LoglanDictionary.mdb");
  const reader = new MDBReader(buffer);
  const tableSpells = reader.getTable('WordSpell').getData();
  const tableDefs = reader.getTable('WordDefinition').getData();
  const tableWords = reader.getTable('Words').getData();
  const djifoa = tableWords
    .filter((i) => i['Type'] === 'Afx' && i['Origin'])
    .map((i) => ({ ...i, Word: i['Origin'] ? (i['Origin'] as string).replace(/[()]/g, '') : null } as Dict));

  const tableSpells_ = tableDefs
    .map((i) => {
      const tmp: any = {
        ...tableSpells.filter((j) => j['WID'] == i['WID'])[0],
        definition: i,
        source: tableWords.filter((j) => j['WID'] == i['WID']),
      };
      if (tmp.definition.Usage !== null) {
        tmp.Word = tmp.definition.Usage.replace(/(?<=[a-z])%/g, '').replace(/%/g, tmp.Word);
        delete tmp.source;
      }
      // search for djifoa
      const foundDjifoa = djifoa
        .filter((k) => k['Word'] === tmp.Word)
        .map((k) => tableSpells.filter((j) => j['WID'] === k['WID'])?.[0]?.['Word']);
      if (foundDjifoa.length > 0) {
        tmp.r = foundDjifoa;
      }
      return tmp;
    })
    .filter((i) => !(i.source?.[0]?.Type === 'Afx' && i.source?.[0]?.Origin))
    .map((i) => {
      const notes: any[] = [];
      let usedIn;
      if (i.source) {
        i.source = i.source[0];
        if (i.source.UsedIn) {
          usedIn = (i.source.UsedIn || '')
            .split(/ *\| */)
            .filter(Boolean)
            .map((i: any) => `{${i}}`)
            .join(', ');
          notes.push(usedIn);
        }
        if (i.source.Origin) notes.push('⬅ ' + i.source.Origin);
      }
      const notes_ = notes.join('\n');
      const obj: any = {
        bangu: 'loglan',
        w: i.Word,
        n: notes_,
        d: i.definition.Definition,
        t: i.source?.Type,
        s: i.definition.Grammar || i.source?.XType,
        r: i.r,
      };

      obj.g = ((obj.d || '').match(/(«.*?»)/g) || []).map((i: string) => i.substring(1, i.length - 1));
      const cached_def = { ...obj };
      cached_def.n = usedIn || undefined;
      const obj_ = { ...obj, ...addCache({ cachedDefinition: cached_def, excludeKeys: ['s', 't'] }) };
      if (obj_.g && obj_.g.length === 0) delete obj_.g;
      if (!obj_.r && i.source?.[0]?.Affixes) obj_.r = i.source?.[0]?.Affixes.split(/ +/);
      Object.keys(obj).forEach((key) => [undefined, '', null].includes(obj_[key]) && delete obj_[key]);
      // obj.raw = i
      return obj;
    });
  return tableSpells_;
}

function addCache({ cachedDefinition, excludeKeys = [] }: { cachedDefinition: any; excludeKeys?: string[] }) {
  excludeKeys.forEach((key) => delete cachedDefinition[key]);
  let cache;
  if (Array.isArray(cachedDefinition.g)) cachedDefinition.g = cachedDefinition.g.join(';');
  cache = [cachedDefinition.w, cachedDefinition.s, cachedDefinition.g, cachedDefinition.d, cachedDefinition.n]
    .concat(cachedDefinition.r || [])
    .filter(Boolean)
    .join(';')
    .toLowerCase();
  const cache2 = cache
    .replace(/[ \u2000-\u206F\u2E00-\u2E7F\\!"#$%&()*+,./:<=>?@[\]^`{|}~：？。，《》「」『』－（）]/g, ';')
    .split(';');
  cache = cache.replace(
    /[ \u2000-\u206F\u2E00-\u2E7F\\!"#$%&()*+,\-./:<=>?@[\]^`{|}~：？。，《》「」『』－（）]/g,
    ';',
  );
  cache = `${cache};${cache.replace(/h/g, "'")}`.split(';');
  cache = [...new Set(cache.concat(cache2))].filter(Boolean);

  return { g: cachedDefinition.g, cache };
}

function cleanCJKText(text: string) {
  return {
    cjk: text.replace(/[a-zA-Zа-яА-ЯЁё0-9']/g, ' ').replace(
      // eslint-disable-next-line no-misleading-character-class
      /[ \u2000-\u206F\u2E00-\u2E7F\\!"#$%&()*+,\-./:<=>?@[\]^`{|}~：？。，《》「」『』；_－／（）々仝ヽヾゝゞ〃〱〲〳〵〴〵「」『』（）〔〕［］｛｝｟｠〈〉《》【】〖〗〘〙〚〛。、・゠＝〜…‥•◦﹅﹆※＊〽〓♪♫♬♩〇〒〶〠〄再⃝ⓍⓁⓎ]/g,
      ' ',
    ),
    nonCjk: text.replace(/[^a-zA-Zа-яА-ЯЁё0-9']/g, ' '),
  };
}

function splitToChunks(array: Dict[], parts: number, tegerna: string): Dict[][] {
  if (array.length === 0) return [[]];
  const result: Dict[][] = [];
  const arr_length = array.length;
  for (let i = parts; i > 0; i--) {
    const newChunk = array.splice(0, Math.max(2000, Math.ceil(array.length / i)));
    if (newChunk.length > 0) result.push(newChunk);
  }
  logger.info(`${tegerna} dexie dump generated, ${result.length} parts, ${arr_length} entries`);

  return result;
}

function removeEmptyLinesAtEnd(array: any[]) {
  while (array[array.length - 1] === '') {
    array.pop();
  }
  return array;
}

function generateChunk({ segerna, chunk, index }: { segerna: string; chunk: Dict[]; index: number }) {
  let columns: string[] = [];
  for (const row of chunk) columns = [...new Set(columns.concat(Object.keys(row)))];

  const outp = [
    ['@rowCount', chunk.length].join('\t'),
    columns.join('\t'),
    ...chunk.map((row) =>
      removeEmptyLinesAtEnd(columns.map((column) => row[column] ?? ''))
        .join('\t')
        .replace(/\n/g, '\\n'),
    ),
  ].join('\n');

  const errors: any[] = [];
  const results: any[] = [];
  try {
    results.push({ path: `../data/parsed/parsed-${segerna}-${index}`, content: outp });
    // result.push(`saving ${tegerna}-${index}`);
  } catch (error) {
    errors.push(`couldn't save ${segerna}-${index} ${(error as Error).stack}`);
  }
  return { results, errors };
}

async function ningauLeDeksiSutysisku({
  json,
  segerna,
  arr = [],
  model,
}: {
  json?: Dict;
  segerna: string;
  arr?: Dict[];
  model?: TextEmbeddingModel;
}) {
  if (['loglan'].includes(segerna)) {
    arr = await generateLoglanDexieDictionary();
  } else {
    let rma;
    if (['ja', 'zh'].includes(segerna) && process.argv[2] !== 'skipCJK') {
      const modelRakuten = JSON.parse(
        fs.readFileSync(path.join(__dirname, `../node_modules/rakutenma/model_${segerna}.json`), { encoding: 'utf8' }),
      );
      rma = new RakutenMA(modelRakuten, 1024, 0.007812); // Specify hyperparameter for SCW (for demonstration purpose)
      rma.featset = RakutenMA[`default_featset_${segerna}`];
      // Set the feature hash function (15bit)
      rma.hash_func = RakutenMA.create_hash_func(15);
    }
    // let en_embeddings;
    // if (['en'].includes(segerna)) {
    //   en_embeddings = JSON.parse(
    //     fs.readFileSync(`/livla/src/sutysisku/src/data/parsed-en-embeddings.json`, { encoding: 'utf8' }),
    //   );
    // }

    if (arr.length === 0 && json) {
      const keys = Object.keys(json);
      for (const word of keys) {
        //complement r field of valsi table by full rafsi
        json[word].r = json[word].r ?? [];
        if (
          json[word].t === 'gismu' ||
          json[word].t === 'experimental gismu' ||
          (json[word].t || '').indexOf("fu'ivla") >= 0
        ) {
          json[word].r.push(word);
        } else if (json[word].t === 'lujvo') {
          const veljvo = lojban.jvokaha_gui(word);
          if (veljvo.length < 2) {
            json[word].v = word
              .split(/ zei /g)
              .map((i) => i.trim())
              .filter(Boolean);
          } else {
            json[word].v = veljvo;
          }
        }
        if (json[word].r && json[word].r.length === 0) delete json[word].r;
        if ((json[word].r ?? []).length > 0) json[word].r = (json[word].r || []).join(';');
        if ((json[word].g ?? []).length > 0) json[word].g = (json[word].g || []).join(';');

        let rec = { w: word, ...json[word] };
        if (['ja', 'zh'].includes(segerna) && process.argv[2] !== 'skipCJK') {
          // Tokenize one sample sentence
          const cached_def = { ...rec };
          if (rec.d) {
            const { cjk, nonCjk } = cleanCJKText(rec.d + ' ' + rec.n);
            cached_def.d =
              rma
                .tokenize(cjk)
                .map((i: any[]) => i[0])
                .join(' ') +
              ' ' +
              nonCjk;
          }
          rec = { ...rec, ...addCache({ cachedDefinition: cached_def }) };
        }
        if (model) rec = await addVectors(rec, model, segerna);
        // if (['en'].includes(segerna) && en_embeddings[word]) {
        //   //todo: download .z props, add .z props
        //   rec.z = en_embeddings[word].split(' ');
        // }

        arr.push(rec);
      }
    } else if (arr.length > 0 && model) {
      arr = await Promise.all(arr.map((rec) => addVectors(rec, model, segerna)));
    }
    const order = [
      'gismu',
      'cmavo',
      'experimental gismu',
      'lujvo',
      'zei-lujvo',
      "fu'ivla",
      'cmevla',
      'experimental cmavo',
      "obsolete fu'ivla",
    ];
    arr.sort((x, y) => (order.indexOf(x.t) === -1 ? 1 : order.indexOf(x.t) - order.indexOf(y.t)));
  }

  // fs.outputFileSync(path.join(__dirname, `../data/parsed/parsed-${segerna}-processed.json`), JSON.stringify(arr,null,2));
  arr = arr.map((el) => {
    const { ve, src, ...rest } = el;
    return rest;
  });

  const hash = objectHash(arr);

  let index = 0;
  for (const chunk of splitToChunks(arr, 5, segerna)) {
    const { errors, results } = generateChunk({ segerna, chunk, index });
    for (const error of errors) logger.error('generating a chunk: ' + error);
    for (const result of results) {
      result.path = path.join(__dirname, result.path);
      try {
        const compressed = await compress(Buffer.from(result.content));
        fs.outputFileSync(result.path + '.bin', compressed);
        fs.outputFileSync(result.path + '.tsv', result.content);
      } catch (error: any) {
        logger.error({ event: 'compression', message: error.message, content: result.content });
      }
    }
    index++;
  }

  const jsonTimes: { [key: string]: string } = JSON.parse(fs.readFileSync(pathVersio, { encoding: 'utf8' }));
  jsonTimes[segerna] = hash + '-' + index;
  fs.outputFileSync(pathVersio, JSON.stringify(jsonTimes));
}

async function addVectors(rec: any, model: TextEmbeddingModel, segerna: string) {
  if (model && ['en', 'muplis', '2002'].includes(segerna)) {
    const preprocessed = preprocessDefinitionForVectors((rec.d || '') + ' ' + (rec.n || '') + ' ' + (rec.g || ''));
    const processed = await model.infer([preprocessed]);
    const vector = processed.vectors[0];
    if (vector) {
      rec.q = vector.map((num) => String.fromCharCode(roundToDecimals((num + 1) / 2, 94, false) + 32)).join('');
      rec.ve = JSON.stringify(vector);
      rec.src = preprocessed;
    }
  }
  return await rec;
}
async function ningauPaLaSutysisku(segerna: string, arr: Dict[] = [], options: { model?: TextEmbeddingModel } = {}) {
  // write a new file parsed.json that would be used by la sutysisku
  if (!segerna) segerna = 'en';
  let dump: Dict = {};
  let words: Dict = {};
  try {
    if (arr.length === 0) {
      dump = prepareSutysiskuJsonDump(segerna).json;
      await ningauLeDeksiSutysisku({
        json: dump,
        segerna,
        model: options.model,
      });
      words = Object.keys(dump);
    } else {
      words = arr.map((i) => i.w);

      for (const item of arr) {
        const { w, ...rest } = item;
        dump[w] = rest;
      }

      await ningauLeDeksiSutysisku({
        segerna,
        arr,
        model: options.model,
      });
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error('dexie la sutysisku: ' + error?.stack);
    }
  }
  const t = path.join(__dirname, '../data/parsed', `parsed-${segerna}.json`);
  if (dump) {
    fs.outputFileSync(`${t}.temp`, JSON.stringify(dump));
    fs.renameSync(`${t}.temp`, t);
  }
  return { words, segerna, dump };
}

function jsonDocDirection(jsonDoc: any): any {
  return jsonDoc.dictionary.direction[0] || jsonDoc.dictionary.direction;
}

const prettifiedDictEntries = new Map<string, string>();

function prepareSutysiskuJsonDump(language: string) {
  const jsonDoc: any = getJsonDump(path.join(__dirname, `../data/dumps/${language}.json`));
  let json: any = {};
  jsonDocDirection(jsonDoc).valsi.forEach((valsi: Dict) => {
    let g: string[] | undefined;
    if (R.path(['glossword', 'word'], valsi)) {
      g = [valsi.glossword.word];
    } else if (Array.isArray(valsi.glossword)) {
      g = valsi.glossword.map((i: any) => i.word);
    }
    if (jbobangu.includes(language)) {
      //memoization
      const prettified = prettifiedDictEntries.get(valsi.word);
      if (prettified) {
        valsi.word = prettified;
      } else {
        const parsed = lojban.romoi_lahi_cmaxes(valsi.word);
        if (parsed.tcini === 'snada') {
          const prettified = parsed.kampu
            .filter((i) => i[0] !== 'drata')
            .map((i) => i[1].replace(/-/g, ''))
            .join(' ');
          prettifiedDictEntries.set(valsi.word, prettified);
          valsi.word = prettified;
        }
      }
    }
    json[valsi.word] = {
      d: preprocessRecordFromDump({ text: preprocessDefinitionFromDump({ bais, scales }, language, valsi) }),
      n: preprocessRecordFromDump({ text: valsi.notes }),
      t: valsi.type,
      s: valsi.selmaho,
      e: valsi.example,
      k: valsi.related,
    };
    if (g !== undefined) {
      json[valsi.word].g = g;
    }
    if (valsi.rafsi) {
      if (Array.isArray(valsi.rafsi)) {
        json[valsi.word].r = valsi.rafsi;
      } else {
        json[valsi.word].r = [valsi.rafsi];
      }
    } else if (RegExp(`rafsi.{0,3}-[a-z']{3,4}-`).test(valsi.notes)) {
      json[valsi.word].r = [valsi.notes.match(/.*-([a-z']{3,4})-/)[1]];
    } else {
      json[valsi.word].r = [];
    }
    if (valsi.type === 'gismu' && valsi.word.indexOf('brod') !== 0) {
      json[valsi.word].r.push(valsi.word.substr(0, 4));
    }
    if (valsi.word === 'broda') {
      json[valsi.word].r.push('brod');
    }
    if (json[valsi.word].r.length === 0) delete json[valsi.word].r;
    Object.keys(json[valsi.word]).forEach(
      (key) => (json[valsi.word][key] ?? []).length === 0 && delete json[valsi.word][key],
    );
  });
  json = addBAIReferences(json, language);
  return {
    js: `sorcu["${language}"] = ${JSON.stringify(json)}`,
    json,
  };
}

function preprocessRecordFromDump({ text }: { text: string }) {
  if (!text || typeof text !== 'string') return text;

  //prettify latex
  text = text
    .replace(/(?<=\$[a-z_'0-9A-Z]+?)\$=\$(?=[a-z_'0-9A-Z]+?\$)/g, '=')
    .replace(/(?<=\$[a-z_'0-9A-Z=]+?)=(?=[a-z_'0-9A-Z=]+?\$)/g, '$=$');
  return text;
}

function preprocessDefinitionFromDump({ bais, scales }: { bais: any; scales: any }, lang: string, valsi: any): string {
  let definition = valsi.definition;
  if (!definition) return definition;
  definition = preprocesWordWithScale(valsi, scales[lang] || scales['en']);
  try {
    const bai = bais[lang] || bais['en'];
    return definition.replace(RegExp(bai.initial), bai.replacement);
  } catch (error) {
    return definition;
  }
}

function preprocesWordWithScale(valsi: any, scale: any) {
  let prefix = '',
    oldPrefix = '';
  const root = valsi.word.replace(/(nai|cu'i|ja'ai)+$/, '');
  const type = /nai$/.test(valsi.word) ? 2 : /cu[h']i$/.test(valsi.word) ? 1 : 0;
  //vocative: hospitality - inhospitality; you are welcome/ make yourself at home.
  if (RegExp(scale.COI.selmaho).test(valsi.selmaho)) {
    if (RegExp(scale.COI.match).test(valsi.definition)) {
      prefix = `${valsi.definition.split(':')[0]}: \n`;
      oldPrefix = `${valsi.definition.split(':')[0]}: `;
      valsi.definition = valsi.definition.replace(RegExp(`${valsi.definition.split(':')[0]}: `), '');
    }
    valsi.definition = valsi.definition.split(';');
    const core = valsi.definition[0].split(' - ');
    if (core.length === 3) {
      const postfix = valsi.definition.slice(1).join(';').trim();
      core[0] = `{${root}} - ${core[0] + (postfix && type === 0 ? '; ' + postfix : '')}`;
      core[1] = `{${root}cu'i} - ${core[1] + (postfix && type === 1 ? '; ' + postfix : '')}`;
      core[2] = `{${root}nai} - ${core[2] + (postfix && type === 2 ? '; ' + postfix : '')}`;
      valsi.definition[0] = core.join('\n');
      valsi.definition = prefix + valsi.definition[0];
    } else if (core.length === 2) {
      const postfix = valsi.definition.slice(1).join(';').trim();
      core[0] = `{${root}} - ${core[0] + (postfix && type === 0 ? '; ' + postfix : '')}`;
      core[1] = `{${root}nai} - ${core[1] + (postfix && type === 2 ? '; ' + postfix : '')}`;
      valsi.definition[0] = core.join('\n');
      valsi.definition = prefix + valsi.definition[0];
    } else {
      valsi.definition = oldPrefix + valsi.definition.join(';').trim();
    }
  } else if (RegExp(scale.UI.selmaho).test(valsi.selmaho)) {
    if (RegExp(scale.UI.match).test(valsi.definition)) {
      prefix = `${valsi.definition.split(':')[0]}: \n`;
      oldPrefix = `${valsi.definition.split(':')[0]}: `;
      valsi.definition = valsi.definition.replace(RegExp(`${valsi.definition.split(':')[0]}: `), '');
    }
    valsi.definition = valsi.definition.split(';');
    const core = valsi.definition[0].split(' - ');
    if (core.length === 3) {
      const postfix = valsi.definition.slice(1).join(';').trim();
      core[0] = `{${root}} - ${core[0] + (postfix && type === 0 ? '; ' + postfix : '')}`;
      core[1] = `{${root}cu'i} - ${core[1] + (postfix && type === 1 ? '; ' + postfix : '')}`;
      core[2] = `{${root}nai} - ${core[2] + (postfix && type === 2 ? '; ' + postfix : '')}`;
      valsi.definition[0] = core.join('\n');
      valsi.definition = prefix + valsi.definition[0];
    } else if (core.length === 2) {
      const postfix = valsi.definition.slice(1).join(';').trim();
      core[0] = `{${root}} - ${core[0] + (postfix && type === 0 ? '; ' + postfix : '')}`;
      core[1] = `{${root}nai} - ${core[1] + (postfix && type === 2 ? '; ' + postfix : '')}`;
      valsi.definition[0] = core.join('\n');
      valsi.definition = prefix + valsi.definition[0];
    } else {
      valsi.definition = oldPrefix + valsi.definition.join(';').trim();
    }
  }
  return valsi.definition;
}

function addBAIReferences(json: any, lang: string) {
  const bai: any = (bais as any)[lang] ?? bais['en'];

  Object.keys(json).forEach((word) => {
    let match;
    try {
      match = json[word].d.match(RegExp(bai.processed));
    } catch (error) {
      return;
    }
    if (!match) return;
    match = match[2];
    if (!match) return;
    //it's a BAI modal. add it now
    if (!json[match]) return;
    if (!json[match].b) json[match].b = [];
    json[match].b.push(word);
  });
  Object.keys(json).forEach((word) => {
    const match = json[word].b;
    if (match) {
      json[word].b = match.sort((a: any[], b: any[]) => a.length - b.length).join(';');
    }
  });
  return json;
}

function getJsonDump(filePath: string): any {
  let dump;
  if (!fs.existsSync(filePath)) {
    dump = fastParse(filePath.replace(/\.json$/, '.xml'));
    fs.outputFileSync(filePath, JSON.stringify(dump));
  } else {
    try {
      dump = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));
    } catch (error) {
      dump = {};
    }
  }
  return dump;
}

function fastParse(file: string) {
  return fastXMLParser.parse(
    fs
      .readFileSync(file, {
        encoding: 'utf8',
      })
      .replace(/(&lt;|<)script.*?(&gt;|>).*?(&lt;|<)/g, '&lt;')
      .replace(/(&lt;|<)\/script(&gt;|>)/g, ''),
    {
      attributeNamePrefix: '',
      ignoreAttributes: false,
      allowBooleanAttributes: false,
      parseNodeValue: false,
      parseAttributeValue: false,
      attrValueProcessor: (a) => he.decode(a, { isAttributeValue: true }),
      tagValueProcessor: (a) => he.decode(a),
    },
  );
}
