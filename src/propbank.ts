//downloads a propbank dump and converts it to sutysisku's dexie-like format

import fastXMLParser from 'fast-xml-parser';
import he from 'he';
import axios from 'axios';

import * as fs from 'fs';
import * as path from 'path';

import extract from 'extract-zip';

import * as stream from 'stream';
import { promisify } from 'util';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { getCLIArgs } from './jbovlaste.js';
const args: string[] = getCLIArgs();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const finished = promisify(stream.finished);

interface DictExample {
  text: string;
  annotation: string;
  comment: string;
}

interface DictEntry {
  w: string;
  d: string;
  g: string[];
  n?: string;
  subtitle?: string;
  s?: string;
  e: DictExample[];
}

function arrayify(arg: any) {
  if (Array.isArray(arg)) return arg ?? [];
  if (typeof arg === 'undefined') return [];
  return [arg];
}

function incSlot(slot: string) {
  slot = slot.replace(/^ARG/, '');
  if (!isNaN(Number(slot))) return 'x_' + (parseInt(slot) + 1);
  return slot;
}

function replaceArg(text = '', digitWords = false) {
  let output = text.replace(/\barg([0-9]+)\b/gi, (_match: string, p1: string) => {
    return `$${incSlot(p1)}$`;
  });
  if (digitWords)
    output = output.replace(/\b([0-9]+)\b/gi, (_match: string, p1: string) => {
      return `$${incSlot(p1)}$`;
    });
  return output;
}

export async function downloadFile(fileUrl: string, outputLocationPath: string): Promise<any> {
  const writer = fs.createWriteStream(outputLocationPath);
  return axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  }).then((response) => {
    response.data.pipe(writer);
    return finished(writer); //this is a Promise
  });
}

async function download({ tmpDir, url }: { tmpDir: string; url: string }): Promise<{ [key: string]: DictEntry }> {
  const propbankZip = path.join(tmpDir, 'propbank.zip');
  const propbankPath = path.join(tmpDir, 'propbank');
  const propbankPathFrames = path.join(tmpDir, 'propbank', 'propbank-frames-main', 'frames');
  if (args.includes('download')) {
    await downloadFile(url, propbankZip);
    await extract(propbankZip, { dir: propbankPath });
  }

  const dictionaryEntries: { [key: string]: DictEntry } = {};

  const frames = fs.readdirSync(propbankPathFrames);

  frames.forEach((file: string) => {
    const data = fs.readFileSync(path.join(propbankPathFrames, file), { encoding: 'utf8' });
    const json = fastXMLParser.parse(data, {
      attributeNamePrefix: '',
      ignoreAttributes: false,
      allowBooleanAttributes: false,
      parseNodeValue: false,
      parseAttributeValue: false,
      attrValueProcessor: (a) => he.decode(a, { isAttributeValue: true }),
      tagValueProcessor: (a) => he.decode(a),
    });

    arrayify(json?.frameset).forEach(({ predicate }: { predicate: any }) => {
      arrayify(predicate?.roleset).forEach((entry: any) => {
        // console.log(JSON.stringify(entry, null, 2));
        const id = entry.id;
        const words = arrayify(entry.aliases.alias).map(
          (el: { '#text': string; pos: string }) => `${el['#text']}; ${el.pos}`,
        );
        const dictEntry: DictEntry = {
          //   id,
          w: entry.name.replace(/_/g, ' '),
          //   subtitle: entry?.aliases?.alias?.['#attributes']?.framenet,
          //   s: entry?.aliases?.alias?.['#attributes']?.pos,
          g: words,
          d: arrayify(entry.roles?.role)
            .map((slot: any) => `$${incSlot(slot.n)}$: ${replaceArg(slot?.descr)}`)
            .join('; '),
          e: arrayify(entry?.example).map((example: any) => {
            return {
              text: example.text,
              comment: replaceArg(example.name, true),
              annotation: arrayify(example.propbank?.arg)
                .map((annotation: any) => {
                  return `$${incSlot(annotation.type)}$: ${annotation['#text']}`;
                })
                .join('; '),
            };
          }),
        };
        dictionaryEntries[id] = dictEntry;
      });
    });
  });
  return dictionaryEntries;
}

export async function saveDump({
  outputDir = path.join(__dirname, '../data/dumps'),
  tmpDir = '/tmp',
  url = 'https://github.com/propbank/propbank-frames/archive/refs/heads/main.zip',
}) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  const dictionaryEntries = await download({ tmpDir, url });
  // if (args.includes('download')) {
  //   fs.rmSync(tmpDir, { recursive: true, force: true });
  // }
  fs.writeFileSync(path.join(outputDir, 'propbank.json'), JSON.stringify(dictionaryEntries, null, '\t'));
}

saveDump({});
