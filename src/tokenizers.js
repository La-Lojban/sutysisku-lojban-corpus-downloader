import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';

import pkg from '@piercefreeman/brotli-compress';
const { compress, decompress } = pkg;

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const url = `https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json`;
function typedArrayToBuffer(array) {
  return array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset)
}

(async () => {
  const response = await axios({
    method: 'get',
    url,
    responseType: 'text',
  });
  const data = response.data;
  //   console.log(data);
  const name = url.split('/').slice(-1)[0];
  const compressed = await compress(Buffer.from(JSON.stringify(data)));
  fs.outputFileSync(path.join(__dirname, `../data/parsed/${name}.brotli`), compressed, { encoding: 'utf8' });
  let blob = await decompress(Buffer.from(compressed));
  blob = Buffer.from(typedArrayToBuffer(blob));
  blob = JSON.parse(blob);

  fs.outputFileSync(path.join(__dirname, `../data/${name}`), blob, { encoding: 'utf8' });


})();
