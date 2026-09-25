import { useQuery } from '@tanstack/react-query';
import getEnvironment from '../getenvironment';

/**
 * The signed-in account as `/user/getuser/` returns it, under the same
 * `['user', 'details']` key the Navbar reads — so every caller shares one
 * request and one cache entry, and a save that updates the entry updates
 * every screen showing it.
 *
 * Returns the query; `user` is `data.user`, or null when nobody is signed in.
 */
export default function useUserDetails() {
  const apiUrl = getEnvironment();
  const query = useQuery({
    queryKey: ['user', 'details'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/user/getuser/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (response.status === 401) throw new Error('Unauthorized');
      if (!response.ok) throw new Error('Failed to fetch user details');
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  return { ...query, user: query.isError ? null : query.data?.user || null };
}
