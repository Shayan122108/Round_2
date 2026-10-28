/** Trusted metric computation. Operates only on integer arrays; never on untrusted code or files. */
export interface Metrics {
  accuracy: number;
  precision: number; // macro
  recall: number; // macro
  f1: number; // macro
  correct: number;
  total: number;
}

export function computeMetrics(yTrue: number[], yPred: number[]): Metrics {
  if (yTrue.length !== yPred.length || yTrue.length === 0) throw new Error('length mismatch');
  const classes = new Set<number>([...yTrue, ...yPred]);
  let correct = 0;
  const tp = new Map<number, number>(), fp = new Map<number, number>(), fn = new Map<number, number>();
  for (const c of classes) { tp.set(c, 0); fp.set(c, 0); fn.set(c, 0); }
  for (let i = 0; i < yTrue.length; i++) {
    const t = yTrue[i]!, p = yPred[i]!;
    if (t === p) { correct++; tp.set(t, tp.get(t)! + 1); }
    else { fn.set(t, fn.get(t)! + 1); fp.set(p, fp.get(p)! + 1); }
  }
  let sp = 0, sr = 0, sf = 0;
  for (const c of classes) {
    const a = tp.get(c)!, b = fp.get(c)!, d = fn.get(c)!;
    const pr = a + b > 0 ? a / (a + b) : 0;
    const rc = a + d > 0 ? a / (a + d) : 0;
    sp += pr; sr += rc; sf += pr + rc > 0 ? (2 * pr * rc) / (pr + rc) : 0;
  }
  const n = classes.size;
  const r4 = (x: number) => Math.round(x * 10000) / 10000;
  return { accuracy: r4(correct / yTrue.length), precision: r4(sp / n), recall: r4(sr / n), f1: r4(sf / n), correct, total: yTrue.length };
}

export function parseLabelsCsv(content: string): { ids: string[]; labels: number[] } {
  const lines = content.trim().split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0]!.split(',').map((h) => h.trim());
  const idIdx = header.indexOf('id'), yIdx = header.indexOf('correct_prediction');
  if (idIdx < 0 || yIdx < 0) throw new Error('labels file must have id,correct_prediction');
  const ids: string[] = [], labels: number[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    ids.push(cols[idIdx]!.trim());
    labels.push(parseInt(cols[yIdx]!, 10));
  }
  return { ids, labels };
}

