import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
} from '@chakra-ui/react';
import {
  FiAward,
  FiBookOpen,
  FiCalendar,
  FiMic,
  FiShield,
  FiUser,
  FiUserCheck,
} from 'react-icons/fi';
import getEnvironment from '../getenvironment';

const apiUrl = getEnvironment();

const ROLE_META = {
  ITTC: {
    name: 'Institute Time Table Coordinator',
    link: '/tt/admin',
    description: 'Manage institute-wide timetables',
    icon: FiCalendar,
    accent: 'blue',
  },
  DTTI: {
    name: 'Department Time Table Coordinator',
    link: '/tt/dashboard',
    description: 'Manage department timetables',
    icon: FiCalendar,
    accent: 'blue',
  },
  CM: {
    name: 'Event Certificate Manager',
    link: '/cm/dashboard',
    description: 'Create and manage certificates',
    icon: FiAward,
    accent: 'green',
  },
  admin: {
    name: 'XCEED Super User',
    link: '/superadmin',
    description: 'Full system administration',
    icon: FiShield,
    accent: 'red',
  },
  EO: {
    name: 'Event Organiser',
    link: '/cf/dashboard',
    description: 'Organize and manage events',
    icon: FiMic,
    accent: 'purple',
  },
  FACULTY: {
    name: 'Faculty',
    link: '/learning',
    description: 'Your classes and coursework',
    icon: FiUser,
    accent: 'orange',
  },
  'iams-admin': {
    name: 'iLEED Admin',
    link: '/iams-admin',
    description: 'Manage face recognition attendance system',
    icon: FiUserCheck,
    accent: 'cyan',
  },
  'iams-dept-admin': {
    name: 'iLEED Department Admin',
    link: '/dept-admin/dashboard',
    description: 'Department-level attendance management',
    icon: FiUserCheck,
    accent: 'cyan',
  },
  STUDENT: {
    name: 'Student',
    link: '/learning',
    description: 'Your classes, coursework and tutorials',
    icon: FiBookOpen,
    accent: 'teal',
  },
  'lm-admin': {
    name: 'Learning Module Admin',
    link: '/learning/lm-admin',
    description: 'Bug reports, feedback and usage stats for the Learning module',
    icon: FiShield,
    accent: 'purple',
  },
  // Synthetic entries: not platform roles, but the standing a user holds
  // inside the Learning module. Appended only when they actually have classes,
  // so they never displace a real role or the single-role auto-redirect.
  'learning-teacher': {
    name: 'Learning — Teacher',
    link: '/learning',
    description: 'Classes you teach',
    icon: FiBookOpen,
    accent: 'teal',
  },
  'learning-student': {
    name: 'Learning — Student',
    link: '/learning',
    description: 'Classes you are enrolled in',
    icon: FiBookOpen,
    accent: 'teal',
  },
};

const roleMeta = (role) =>
  ROLE_META[role] || {
    name: role,
    link: '#',
    description: 'Access your dashboard',
    icon: FiUser,
    accent: 'gray',
  };

const singleRoleTarget = (role, user) => {
  if (user?.name?.toLowerCase() === 'coe@nitj.ac.in') return '/tt/coe/facultyload';
  return roleMeta(role).link;
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

  // Query 1: User Details
  const { data: userDetails, isLoading: isUserLoading } = useQuery({
    queryKey: ['user', 'details'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/user/getuser`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch allocated roles');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query 2: Learning Module Overview
  const { data: lmOverview, isLoading: isLmLoading } = useQuery({
    queryKey: ['learning', 'overview'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/api/v1/learningmodule/overview`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch overview');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const isLoading = isUserLoading || isLmLoading;
  const user = userDetails?.user;

  const excludedRoles = useMemo(() => [
    'reviewer',
    'author',
    'editor',
    'prm',
    'doctor',
    'patient',
    'dm-admin',
  ], []);

  const allocatedRoles = useMemo(() => (user?.role || []).filter(
    (role) => !excludedRoles.includes(String(role).toLowerCase())
  ), [user?.role, excludedRoles]);

  const learningCards = [];
  if (lmOverview) {
    if (lmOverview.teachingCount > 0) {
      learningCards.push({
        role: 'learning-teacher',
        description: `${lmOverview.teachingCount} class${lmOverview.teachingCount === 1 ? '' : 'es'} you teach${
          lmOverview.awaitingReview ? ` · ${lmOverview.awaitingReview} to review` : ''
        }`,
      });
    }
    if (lmOverview.enrolledCount > 0 && !allocatedRoles.includes('STUDENT')) {
      learningCards.push({
        role: 'learning-student',
        description: `${lmOverview.enrolledCount} class${lmOverview.enrolledCount === 1 ? '' : 'es'} you are enrolled in${
          lmOverview.pendingWork ? ` · ${lmOverview.pendingWork} pending` : ''
        }`,
      });
    }
  }

  // Single-role users skip the picker and land on their dashboard directly.
  useEffect(() => {
    if (!isLoading && allocatedRoles.length === 1 && user) {
      const target = singleRoleTarget(allocatedRoles[0], user);
      if (target !== '#') navigate(target);
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
  const roleCount = allocatedRoles.length + learningCards.length;

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
                onOpen={() => navigate(roleMeta(card.role).link)}
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
