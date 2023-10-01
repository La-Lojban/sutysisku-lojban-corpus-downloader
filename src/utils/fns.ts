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
