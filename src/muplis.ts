//prepare muplis dump and download it to the specified location

import * as fs from 'fs';
import * as path from 'path';
import * as lojban from 'lojban';
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';

interface SrcTarget {
  source: string;
  source_opt?: string;
  target: string;
  target_opt?: string;
  tags?: string;
}

interface DexieDictEntry {
  w: string;
  bangu: string;
  d: string;
  cache: string;
  s?: string | undefined;
}

export async function prepareMuplisDump({
  apiKey,
  outputDir = path.join(__dirname, './dist'),
  spreadsheetId = '1Md0pojdcO3EVf3LQPHXFB7uOThNvTWszkWd5T4YhvKs',
  sheetId = '551499663',
  maxLinesToParse = 92000,
}: {
  apiKey: string;
  outputDir: string;
  spreadsheetId: string;
  sheetId: string;
  maxLinesToParse: number;
}): Promise<{ hash: string; errors: string[] }> {
  const doc = new GoogleSpreadsheet(spreadsheetId);
  const errors: string[] = [];
  if (!apiKey) {
    throw new Error('muplis dump preparation cancelled, no apiKey specified (generate it from Google dashboard)');
  }
  doc.useApiKey(apiKey);
  await doc.loadInfo();
  const sheet = doc.sheetsById[sheetId];

  const output: {
    en2jb: SrcTarget[];
    jb2en: SrcTarget[];
  } = {
    en2jb: [],
    jb2en: [],
  };

  const limit = 10000;
  for (let offset = 0; offset < maxLinesToParse; offset += limit) {
    try {
      const rows = await sheet.getRows({
        offset,
        limit,
      });
      const { jb2en, en2jb } = processRows(rows, (message) => {
        errors.push(message);
      });
      output.jb2en = output.jb2en.concat(jb2en);
      output.en2jb = output.en2jb.concat(en2jb);
    } catch (error: any) {
      errors.push(error?.response?.data);
      continue;
    }
  }

  const hash = createDexieCacheFile(output.jb2en, outputDir);
  const tsvOutput: { jb2en: string; en2jb: string } = { jb2en: '', en2jb: '' };
  tsvOutput.jb2en = output.jb2en
    .map((i) => `${i.source}\t${i.target}\t${i.tags ?? ''}`)
    .join('\n')
    .replace(/[\r\n]{2,}/g, '\n');
  tsvOutput.en2jb = output.en2jb
    .map((i) => `${i.source}\t${i.target}\t${i.tags}`)
    .join('\n')
    .replace(/[\r\n]{2,}/g, '\n');
  fs.writeFileSync(path.join(outputDir, './jb2en.tsv'), tsvOutput.jb2en);
  fs.writeFileSync(path.join(outputDir, './en2jb.tsv'), tsvOutput.en2jb);
  return { hash, errors };
}

function createDexieCacheFile(arr: SrcTarget[], outputDir: string) {
  const a = arr.map((i: SrcTarget) => {
    let cache = `${i.source};${i.source.replace(/h/g, "'")};${i.source_opt};${(i.source_opt || '').replace(
      /h/g,
      "'",
    )};${i.target.replace(/[\.,!?\/\\]/g, '').replace(/[h‘]/g, "'")};`;
    const cache1 = cache
      .toLowerCase()
      .replace(/ /g, ';')
      .split(';')
      .map((i) => i.trim())
      .filter((i) => i !== '');
    let cache2 = cache
      .toLowerCase()
      .replace(/[ \u2000-\u206F\u2E00-\u2E7F\\!"#$%&()*+,\-.\/:<=>?@\[\]^`{|}~：？。，《》「」『』－（）]/g, ';')
      .split(';')
      .map((i) => i.trim())
      .filter((i) => i !== '');
    let arrCache = cache1.concat(cache2);
    arrCache = [...new Set(arrCache)];
    const outRow: DexieDictEntry = { w: i.source, bangu: 'muplis', d: i.target, cache };
    if ((i.tags ?? '').split(' ').length > 0) outRow.s = i.tags ?? '';
    return outRow;
  });
  const hash = require('object-hash')(a);
  splitOutput(a, outputDir);
  return hash;
}

function canonicalizeValsi(valsi: string) {
  if (/^[aeiouy]/.test(valsi)) valsi = '.' + valsi;
  if (/y$/.test(valsi) && valsi.indexOf('.') !== 0) valsi = valsi + '.';
  if (/[^aeiouy]$/.test(valsi)) valsi = '.' + valsi + '.';
  return valsi.replace(/\.\./g, '.');
}

function processRows(rows: GoogleSpreadsheetRow[], cbErrors: (arg: string) => void) {
  let n: SrcTarget[] = [];
  for (const r of rows) {
    if (r._rowNumber % 100 === 0) console.log(`processing row ${r._rowNumber}`);
    const tags = (r["Ilmen's tags"] || '') + (r["gleki's tags"] || '') + (r["uakci's optional new tags"] || '');
    const j: SrcTarget = {
      target_opt: '',
      source: r['Tatoeba: English'] || '',
      target:
        r["gleki's alternative proposal"] ||
        r["Ilmen's alternative proposal"] ||
        r["uakci's revision"] ||
        r['jelca proposal'] ||
        r['Tatoeba: Lojban'] ||
        '',
      tags: r["gleki's tags"] || r["Ilmen's tags"] || r["uakci's optional new tags"] || '',
    };

    if (
      (tags.indexOf('B') >= 0 && j.target === r['Tatoeba: Lojban']) ||
      (r['Tatoeba: Lojban'] || '') === '' ||
      (r['Tatoeba: English'] || '') === ''
    )
      continue;
    j.target = lojban.preprocessing(j.target.toLowerCase());

    try {
      j.target_opt = lojban
        .romoi_lahi_cmaxes(lojban.zeizei(j.target.replace(/ĭ/g, 'i').replace(/ŭ/g, 'u')))
        .kampu.filter((i: [string, string]) => i[0] !== 'drata')
        .map((i: [string, string]) => i[1])
        .join(' ')
        .replace(/-/g, '');
    } catch (error) {
      continue;
    }

    j.source = j.source
      .replace(/ {2,}/g, ' ')
      .replace(/[\r\n]/g, '')
      .replace(/’/g, "'")
      .trim();
    if (j.source !== '' && j.target !== '' && j.target.search(/\bzoi\b/) === -1) {
      try {
        const parsed = lojban.romoi_lahi_cmaxes(j.target);
        if (parsed.tcini == 'fliba') continue;
        j.target = parsed.kampu
          .filter((i: [string, string]) => i[0] !== 'drata')
          .map((i: [string, string]) => canonicalizeValsi(i[1]))
          .join(' ')
          .replace(/-/g, '');
        if (!j.target.split(' ').includes('zei'))
          j.target_opt = (j.target_opt ?? '')
            .split(' ')
            .filter((i) => i !== 'zei')
            .join(' ');
      } catch (error) {
        cbErrors(error as string);
      }
      n = duplicator({ n, j });
    }
  }

  let en2jb = n.map((r) => {
    const outRow = { source: r.source, target: r.target, tags: r.tags };
    return outRow;
  });
  en2jb = [...new Set(en2jb.map((el) => JSON.stringify(el)))].map((el) => JSON.parse(el));
  let jb2en = n.map((r) => {
    // Or this is what la Ilmen uses: G (good), G− (a little good, not so good), G+ (very good), A (acceptable), B[−+] ([a little / very] bad), N (neologism, containing an undocumented Lojban word), E (experimental grammar), P (non-conventional punctuation), C - CLL style, X - xorlo. W - play on words and thus poorly translatable to/from Lojban
    r.tags = (r.tags ?? '')
      .replace(/ /g, '')
      .split(/[A-Z][\+\-]?/)
      .filter((i) => i !== '')
      .map((i) => {
        i = i
          .replace(/^G\-$/, '👍')
          .replace(/^G$/, '👍👍')
          .replace(/^G\+$/, '👍👍👍')
          .replace(/^A$/, '😐')
          .replace(/^B-$/, '👎')
          .replace(/^B$/, '👎👎')
          .replace(/^B\+$/, '👎👎👎')
          .replace(/^N$/, '👒')
          .replace(/^E$/, '🧪')
          .replace(/^P$/, '🎗')
          .replace(/^C$/, '📕')
          .replace(/^X$/, 'xorlo')
          .replace(/^W$/, 'trokadilo');
        return i;
      })
      .join(' ');
    const outRow = { source: r.target, source_opt: r.target_opt, target: r.source, tags: r.tags };
    return outRow;
  });
  jb2en = [...new Set(jb2en.map((el) => JSON.stringify(el)))].map((el) => JSON.parse(el));

  return { jb2en, en2jb };
}

function duplicator({ n, j }: { n: SrcTarget[]; j: SrcTarget }) {
  j.target = j.target
    .replace(/\bmeris\b/g, 'maris')
    .replace(/\btokion\b/g, 'tokios')
    .replace(/\ble\b/g, 'lo')
    .replace(/\blei\b/g, 'loi');
  n.push(j);
  if (j.source.search(/\bTom\b/) >= 0) {
    let j2: SrcTarget = JSON.parse(JSON.stringify(j));
    j2.source = j2.source.replace(/\bTom\b/g, 'Alice');
    j2.target = j2.target.replace(/\btom\b/g, 'alis');
    j2.target = j2.target.replace(/\btam\b/g, 'alis');
    n = n.concat(j2);

    j2 = JSON.parse(JSON.stringify(j));
    j2.source = j2.source.replace(/\bTom\b/g, 'Mary');
    j2.target = j2.target.replace(/\btom\b/g, 'maris');
    j2.target = j2.target.replace(/\btam\b/g, 'maris');
    n = n.concat(j2);
  }
  if (j.source.search(/\bapples?\b/) >= 0) {
    const j2 = JSON.parse(JSON.stringify(j));
    j2.source = j2.source.replace(/\bapple\b/g, 'pear');
    j2.source = j2.source.replace(/\bapples\b/g, 'pears');
    j2.target = j2.target.replace(/\bplise\b/g, 'perli');
    n = n.concat(j2);
  }
  if (j.source.search(/\bOsaka\b10/) >= 0) {
    const j2 = JSON.parse(JSON.stringify(j));
    j2.source = j2.source.replace(/\bOsaka\b/g, 'New York');
    j2.target = j2.target.replace(/\bosakan\b/g, 'nuiork');
    n = n.concat(j2);
  }
  if (j.source.search(/\bTokio\b/) >= 0) {
    const j2 = JSON.parse(JSON.stringify(j));
    j2.source = j2.source.replace(/\bTokio\b/g, 'New York');
    j2.target = j2.target.replace(/\btokios\b/g, 'nuiork');
    n = n.concat(j2);
  }
  return n;
}

function splitToChunks(array: DexieDictEntry[], parts: number) {
  let result = [];
  for (let i = parts; i > 0; i--) {
    result.push(array.splice(0, Math.ceil(array.length / i)));
  }
  return result;
}

function splitOutput(arr: DexieDictEntry[], outputDir: string) {
  const tegerna = 'muplis';

  splitToChunks(arr, 5).forEach((chunk, index) => {
    const outp = {
      formatName: 'dexie',
      formatVersion: 1,
      data: {
        databaseName: 'sorcu1',
        databaseVersion: 2,
        tables: [
          {
            name: 'valsi',
            schema: '++id, bangu, w, d, n, t, *s, g, *r, *cache, [r+bangu]',
            rowCount: chunk.length,
          },
        ],
        data: [
          {
            tableName: 'valsi',
            inbound: true,
            rows: chunk,
          },
        ],
      },
    };
    let pathBinDump = path.join(outputDir, `parsed-${tegerna}-${index}.bin`);
    fs.writeFileSync(path.join(outputDir, `parsed-${tegerna}-${index}.json`), JSON.stringify(outp));
    const brotli = require('brotli-wasm');
    fs.writeFileSync(pathBinDump, brotli.compress(Buffer.from(JSON.stringify(outp))));
  });
}
