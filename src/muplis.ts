import dotenv from 'dotenv';
dotenv.config();

import lojban from 'lojban';
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
import winston, { format } from 'winston';
import { canonicalizeValsi, retryPromise } from './utils/fns.js';
const logger = winston.createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

if (
  !process.env.GOOGLE_READONLY_API_KEY ||
  !process.env.GOOGLE_CORPUS_DOC_ID ||
  !process.env.GOOGLE_XRASTE_DOC_SHEET_ID
) {
  logger.error(
    'muplis update cancelled, no GOOGLE_READONLY_API_KEY or GOOGLE_CORPUS_DOC_ID or GOOGLE_XRASTE_DOC_SHEET_ID specified',
  );
  process.exit();
}

type Example = {
  source: string;
  source_opt?: string;
  target: string;
  target_opt?: string;
  tags: string[];
};

type Dict = {
  [key: string]: any;
};

const doc = new GoogleSpreadsheet(process.env.GOOGLE_CORPUS_DOC_ID);
doc.useApiKey(process.env.GOOGLE_READONLY_API_KEY);

function arrayToJSON(arr: Example[]): Dict {
  const result: Dict = {};
  arr.forEach((subArray) => {
    result[subArray.source] = subArray.target;
  });
  return result;
}

export async function generateXraste() {
  logger.info(`generating xraste dictionary ...`);
  try {
    await doc.loadInfo();
  } catch (error) {
    console.error('loading error', (error as Error).message);
  }

  try {
    const sheet = doc.sheetsById[process.env.GOOGLE_XRASTE_DOC_SHEET_ID as any];
    if (!sheet) {
      logger.error(`Sheet ${process.env.GOOGLE_XRASTE_DOC_SHEET_ID} not found`);
      process.exit();
    }
    logger.info(`fetching live xraste rows ...`);
    const rows = (await retryPromise(() => sheet?.getRows() ?? Promise.resolve([]), 5, 1000, 5 * 60 * 1000))
      .map((row: GoogleSpreadsheetRow) => {
        const source = row._rawData[0];
        const targets = row._rawData
          .slice(1)
          .filter((str: string) => RegExp('^.+.(jpe?g|png|gif|svg)$', 'i').test(str))
          .map((i: string) => ({ source, target: i, tags: [] } as Example));
        return targets;
      })
      .flat();
    const deksi = createDexieCacheFile(rows, { simpleCache: true });
    return { deksi, full: arrayToJSON(rows) };
  } catch (error) {
    console.error((error as Error).message);
    return;
  }
}

export async function generate() {
  logger.info(`generating muplis dictionary ...`);
  await doc.loadInfo();
  const sheet = doc.sheetsById[process.env.GOOGLE_CORPUS_DOC_SHEET_ID as any];
  if (!sheet) {
    logger.error(`Sheet ${process.env.GOOGLE_CORPUS_DOC_SHEET_ID} not found`);
    process.exit();
  }
  logger.info(`fetching live muplis rows ...`);
  const rows = await retryPromise(() => sheet?.getRows() ?? Promise.resolve([]), 5, 1000, 5 * 60 * 1000);
  // const rows = (await sheet?.getRows()) ?? [];

  let output = {
    en2jb: [] as Example[],
    jb2en: [] as Example[],
  };

  logger.info(`processing live muplis rows ...`);
  try {
    const { jb2en, en2jb } = processRows(rows);
    output.jb2en = output.jb2en.concat(jb2en);
    output.en2jb = output.en2jb.concat(en2jb);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.warn(error);
    }
  }

  logger.info(`generating muplis dictionaries...`);
  return {
    deksi: createDexieCacheFile(output.jb2en),
    tsv: {
      jb2en: output.jb2en
        .map((i) => `${i.source}\t${i.target}\t${i.tags.join(' ')}`)
        .join('\n')
        .replace(/[\r\n]{2,}/g, '\n'),
      en2jb: output.en2jb
        .map((i) => `${i.source}\t${i.target}\t${i.tags.join(' ')}`)
        .join('\n')
        .replace(/[\r\n]{2,}/g, '\n'),
    },
  };
}

export function createDexieCacheFile(arr: Example[], options?: Dict): Dict[] {
  return arr.map((i) => {
    if (!options?.simpleCache) {
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
      const cache3 = cache1.concat(cache2);
      const cache4 = [...new Set(cache3)];
      const outRow: any = { w: i.source, d: i.target, cache: cache4 };
      if (i.tags.length > 0) outRow.s = [...new Set(i.tags)];
      return outRow;
    } else {
      const outRow: any = { w: i.source, d: i.target, cache: [i.source] };
      if (i.tags.length > 0) outRow.s = [...new Set(i.tags)];
      return outRow;
    }
  });
}

function convertTagLine2Array(line = '') {
  return line.replace(/[,;]/g, ' ').split(' ').filter(Boolean);
}

function processRows(rows: GoogleSpreadsheetRow[]) {
  let n: Example[] = [];
  for (const r of rows) {
    if (r._rowNumber % 1000 === 0) logger.info(`Muplis: processing row ${r._rowNumber}`);
    let j: Example;
    const tags = ["gleki's tags", "Ilmen's tags", "uakci's optional new tags"]
      .map((i) => convertTagLine2Array(r[i]))
      .flat();

    j = {
      source: r['Tatoeba: English'] || '',
      target:
        r["gleki's alternative proposal"] ||
        r["Ilmen's alternative proposal"] ||
        r["uakci's revision"] ||
        r['jelca proposal'] ||
        r['Tatoeba: Lojban'] ||
        '',
      tags,
    };

    if (
      (tags.indexOf('B') >= 0 && j.target === r['Tatoeba: Lojban']) ||
      (r['Tatoeba: Lojban'] || '') === '' ||
      (r['Tatoeba: English'] || '') === ''
    )
      continue;
    j.target = lojban.preprocessing(j.target.toLowerCase());

    try {
      const parsed = lojban.romoi_lahi_cmaxes(lojban.zeizei(j.target.replace(/ĭ/g, 'i').replace(/ŭ/g, 'u')));
      if (parsed.tcini === 'snada')
        j.target_opt = parsed.kampu
          .filter((i) => i[0] !== 'drata')
          .map((i) => i[1].replace(/-/g, ''))
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
          .filter((i: any) => i[0] !== 'drata')
          .map((i: any) => canonicalizeValsi(i[1]))
          .join(' ')
          .replace(/-/g, '');
        if (j.target_opt && !j.target.split(' ').includes('zei'))
          j.target_opt = j.target_opt
            .split(' ')
            .filter((i) => i !== 'zei')
            .join(' ');
      } catch (error) {
        logger.error('Muplis: processing rows: ' + error);
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
    r.tags = r.tags.map((i) => {
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
    });
    const outRow = {
      source: r.target,
      source_opt: r.target_opt,
      target: r.source,
      tags: r.tags,
    };
    return outRow;
  });
  jb2en = [...new Set(jb2en.map((el) => JSON.stringify(el)))].map((el) => JSON.parse(el));

  return { jb2en, en2jb };
}

function duplicator({ n, j }: { n: Example[]; j: Example }) {
  j.target = j.target
    .replace(/\bmeris\b/g, 'maris')
    .replace(/\btokion\b/g, 'tokios')
    .replace(/\ble\b/g, 'lo')
    .replace(/\blei\b/g, 'loi');
  n.push(j);
  if (j.source.search(/\bTom\b/) >= 0) {
    let j2 = JSON.parse(JSON.stringify(j));
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
    let j2 = JSON.parse(JSON.stringify(j));
    j2.source = j2.source.replace(/\bapple\b/g, 'pear');
    j2.source = j2.source.replace(/\bapples\b/g, 'pears');
    j2.target = j2.target.replace(/\bplise\b/g, 'perli');
    n = n.concat(j2);
  }
  if (j.source.search(/\bOsaka\b/) >= 0) {
    let j2 = JSON.parse(JSON.stringify(j));
    j2.source = j2.source.replace(/\bOsaka\b/g, 'New York');
    j2.target = j2.target.replace(/\bosakan\b/g, 'nuiork');
    n = n.concat(j2);
  }
  if (j.source.search(/\bTokio\b/) >= 0) {
    let j2 = JSON.parse(JSON.stringify(j));
    j2.source = j2.source.replace(/\bTokio\b/g, 'New York');
    j2.target = j2.target.replace(/\btokios\b/g, 'nuiork');
    n = n.concat(j2);
  }
  return n;
}
