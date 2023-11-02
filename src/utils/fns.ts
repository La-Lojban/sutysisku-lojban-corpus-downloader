export function uniques<T>(array: T[]): T[] {
  return Array.from([...new Set(array)]) as T[];
}

function timeout<T>(ms: number, error: T): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(error), ms));
}

export function retryPromise<T>(
  promiseFn: () => Promise<T>,
  maxRetries: number = 5,
  delay: number = 2000,
  timeoutDuration: number = 5000,
): Promise<T> {
  let retries = 0;

  const attempt = (): Promise<T> => {
    return new Promise((resolve, reject) => {
      Promise.race([promiseFn(), timeout(timeoutDuration, 'Promise timeout') as Promise<any>])
        .then(resolve)
        .catch((err) => {
          if (retries++ >= maxRetries) {
            reject(err);
          } else {
            setTimeout(() => attempt().then(resolve).catch(reject), Math.pow(2, retries) * delay);
          }
        });
    });
  };

  return attempt();
}

export function canonicalizeValsi(valsi: string) {
  if (/^[aeiouy]/.test(valsi)) valsi = '.' + valsi;
  if (/y$/.test(valsi) && valsi.indexOf('.') !== 0) valsi = valsi + '.';
  if (/[^aeiouy]$/.test(valsi)) valsi = '.' + valsi + '.';
  return valsi.replace(/\.\./g, '.');
}

const handleArrayPart = async <T>(part: T[], fn: (item: T) => void): Promise<void[]> => {
  return await Promise.all(part.map((item) => fn(item)));
};

export const splitArray = <T>(arr: T[], n: number): T[][] => {
  let result: T[][] = [];
  let i: number, j: number;
  for (i = 0, j = arr.length; i < j; i += n) {
    result.push(arr.slice(i, i + n));
  }
  return result;
};

export const handleArray = async <T>(arr: T[], numberPartitions: number, fn: (item: T) => void): Promise<void[]> => {
  const parts = splitArray<T>(arr, numberPartitions);
  let result: void[] = [];
  for (const part of parts) {
    result = result.concat(await handleArrayPart<T>(part, fn));
  }
  return result;
};

export const preprocessDefinitionForVectors = (def: string): string => {
  return def
    .replace(/\$.*?\$/g, '[UNK]')
    .replace(/\{.*?\}/g, '[UNK]')
    .replace(/ {2,}/g, ' ')
    .replace(/[\.,] ?[\.,]/g, '.')
    .replace(/[,\. ]+$/, '')
    .replace(/^[,\. ]+/, '');
};

export function roundToDecimals(number: number, trunc = 8, restoreDimension = true): number {
  if (!restoreDimension) return Math.round(number * 10 ** trunc);
  return Math.round(number * 10 ** trunc) / 10 ** trunc;
}
