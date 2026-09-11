/**
 * Run a request with a hedge: if the first attempt hasn't answered after
 * `hedgeAfter` ms (or fails fast), start one duplicate; the first non-null
 * answer wins and the other is aborted. Gives up after `timeout` ms.
 * For free model APIs whose latency has a long tail (most answers < 1.5 s,
 * a few stall for 15 s).
 */
export function hedged<T>(
  attempt: (signal: AbortSignal) => Promise<T | null>,
  { hedgeAfter, timeout, signal }: { hedgeAfter: number; timeout: number; signal?: AbortSignal },
): Promise<T | null> {
  return new Promise((resolve) => {
    const ctrls: AbortController[] = [];
    let settled = false;
    let launched = 0;
    let pending = 0;
    const finish = (v: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(overall);
      clearTimeout(hedge);
      ctrls.forEach((c) => c.abort());
      resolve(v);
    };
    const launch = () => {
      if (settled || launched >= 2) return;
      launched++;
      pending++;
      const c = new AbortController();
      ctrls.push(c);
      attempt(c.signal)
        .catch(() => null)
        .then((v) => {
          pending--;
          if (v !== null) return finish(v);
          if (launched < 2) return launch(); // failed fast: hedge now
          if (pending === 0) finish(null);
        });
    };
    const overall = setTimeout(() => finish(null), timeout);
    const hedge = setTimeout(launch, hedgeAfter);
    signal?.addEventListener("abort", () => finish(null), { once: true });
    launch();
  });
}
