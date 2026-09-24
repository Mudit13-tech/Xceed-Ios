// client/src/platform/PlatformDashboard.jsx
//
// The XCEED platform menu, at /platform. Three tools that configure the
// platform itself rather than any one module.
//
// The cards follow the same shape as the Super Admin menu they are reached
// from — icon tile, title, one line of what is behind it, an arrow that appears
// on hover — because arriving here used to feel like arriving in a different
// product: a full-bleed three-colour gradient, a "Click to access" badge on
// every card restating what a card already is, and headings pinned to
// `gray.800` that vanished into the card in dark mode.

import React from 'react';
import {
  Box,
  Container,
  Flex,
  Heading,
  Icon,
  SimpleGrid,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiSettings, FiLayers, FiUserPlus, FiArrowRight, FiArrowLeft } from 'react-icons/fi';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

const CARDS = [
  {
    title: 'Platform Configuration',
    description: 'Roles that exist platform-wide, and the links exempted from them.',
    icon: FiSettings,
    accent: 'blue',
    path: '/platform/config',
  },
  {
    title: 'Module Contributors',
    description: 'The modules XCEED is made of, and who is credited with building each one.',
    icon: FiLayers,
    accent: 'purple',
    path: '/platform/modules',
  },
  {
    title: 'User Registration',
    description: 'Registration records and the configuration data behind them.',
    icon: FiUserPlus,
    accent: 'pink',
    path: '/platform/data',
  },
];

const PlatformCard = ({ title, description, icon, accent, path }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const descColor = useColorModeValue('gray.600', 'gray.400');
  const iconBg = useColorModeValue(`${accent}.50`, `${accent}.900`);
  const iconColor = useColorModeValue(`${accent}.600`, `${accent}.300`);
  const hoverBorder = useColorModeValue(`${accent}.400`, `${accent}.500`);

  return (
    <Box
      as={RouterLink}
      to={path}
      role="group"
      bg={cardBg}
      borderWidth="1px"
      borderColor={border}
      borderRadius="xl"
      p={6}
      display="flex"
      flexDirection="column"
      gap={4}
      transition="all 0.2s ease"
      _hover={{
        transform: 'translateY(-4px)',
        boxShadow: 'lg',
        borderColor: hoverBorder,
        textDecoration: 'none',
      }}
      _focusVisible={{ boxShadow: 'outline' }}
    >
      <Flex align="center" justify="space-between">
        <Flex align="center" justify="center" boxSize={12} borderRadius="lg" bg={iconBg} color={iconColor}>
          <Icon as={icon} boxSize={6} />
        </Flex>
        <Icon
          as={FiArrowRight}
          boxSize={5}
          color={iconColor}
          opacity={0}
          transform="translateX(-6px)"
          transition="all 0.2s ease"
          _groupHover={{ opacity: 1, transform: 'translateX(0)' }}
        />
      </Flex>
      <Box>
        <Heading as="h3" size="md" mb={1}>
          {title}
        </Heading>
        <Text fontSize="sm" color={descColor}>
          {description}
        </Text>
      </Box>
    </Box>
  );
};

const PlatformDashboard = () => {
  const navigate = useNavigate();
  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const backColor = useColorModeValue('gray.500', 'gray.400');
  const backHover = useColorModeValue('gray.700', 'gray.200');

  // The menu is reached from Super Admin, and until now had no way back to it
  // short of the browser's own button.
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/superadmin');
  };

  return (
    <Box bg={pageBg} minH="100vh" py={{ base: 8, md: 14 }}>
      <Container maxW="6xl">
        <Flex
          as="button"
          type="button"
          onClick={goBack}
          align="center"
          gap={2}
          mb={6}
          color={backColor}
          fontSize="sm"
          _hover={{ color: backHover }}
          transition="color 0.2s ease"
        >
          <Icon as={FiArrowLeft} boxSize={4} />
          Back
        </Flex>

        <Box mb={{ base: 8, md: 12 }} textAlign={{ base: 'left', md: 'center' }}>
          <Heading as="h1" size="xl" mb={2}>
            XCEED Platform
          </Heading>
          <Text color={subColor} fontSize={{ base: 'md', md: 'lg' }}>
            Settings that belong to the platform itself, not to any one module.
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={6}>
          {CARDS.map((card) => (
            <PlatformCard key={card.path} {...card} />
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default PlatformDashboard;
