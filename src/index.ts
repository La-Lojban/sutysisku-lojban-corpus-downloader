import { getCLIArgs, updateXmlDumps } from './jbovlaste.js';

const args: string[] = getCLIArgs();

updateXmlDumps(args).then(() => {
  process.exit();
});
