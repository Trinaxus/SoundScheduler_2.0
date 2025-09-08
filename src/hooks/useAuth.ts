import { useEffect, useState } from 'react';
import { me } from '../lib/api';

export function useAuth() {
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [role, setRole] = useState<'admin' | 'remote' | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await me() as any;
        if (!cancelled) {
          setAuthenticated(!!res.authenticated);
          setRole((res.role as 'admin' | 'remote' | null) ?? null);
        }
      } catch {
        if (!cancelled) setAuthenticated(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    check();

    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { authenticated, role, loading };
}