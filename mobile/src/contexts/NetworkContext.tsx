import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';

type NetworkContextValue = { isOffline: boolean; recheck: () => Promise<void> };

const NetworkContext = createContext<NetworkContextValue>({
  isOffline: false,
  recheck: async () => {},
});

function evaluateOffline(s: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  if (s.isConnected === false) return true;
  if (s.isInternetReachable === false) return true;
  return false;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);

  const recheck = useCallback(async () => {
    try {
      const s = await getNetworkStateAsync();
      setIsOffline(evaluateOffline(s));
    } catch {
      setIsOffline(true);
    }
  }, []);

  useEffect(() => {
    recheck();
    const sub = addNetworkStateListener((event) => {
      setIsOffline(evaluateOffline(event));
    });
    return () => sub.remove();
  }, [recheck]);

  return (
    <NetworkContext.Provider value={{ isOffline, recheck }}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
