import { Bars3Icon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import getEnvironment from '../../getenvironment';
import { Text, Button, Flex, IconButton, useColorMode, } from '@chakra-ui/react';
import { loginPathFor } from '../../authRedirect';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import lmApi from '../../learningModule/api/lmApi';

function MoonIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function SunIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/* /learning/manual and every /learning/<thing>manual beside it — public by
   design, see the redirect below. Anchored at both ends so it cannot be
   widened by a path that merely contains the word, and kept at module scope so
   it is not a dependency of the effect that reads it. */
const LEARNING_MANUAL_PATH = /^\/learning\/[a-z]*manual$/;

export default function Navbar() {
  const { colorMode, toggleColorMode } = useColorMode();
  const [navbarOpen, setNavbarOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );

  const apiUrl = getEnvironment();

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: userDetails, isPending, isFetching, isError, error } = useQuery({
    queryKey: ['user', 'details'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/user/getuser/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const isAuthenticated = !!userDetails;

  // isPending is true ONLY when there is no cached data AND no cached error (true initial load)
  const isInitialLoad = isPending;
  // Wait for any active fetch to finish before assuming the user is not authenticated
  const isEvaluatingAuth = isPending || isFetching;

  useEffect(() => {
    if (isAuthenticated) {
      // Prefetch Learning Module data so it is instantly available when clicking 'Classes'
      queryClient.prefetchQuery({
        queryKey: ['learning', 'classes', 'active'],
        queryFn: () => lmApi.listClasses(),
        staleTime: 5 * 60 * 1000,
      });
      queryClient.prefetchQuery({
        queryKey: ['learning', 'classes', 'archived'],
        queryFn: () => lmApi.listClasses('archived'),
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [isAuthenticated, queryClient]);

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (isError && error?.message === 'Unauthorized') {
      queryClient.clear();
      localStorage.removeItem('token');
    }
  }, [isError, error, queryClient]);

  const handleLogout = async () => {
    try {
      const response = await fetch(`${apiUrl}/user/getuser/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      // Clear the cache so another user logging in doesn't see old data/errors
      queryClient.clear();
      localStorage.removeItem('token');

      if (!response.ok) {
        throw new Error('Failed to logout');
      }
      localStorage.removeItem('token');
      try {
        await SecureStoragePlugin.remove({ key: 'user_pin' });
        await SecureStoragePlugin.remove({ key: 'auth_token' });
      } catch (e) {
        console.error('Error removing secure storage on logout', e);
      }
      navigate('/login');
    } catch (error) {
      console.error('Error during logout:', error.message);
    }
  };

  const publicPaths = [
    '/',
    // Public: it is onboarding documentation someone needs before they have an
    // account, and GET /api/v1/guide is unauthenticated to match. Editing it
    // still requires an administrator. This entry and the server route have to
    // agree — listing it here while the API refuses anonymous readers would
    // render the page as a load error instead of a login redirect.
    '/guide',
    // The help desk. Public by necessity: the people it serves are the ones who
    // cannot sign in, so a redirect to /login here would bounce its whole
    // audience away from the page that exists to explain why they are stuck.
    // The page carries a gate of its own — an OTP mailed to the address being
    // asked about (a visitor who *is* signed in skips it), and every answer is
    // scoped to that address. See modules/helpdeskModule on the server.
    '/help',
    '/privacy',
    '/forgot-password',
    '/nirf',
    '/ams-manual',
    '/tt-manual',
    '/certificate-manual',
    '/conference-manual',
    '/login',
    '/classrooms',
    '/timetable',
    '/tt/masterdata',
    '/tt/commonslot',
    '/404',
    '/ml/t1',
  ];

  useEffect(() => {
    const isPublicPath =
      publicPaths.includes(location.pathname) ||
      location.pathname.startsWith('/services/') ||
      location.pathname.startsWith('/cm/c/') ||
      location.pathname.startsWith('/timetable/faculty/') ||
      // Joining and answering a live Short. Whether these need an account is a
      // per-deck setting the teacher controls, so the server decides; forcing a
      // login here would make the open decks impossible to reach.
      location.pathname.startsWith('/learning/short/join') ||
      location.pathname.startsWith('/learning/short/live/') ||
      location.pathname.startsWith('/learning/form/link/') ||
      // The learning module's teacher manuals. They are onboarding
      // documentation for staff who have not been given an account yet, which
      // is exactly who cannot get past this redirect — the routes were already
      // mounted outside LearningLayout so an anonymous reader would not be
      // bounced by its bootstrap fetch (see LearningRoutes.jsx), and this gate
      // undid that a layer higher up. Matched by shape rather than listed one
      // by one so a manual added later is public without a second edit here.
      LEARNING_MANUAL_PATH.test(location.pathname);

    if (!isEvaluatingAuth && !isAuthenticated && !isPublicPath) {
      // Replace, not push: the user never chose to visit the login page, so it
      // shouldn't sit in their history between the page they wanted and wherever
      // they came from.
      navigate(loginPathFor(location), { replace: true });
    } else if (
      !isEvaluatingAuth &&
      isAuthenticated &&
      !isPublicPath &&
      !location.pathname.startsWith('/learning') &&
      userDetails?.user?.role?.length === 1 &&
      userDetails?.user?.role?.[0]?.toLowerCase() === 'student'
    ) {
      navigate('/learning', { replace: true });
    }
  }, [isEvaluatingAuth, isAuthenticated, navigate, location, userDetails]);

  const excludedRoutes = ['/login', '/cm/c'];

  const isExcluded = excludedRoutes.some((route) =>
    location.pathname.startsWith(route)
  );

  // We only hide the Navbar on explicitly excluded routes
  if (isExcluded) {
    return null;
  }

  // The attendance (iLEED) module renders its own header below 768px, carrying
  // the drawer toggle, the wordmark and a logout button — stacking this bar on
  // top of it costs a third of a phone screen for links that duplicate what the
  // module already offers. Same breakpoint AMSLayout uses to switch to that header.
  if (isNarrow && location.pathname.startsWith('/attendance')) {
    return null;
  }

  // A student's whole surface is the learning module, whose own header carries
  // their name and the logout action. The platform bar links to modules they
  // cannot use, so they never see it — on any route, not just /learning.
  if (location.pathname.startsWith('/learning')) {
    return null;
  }

  return (
    <nav
      className={`tw-bg-gray-900 tw-sticky tw-h-15 tw-top-0  tw-border-gray-700 ${
        navbarOpen ? 'tw-h-screen' : ''
      }`}
      style={{ zIndex: 9999 }}
    >
      <div className="tw-max-w-screen-xl tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-mx-auto tw-p-4">
        <Link
          to="/home"
          className="tw-flex tw-items-center tw-space-x-3 rtl:tw-space-x-reverse"
        >
          <img src="/clublogo.png" className="tw-h-8" alt="Xceed Logo" />
          {/* <span class="tw-self-center tw-text-2xl tw-font-semibold tw-whitespace-nowrap dark:tw-text-white">Xceed</span> */}
        </Link>
        <button
          onClick={() => setNavbarOpen(!navbarOpen)}
          data-collapse-toggle="navbar-default"
          type="button"
          className="tw-inline-flex tw-items-center tw-p-2 tw-w-10 tw-h-10 tw-justify-center tw-text-sm tw-text-gray-500 tw-rounded-lg md:tw-hidden hover:tw-bg-gray-100 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-200 dark:tw-text-gray-400 dark:hover:tw-bg-gray-700 dark:focus:tw-ring-gray-600"
          aria-controls="navbar-default"
          aria-expanded="false"
        >
          <span className="tw-sr-only">Open main menu</span>
          <Bars3Icon className="tw-w-6 tw-h-6" />
        </button>
        <div
          className={clsx(
            'tw-w-full md:tw-block md:tw-w-auto',
            navbarOpen ? 'tw-block' : 'tw-hidden'
          )}
          id="navbar-default"
        >
          <ul className="tw-font-medium tw-flex tw-flex-col tw-items-center tw-p-4 md:tw-p-0 tw-mt-4 tw-border tw-rounded-lg tw-space-y-5 md:tw-space-y-0 md:tw-flex-row md:tw-space-x-8 rtl:tw-space-x-reverse md:tw-mt-0 md:tw-border-0 tw-bg-gray-900 tw-border-gray-700 tw-list-none">
            <li>
              <a
                href="/home"
                className="tw-block tw-py-2 tw-px-3 tw-text-cyan-300 tw-rounded md:tw-bg-transparent md:tw-text-cyan-300 md:tw-p-0 hover:tw-text-cyan-500"
                aria-current="page"
              >
                Home
              </a>
            </li>

            {isAuthenticated ? (
              <li>
                <a
                  href="/userroles"
                  className="tw-block tw-py-2 tw-px-3 tw-text-cyan-300 tw-rounded md:tw-bg-transparent md:tw-text-cyan-300 md:tw-p-0 hover:tw-text-cyan-500"
                  aria-current="page"
                >
                  Dashboard
                </a>
              </li>
            ) : null}
            <li>
              <a
                href="/#services"
                className="tw-block tw-py-2 tw-px-3 tw-text-white tw-rounded hover:tw-text-cyan-300 md:hover:tw-bg-transparent md:tw-border-0 md:hover:tw-text-cyan-600 md:tw-p-0 dark:tw-text-white md:dark:hover:tw-text-cyan-600 dark:hover:tw-bg-gray-700 md:dark:hover:tw-bg-transparent"
              >
                Services
              </a>
            </li>
            <li>
              <a
                href="/#about"
                className="tw-block tw-py-2 tw-px-3 tw-text-white tw-rounded hover:tw-text-cyan-300 md:hover:tw-bg-transparent md:tw-border-0 md:hover:tw-text-cyan-600 md:tw-p-0 dark:tw-text-white md:dark:hover:tw-text-cyan-600 dark:hover:tw-bg-gray-700 md:dark:hover:tw-bg-transparent"
              >
                About
              </a>
            </li>
            <li>
              <a
                href="/#team"
                className="tw-block tw-py-2 tw-px-3 tw-text-white tw-rounded hover:tw-text-cyan-300 md:hover:tw-bg-transparent md:tw-border-0 md:hover:tw-text-cyan-600 md:tw-p-0 dark:tw-text-white md:dark:hover:tw-text-cyan-600 dark:hover:tw-bg-gray-700 md:dark:hover:tw-bg-transparent"
              >
                Team
              </a>
            </li>
            {/* Before the Login button, and shown whether or not anybody is
                signed in: the people who need it most are the ones who cannot
                get past that button, and this is the only link on the bar they
                can follow while locked out. */}
            <li>
              <Link
                to="/help"
                className="tw-block tw-py-2 tw-px-3 tw-text-white tw-rounded hover:tw-text-cyan-300 md:hover:tw-bg-transparent md:tw-border-0 md:hover:tw-text-cyan-600 md:tw-p-0 dark:tw-text-white md:dark:hover:tw-text-cyan-600 dark:hover:tw-bg-gray-700 md:dark:hover:tw-bg-transparent"
              >
                Need help?
              </Link>
            </li>
            <li>
              {!isAuthenticated && !isInitialLoad ? (
                <Link
                  to="/login"
                  className="tw-text-white tw-bg-gradient-to-r tw-from-cyan-600 tw-to-cyan-500 hover:tw-bg-gradient-to-bl focus:tw-ring-4 focus:tw-outline-none focus:tw-ring-cyan-300 dark:focus:tw-ring-cyan-800 tw-font-bold tw-rounded-lg tw-text-sm tw-px-5 tw-py-2.5 tw-text-center"
                >
                  Login
                </Link>
              ) : null}
              {isAuthenticated && (
                <>
                  {userDetails && (
                    <Flex align="center" gap={2}>
                      <Text fontSize="sm" color="orange">
                        {userDetails.user.email}
                      </Text>

                      <IconButton
                        onClick={toggleColorMode}
                        variant="outline"
                        size="sm"
                        color="white"
                        borderColor="cyan.300"
                        aria-label={
                          colorMode === 'light'
                            ? 'Switch to dark mode'
                            : 'Switch to light mode'
                        }
                        title={colorMode === 'light' ? 'Dark mode' : 'Light mode'}
                        icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
                        _hover={{
                          bg: 'cyan.400',
                          color: 'gray.900',
                          borderColor: 'cyan.300',
                        }}
                        _active={{
                          bg: 'cyan.500',
                          color: 'gray.900',
                          borderColor: 'cyan.400',
                        }}
                        _focusVisible={{
                          boxShadow: '0 0 0 3px rgba(34, 211, 238, 0.45)',
                        }}
                      />

                      <Button
                        variant="outline"
                        size="sm"
                        color="white"
                        borderColor="cyan.300"
                        fontWeight="semibold"
                        _hover={{
                          bg: 'cyan.400',
                          color: 'gray.900',
                          borderColor: 'cyan.300',
                        }}
                        _active={{
                          bg: 'cyan.500',
                          color: 'gray.900',
                          borderColor: 'cyan.400',
                        }}
                        _focusVisible={{
                          boxShadow: '0 0 0 3px rgba(34, 211, 238, 0.45)',
                        }}
                        onClick={handleLogout}
                      >
                        Logout
                      </Button>
                    </Flex>
                  )}
                </>
              )}
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
