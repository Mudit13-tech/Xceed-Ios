import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import getEnvironment from '../getenvironment';
import usePolling from './usePolling';

const apiUrl = getEnvironment();
export const HealthContext = createContext(null);

export function HealthProvider({ children }) {
  const [healthData, setHealthData] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);
  const [clientStatus, setClientStatus] = useState('checking');
  const [directMlStatus, setDirectMlStatus] = useState('unknown');

  // Fallback direct check for ML service when Node is offline
  const checkDirectML = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8500/health');
      setDirectMlStatus(res.ok ? 'online' : 'offline');
    } catch (err) {
      setDirectMlStatus('offline');
    }
  }, []);

  useEffect(() => {
    if (clientStatus !== 'offline') setDirectMlStatus('unknown');
  }, [clientStatus]);

  usePolling(checkDirectML, 5000, { enabled: clientStatus === 'offline' });

  useEffect(() => {
    const sse = new EventSource(`${apiUrl}/attendancemodule/health/stream`, { withCredentials: true });

    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setHealthData(data);
        setLastCheck(new Date().toLocaleTimeString());
        setClientStatus('online');
      } catch (err) {}
    };

    sse.onerror = () => {
      setClientStatus('offline');
    };

    return () => sse.close();
  }, []);

  return (
    <HealthContext.Provider value={{ healthData, lastCheck, clientStatus, directMlStatus }}>
      {children}
    </HealthContext.Provider>
  );
}

export const useHealth = () => useContext(HealthContext);
