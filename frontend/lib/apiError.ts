/**
 * Normalize NestJS / axios errors for UI. ValidationPipe often returns `message` as string[].
 */
export function getApiErrorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const err = e as {
    response?: { data?: { message?: unknown; error?: string } };
    message?: string;
  };
  const m = err?.response?.data?.message;
  if (typeof m === 'string' && m.trim()) return m;
  if (Array.isArray(m) && m.length > 0) {
    return m.map((x) => String(x)).join(' ');
  }
  if (m != null && typeof m === 'object') {
    try {
      const s = JSON.stringify(m);
      if (s !== '{}') return s;
    } catch {
      /* ignore */
    }
  }
  const errStr = err?.response?.data?.error;
  if (typeof errStr === 'string' && errStr.trim()) return errStr;
  if (err?.message && typeof err.message === 'string' && err.message !== 'Network Error') {
    return err.message;
  }
  if (
    typeof err?.message === 'string' &&
    err.message === 'Network Error' &&
    err?.response == null
  ) {
    return 'Network error — check your connection and that the API URL is correct.';
  }
  return fallback;
}
