// import * as tokenizers from './tokenizers/tokenizers_wasm.js';

// export class Tokenizer {
//   tokenizer: tokenizers.TokenizerWasm;
//   constructor(json: string) {
//     this.tokenizer = new tokenizers.TokenizerWasm(json);
//   }

//   static from_pretrained(name) {
//     return fetch(`https://huggingface.co/${name}/resolve/main/tokenizer.json`)
//       .then((response) => response.text())
//       .then((json) => new Tokenizer(json));
//   }

//   encode(text, add_special_tokens = false) {
//     return this.tokenizer.encode(text, add_special_tokens);
//   }
// }

// let tokenizer = await Tokenizer.from_pretrained('gpt2');
// let encoding = tokenizer.encode('I love AI and privacy', false);
// console.log(encoding.input_ids);

// let uint32Array = new Uint32Array([10, 20, 30, 40]);
// let arrayString = Array.from(uint32Array).join(",");
// console.log(arrayString); // "10,20,30,40"

// let retrievedString = "10,20,30,40"; // Assume this is retrieved from SQLite
// let retrievedArray = new Uint32Array(retrievedString.split(',').map(Number));
// console.log(retrievedArray); // Uint32Array [10, 20, 30, 40]

import { TextEmbeddingModel } from './inference/index.js';
import { preprocessDefinitionForVectors } from './utils/fns.js';

const modelMetadata = {
  id: 'mini-lm-v2-quant',
  title: 'Quantized mini model for sentence embeddings',
  encoderPath: './data/dumps/mini-lm-v2-quant.brotli',
  outputEncoderName: 'last_hidden_state',
  tokenizerPath: './data/dumps/mini-lm-v2-quant.tokenizer.brotli',
  padTokenID: 0,
  readmeUrl: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2',
};

export const model = await TextEmbeddingModel.create(modelMetadata);
let { vectors } = await model.infer([
  'apple',
  'I love apples',
  'I like apples',
  'Germans came to that city',
  'Philosophy of Decartes is considered by computers',
]);
// vectors = vectors.map((res) => res.map((res) => roundToDecimals(res, 64)));
// import similarity from 'compute-cosine-similarity';
// import { roundToDecimals } from './utils/fns.js';
// console.log(similarity(vectors[0]!, vectors[1]!));
// console.log(similarity(vectors[1]!, vectors[2]!));
// console.log(similarity(vectors[2]!, vectors[3]!));

//read file

import fs from 'fs-extra';
import { Sisku } from '@sutysisku/tokenizer/pkg/nodejs/sutysisku_tokenizer.js';
// import path from 'path';
const valsi = JSON.parse(fs.readFileSync('./data/parsed/parsed-muplis-processed.json', { encoding: 'utf8' }));
const keys = valsi.map((i: any) => i.w);
const vals = valsi.map((i: any) => ({
  title: i.w,
  embeddings: JSON.parse(i.ve).map((i: number) => i + Math.random() / 10000),
}));
const r = new Sisku({ embeddings: vals });
for (const vector of vectors) {
  console.log(r.search(new Float32Array(vector), 10));
}
