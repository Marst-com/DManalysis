import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const SiteContext = createContext(null);

export function SiteProvider({ children }) {
  const [sites, setSites] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSites = async () => {
    try {
      const res = await api.get('/sites');
      const list = res.sites || [];
      setSites(list);
      if (list.length && !current) setCurrent(list[0]);
    } catch {
      // handled by auth context
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSites(); }, []);

  return (
    <SiteContext.Provider value={{ sites, current, setCurrent, loading, reload: loadSites }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be inside SiteProvider');
  return ctx;
}
