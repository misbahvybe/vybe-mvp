import { useCallback, useState } from 'react';

const DEFAULT_TOAST = 'Copied successfully';
const TOAST_MS = 2500;

/**
 * Copy text to the clipboard and surface a short toast (for IBAN, account #, etc.).
 */
export function useCopyToClipboard(toastText: string = DEFAULT_TOAST) {
  const [toast, setToast] = useState<string | null>(null);

  const copy = useCallback(
    (text: string) => {
      if (!text) return;
      void navigator.clipboard.writeText(text).then(() => {
        setToast(toastText);
        window.setTimeout(() => setToast(null), TOAST_MS);
      });
    },
    [toastText],
  );

  return { copy, toast, clearToast: () => setToast(null) };
}
