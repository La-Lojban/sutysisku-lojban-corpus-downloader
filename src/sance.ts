import dotenv from 'dotenv';
dotenv.config();
import winston, { format } from 'winston';

import { Polly, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import fs from 'fs-extra';
import streamToArray from 'stream-to-array';
import { Readable } from 'stream';
import { lojban2ipaPolly } from './lojban2ipa.js';
import axios from 'axios';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { handleArray, retryPromise } from './utils/fns.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const repoName = process.env.THIS_REPO_NAME;

// import lojban from 'lojban';
// import { retryPromise } from './utils/fns.js';
const logger = winston.createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

if (!process.env.AWS_ACCESS_KEY || !process.env.AWS_SECRET_KEY) {
  logger.error('sounds update cancelled, no AWS_ACCESS_KEY or AWS_SECRET_KEY specified');
  process.exit();
}

const polly = new Polly({
  region: 'us-east-1',
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY, secretAccessKey: process.env.AWS_SECRET_KEY },
});

async function downloadFromPolly(sentence: string, outputFilePath: string): Promise<boolean> {
  if (!sentence) return false;
  const ipaText = lojban2ipaPolly(sentence);
  if (!ipaText) return false;
  let params = {
    Text: ipaText,
    OutputFormat: 'ogg_vorbis',
    VoiceId: 'Vicki',
    Engine: 'neural',
    TextType: 'ssml',
    LanguageCode: 'de-DE',
  };
  const response = await polly.send(new SynthesizeSpeechCommand(params));
  if (response.AudioStream) {
    const array = await streamToArray(response.AudioStream as Readable);
    const audioBuffer = Buffer.concat(array.map((part) => Buffer.from(part)));
    fs.outputFileSync(outputFilePath, audioBuffer);
    return true;
  }
  return false;
}

function convertText2Filename(text: string) {
  return text.replace(/ /g, '_').replace(/\./g, '').substring(0, 250);
}

async function downloadAudioFileFromMyRepo(convertedText: string, outputFilePath: string): Promise<boolean> {
  const url = `https://raw.githubusercontent.com/${repoName}/gh-pages/data/sance/${convertedText}.ogg?raw=true`;
  try {
    const buffer = (
      await axios.get(url, {
        responseType: 'arraybuffer',
      })
    ).data;
    fs.outputFileSync(outputFilePath, buffer);
    return true;
  } catch (error) {
    return false;
  }
}

async function checkFileExists(file: string): Promise<boolean> {
  return fs.promises
    .access(file, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

export async function processWords(sentences: string[]) {
  logger.info('generating audio dictionary...');

  await handleArray(sentences, 2, processWord).catch((error) => {
    logger.error(error);
  });
  // for (const sentence of sentences) {
  //   await processWord(sentence);
  // }
}

async function processWord(sentence: string): Promise<void> {
  logger.info(`getting audio for "${sentence}"`);
  const convertedText = convertText2Filename(sentence);
  const outputFilePath = join(__dirname, `../data/sance/${convertedText}.ogg`);
  let success: boolean;

  // logger.info(`getting audio for "${sentence}": checking existing files`);
  success = await checkFileExists(outputFilePath);
  if (success) return;

  // logger.info(`getting audio for "${sentence}": checking in the repo`);
  success = await retryPromise(() => downloadAudioFileFromMyRepo(convertedText, outputFilePath), 5, 2000, 15000);
  if (success) return;

  logger.info(`getting audio for "${sentence}": generating via Polly`);
  success = await retryPromise(() => downloadFromPolly(sentence, outputFilePath), 5, 2000, 15000);
  if (success) return;

  if (!success) logger.error(`${sentence}: not downloaded`);
}
