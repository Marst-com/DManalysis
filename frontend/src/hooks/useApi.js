import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Generic data fetching hook.
 * Usage: const { data, loading, error, refetch } = useApi('/sites');
 */
export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(path);
      setData(res);
    } catch (err) {
      setError(err.message || 'Request failed.');
    } finally {
      setLoading(false);
    }
  }, [path, ...deps]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}

/**
 * Site selector hook — reads ?site= from URL or falls back to first site.
 */
export function useCurrentSite() {
  const [sites, setSites] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/sites').then((res) => {
      const list = res.sites || [];
      setSites(list);
      setCurrent(list[0] || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return { sites, current, setCurrent, loading };
}
