export function uniques<T>(array: T[]): T[] {
  return Array.from([...new Set(array)]) as T[];
}
