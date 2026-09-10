import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Icon,
  SimpleGrid,
  Spinner,
  Text,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import {
  FiAward,
  FiBookOpen,
  FiCalendar,
  FiMic,
  FiShield,
  FiUser,
  FiUserCheck,
  FiUsers,
} from 'react-icons/fi';
import getEnvironment from '../getenvironment';
import {
  EXCLUDED_ROLES,
  singleRoleTarget,
} from '../authRedirect';

const apiUrl = getEnvironment();

const ROLE_META = {
  ITTC: {
    name: 'Institute Time Table Coordinator',
    description: 'Manage institute-wide timetables',
    icon: FiCalendar,
    accent: 'blue',
  },
  DTTI: {
    name: 'Department Time Table Coordinator',
    description: 'Manage department timetables',
    icon: FiCalendar,
    accent: 'blue',
  },
  CM: {
    name: 'Event Certificate Manager',
    description: 'Create and manage certificates',
    icon: FiAward,
    accent: 'green',
  },
  admin: {
    name: 'XCEED Super User',
    description: 'Full system administration',
    icon: FiShield,
    accent: 'red',
  },
  EO: {
    name: 'Event Organiser',
    description: 'Organize and manage events',
    icon: FiMic,
    accent: 'purple',
  },
  FACULTY: {
    name: 'Faculty',
    description: 'Your classes and coursework',
    icon: FiUser,
    accent: 'orange',
  },
  'iams-admin': {
    name: 'iLEED Admin',
    description: 'Manage face recognition attendance system',
    icon: FiUserCheck,
    accent: 'cyan',
  },
  'iams-dept-admin': {
    name: 'iLEED Department Admin',
    description: 'Department-level attendance management',
    icon: FiUserCheck,
    accent: 'cyan',
  },
  // Synthetic, like the two learning-* entries below: an HOD holds one platform
  // role but has two dashboards, and the HOD card already points at the
  // Learning module's. Appended for anyone with the HOD role so the attendance
  // view is reachable without a second stored role.
  'ileed-hod': {
    name: 'iLEED Dashboard',
    description: "Your department's attendance, live classrooms and reports",
    icon: FiUserCheck,
    accent: 'cyan',
  },
  STUDENT: {
    name: 'Student',
    description: 'Your classes, coursework and tutorials',
    icon: FiBookOpen,
    accent: 'teal',
  },
  // Named for the module, not the post. Every other card here names a role
  // because the role is what distinguishes it, but a head holds exactly one
  // card per module they can reach — so "Head of Department" told them their
  // own job title and not where the card goes. The Dean card below is left
  // naming the post: the dean's card is institute-wide and has no module of
  // its own to name.
  HOD: {
    name: 'Xceed Learning',
    description: "Your department's classrooms, faculty and student counts",
    icon: FiUsers,
    accent: 'blue',
  },
  DEAN: {
    name: 'Dean (Academic)',
    description: 'Every department: classrooms, faculty, coursework and student activity',
    icon: FiUsers,
    accent: 'purple',
  },
  'lm-admin': {
    name: 'Learning Module Admin',
    description: 'Bug reports, feedback and usage stats for the Learning module',
    icon: FiShield,
    accent: 'purple',
  },
  // Synthetic entries: not platform roles, but the standing a user holds
  // inside the Learning module. Appended only when they actually have classes,
  // so they never displace a real role or the single-role auto-redirect.
  'learning-teacher': {
    name: 'Learning — Teacher',
    description: 'Classes you teach',
    icon: FiBookOpen,
    accent: 'teal',
  },
  'learning-student': {
    name: 'Learning — Student',
    description: 'Classes you are enrolled in',
    icon: FiBookOpen,
    accent: 'teal',
  },
};

const roleMeta = (role) =>
  ROLE_META[role] || {
    name: role,
    description: 'Access your dashboard',
    icon: FiUser,
    accent: 'gray',
  };

const RoleItem = ({ role, index, onOpen, descriptionOverride }) => {
  const meta = roleMeta(role);
  const { name, accent } = meta;
  const description = descriptionOverride || meta.description;
  const cardBg = useColorModeValue(`${accent}.50`, `${accent}.900`);
  const cardBorder = useColorModeValue(`${accent}.100`, `${accent}.700`);
  const hoverBg = useColorModeValue(`${accent}.100`, `${accent}.800`);
  const hoverBorder = useColorModeValue(`${accent}.400`, `${accent}.500`);
  const descColor = useColorModeValue('gray.600', 'gray.300');
  const nameColor = useColorModeValue('gray.800', 'white');
  const numColor = useColorModeValue(`${accent}.500`, `${accent}.300`);

  return (
    <Flex
      as="button"
      onClick={onOpen}
      role="group"
      direction="column"
      textAlign="left"
      h="full"
      bg={cardBg}
      borderWidth="1px"
      borderColor={cardBorder}
      borderRadius="2xl"
      p={{ base: 5, md: 6 }}
      transition="all 0.2s ease"
      _hover={{
        bg: hoverBg,
        borderColor: hoverBorder,
        transform: 'translateY(-4px)',
        boxShadow: 'lg',
      }}
      _focusVisible={{ boxShadow: 'outline' }}
    >
      <Flex align="center" justify="space-between" w="full" mb={{ base: 4, md: 5 }}>
        <Text
          fontSize={{ base: '3xl', md: '4xl' }}
          fontWeight="extrabold"
          fontFamily="mono"
          lineHeight="1"
          color={numColor}
        >
          {String(index + 1).padStart(2, '0')}
        </Text>
        <Box
          as="span"
          aria-hidden="true"
          fontSize={{ base: '2xl', md: '3xl' }}
          lineHeight="1"
          color={numColor}
          opacity={0}
          transform="translateX(-10px)"
          transition="all 0.2s ease"
          _groupHover={{ opacity: 1, transform: 'translateX(0)' }}
        >
          &rarr;
        </Box>
      </Flex>
      <Heading
        as="h3"
        fontSize={{ base: 'lg', md: 'xl' }}
        lineHeight="1.3"
        mb={2}
        color={nameColor}
      >
        {name}
      </Heading>
      <Text fontSize={{ base: 'sm', md: 'md' }} color={descColor} lineHeight="1.5">
        {description}
      </Text>
    </Flex>
  );
};

const AllocatedRolesPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [allocatedRoles, setAllocatedRoles] = useState([]);
  const [learningCards, setLearningCards] = useState([]);
  const [extraCards, setExtraCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishOTA = async () => {
    setIsPublishing(true);

    try {
      const response = await fetch(`${apiUrl}/api/v1/ota/trigger-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        alert("Sync & OTA Update Triggered Successfully! The process is running on GitHub.");
      } else {
        const data = await response.json().catch(() => ({}));
        alert(`Failed to trigger update: ${data.error || 'Please check console for errors.'}`);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    } finally {
      setIsPublishing(false);
    }
  };

  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const subColor = useColorModeValue('gray.500', 'gray.400');
  const emptyCardBg = useColorModeValue('white', 'gray.800');
  const emptyCardBorder = useColorModeValue('gray.100', 'gray.700');
  const labelColor = useColorModeValue('gray.400', 'gray.500');
  const emptyIconBg = useColorModeValue('gray.100', 'gray.700');

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${apiUrl}/user/getuser`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch allocated roles');
        const userdetails = await response.json();
        // The paper-review and diabetics modules are gone, but the roles they
        // issued still sit on existing user records — hide them rather than
        // offering a card that leads to a route that no longer exists.
        // Matched case-insensitively: 'editor' was stored with either casing.
        const platformRoles = (userdetails.user.role || []).filter(
          (role) => !EXCLUDED_ROLES.includes(String(role).toLowerCase()),
        );
        setAllocatedRoles(platformRoles);
        setUser(userdetails.user);

        // Learning-module standing is per-class, not a platform role, so it has
        // to be asked for separately. Kept out of `allocatedRoles` so the
        // single-role auto-redirect below behaves exactly as before.
        try {
          const lmResponse = await fetch(`${apiUrl}/api/v1/learningmodule/overview`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
          if (lmResponse.ok) {
            const overview = await lmResponse.json();
            const cards = [];
            if (overview.teachingCount > 0) {
              cards.push({
                role: 'learning-teacher',
                description: `${overview.teachingCount} class${overview.teachingCount === 1 ? '' : 'es'} you teach${
                  overview.awaitingReview ? ` · ${overview.awaitingReview} to review` : ''
                }`,
              });
            }
            // A student who already has the STUDENT platform role has a card
            // for it, so only add this when their enrolment would otherwise be
            // invisible (e.g. a faculty member sitting in a colleague's class).
            if (overview.enrolledCount > 0 && !platformRoles.includes('STUDENT')) {
              cards.push({
                role: 'learning-student',
                description: `${overview.enrolledCount} class${overview.enrolledCount === 1 ? '' : 'es'} you are enrolled in${
                  overview.pendingWork ? ` · ${overview.pendingWork} pending` : ''
                }`,
              });
            }
            setLearningCards(cards);
          }
        } catch {
          // The learning module being unreachable must not blank the roles page.
        }

        // The iLEED dashboard card for heads of department. Derived from the
        // platform role rather than fetched, so it does not depend on the
        // attendance module being reachable — and kept out of `allocatedRoles`
        // for the same reason the learning cards are: it must not turn a
        // single-role account into a two-role one and suppress the redirect.
        try {
          if (platformRoles.some((r) => String(r).toUpperCase() === 'HOD')) {
            setExtraCards([{ role: 'ileed-hod' }]);
          }
        } catch {
          // An unexpected role shape must not cost the user their other cards.
        }
      } catch (error) {
        console.error('Error fetching allocated roles:', error.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // A module that turned the user away sent them back here. Without this the
  // return trip is silent and indistinguishable from the card doing nothing —
  // see the redirect in attendancemodule/AMSLayout.
  useEffect(() => {
    const { deniedModule, deniedReason } = location.state || {};
    if (!deniedModule) return;
    toast({
      title: `${deniedModule} is not open to this account`,
      description:
        deniedReason ||
        'Your account does not have access to that module. If the role was granted just now, sign out and in again.',
      status: 'warning',
      duration: 8000,
      isClosable: true,
    });
    // Cleared so a reload, or coming back here later, does not repeat it.
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate, toast]);

  // Single-role users skip the picker and land on their dashboard directly.
  //
  // Wrapped defensively: there is no error boundary anywhere in this app, so
  // an exception thrown from an effect unmounts the whole tree and leaves the
  // page blank with no way back — exactly what happened when singleRoleTarget
  // crashed on an unexpected user shape. Falling through to the picker below
  // on any failure here keeps that a recoverable dead end instead of a wall.
  useEffect(() => {
    if (!isLoading && allocatedRoles.length === 1 && user) {
      try {
        const target = singleRoleTarget(allocatedRoles[0], user);
        if (target !== '#') navigate(target);
      } catch (error) {
        console.error('Error resolving single-role destination:', error.message);
      }
    }
  }, [isLoading, allocatedRoles, user, navigate]);

  if (isLoading) {
    return (
      <Flex bg={pageBg} minH="100vh" align="center" justify="center">
        <Spinner size="lg" />
      </Flex>
    );
  }

  const email = Array.isArray(user?.email) ? user.email[0] : user?.email;
  const displayName = user?.name || email || 'there';
  const roleCount = allocatedRoles.length + learningCards.length + extraCards.length;

  return (
    <Box bg={pageBg} minH="100vh" py={{ base: 8, md: 16 }}>
      <Container maxW="5xl">
        {/* Header */}
        <Flex justify="space-between" align={{ base: "flex-start", sm: "center" }} direction={{ base: "column", sm: "row" }} mb={{ base: 8, md: 12 }} gap={4}>
          <Box>
            <Text
              fontSize={{ base: 'xs', md: 'sm' }}
              fontWeight="bold"
              letterSpacing="0.12em"
              textTransform="uppercase"
              color={labelColor}
              mb={2}
            >
              Welcome back
            </Text>
            <Heading
              as="h1"
              fontSize={{ base: 'xl', md: '3xl' }}
              lineHeight="1.2"
              letterSpacing="-0.01em"
              wordBreak="break-word"
            >
              {email || displayName}
            </Heading>
            <Text color={subColor} fontSize={{ base: 'md', md: 'lg' }} mt={3}>
              {roleCount
                ? `Choose a workspace to continue — you have ${roleCount} ${roleCount === 1 ? 'role' : 'roles'}.`
                : 'No roles have been assigned to your account yet.'}
            </Text>
          </Box>
          
          {allocatedRoles.includes('admin') && (
            <Button 
              colorScheme="blue" 
              onClick={handlePublishOTA}
              isLoading={isPublishing}
            >
              Publish OTA Update
            </Button>
          )}
        </Flex>

        {roleCount ? (
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={{ base: 4, md: 6 }}>
            {allocatedRoles.map((role, index) => (
              <RoleItem
                key={role}
                role={role}
                index={index}
                onOpen={() => navigate(singleRoleTarget(role, user))}
              />
            ))}
            {learningCards.map((card, index) => (
              <RoleItem
                key={card.role}
                role={card.role}
                index={allocatedRoles.length + index}
                descriptionOverride={card.description}
                onOpen={() => navigate(singleRoleTarget(card.role, user))}
              />
            ))}
            {extraCards.map((card, index) => (
              <RoleItem
                key={card.role}
                role={card.role}
                index={allocatedRoles.length + learningCards.length + index}
                descriptionOverride={card.description}
                onOpen={() => navigate(singleRoleTarget(card.role, user))}
              />
            ))}
          </SimpleGrid>
        ) : (
          <Flex
            direction="column"
            align="center"
            textAlign="center"
            bg={emptyCardBg}
            borderWidth="1px"
            borderColor={emptyCardBorder}
            borderRadius="2xl"
            py={{ base: 12, md: 16 }}
            px={6}
          >
            <Flex
              align="center"
              justify="center"
              boxSize={16}
              borderRadius="full"
              bg={emptyIconBg}
              color={subColor}
              mb={4}
            >
              <Icon as={FiUser} boxSize={8} />
            </Flex>
            <Heading as="h2" fontSize={{ base: 'lg', md: 'xl' }} mb={2}>
              No roles assigned yet
            </Heading>
            <Text color={subColor} fontSize={{ base: 'sm', md: 'md' }} maxW="sm">
              Your account doesn&apos;t have any roles yet. Please contact your administrator to get access.
            </Text>
          </Flex>
        )}
      </Container>
    </Box>
  );
};

export default AllocatedRolesPage;
