// client/src/dashboard/superadmin.jsx
//
// Every admin area of the platform, at /superadmin.
//
// Two kinds of thing were competing for the same grid. Most entries are a
// module — somewhere an admin goes and then works for a while — but a handful
// are errands: check the bug queue, see who sent what mail, push a deploy, take
// a backup. As equal-sized cards the errands outnumbered the modules and buried
// them. They are now icons in the header, on one line with the release buttons,
// and the grid below is modules only: the four product modules plus the
// learning module, then the screens that govern who may use them.
//
// The release controls sit in the header rather than the grid for a different
// reason: they *do* something instead of leading somewhere, and a card that
// publishes to every installed app the moment it is clicked is not a card. They
// were on the roles page until now, which is every user's landing.

import React from 'react';
import {
  Box,
  Button,
  Container,
  Divider,
  Flex,
  Heading,
  Icon,
  IconButton,
  SimpleGrid,
  Text,
  Tooltip,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import {
  FiCalendar,
  FiUserCheck,
  FiAward,
  FiMic,
  FiUsers,
  FiZap,
  FiArrowRight,
  FiAlertCircle,
  FiUserPlus,
  FiUploadCloud,
  FiDatabase,
  FiMail,
  FiSend,
  FiBookOpen,
} from 'react-icons/fi';
import getEnvironment from '../getenvironment';

const apiUrl = getEnvironment();

// The modules the platform is actually made of. Descriptions are one short line
// each: at five cards to a row there is no space for a paragraph, and a card
// only has to say which module it is.
const MODULES = [
  {
    title: 'Time Table Admin',
    description: 'Department timetables, semesters and slots.',
    to: '/tt/admin',
    icon: FiCalendar,
    accent: 'blue',
  },
  {
    title: 'iLEED Admin',
    description: 'Cameras, ground truth and attendance reports.',
    to: '/attendance',
    icon: FiUserCheck,
    accent: 'cyan',
  },
  {
    title: 'Learning Module',
    description: 'Classes, coursework and the platform-wide learning queues.',
    to: '/learning/lm-admin',
    icon: FiBookOpen,
    accent: 'orange',
  },
  {
    title: 'Certificate Management',
    description: 'Certificate templates and event certificates.',
    to: '/cm/addevent',
    icon: FiAward,
    accent: 'green',
  },
  {
    title: 'Conference Management',
    description: 'Conferences, tracks and submission workflows.',
    to: '/cf/addconf',
    icon: FiMic,
    accent: 'purple',
  },
];

// Who may use the platform, and the platform's own configuration.
const ADMIN_TOOLS = [
  {
    title: 'User Management',
    description: 'Accounts, roles and access permissions.',
    to: '/usermanagement',
    icon: FiUsers,
    accent: 'teal',
  },
  {
    title: 'Academic Leadership',
    description: 'Department heads, the Dean (Academic), and what their dashboards show.',
    to: '/superadmin/hods',
    icon: FiUserCheck,
    accent: 'purple',
  },
  {
    title: 'Development Team',
    description: 'Students applying to help build XCEED — read, accept or reject.',
    to: '/superadmin/dev-team',
    icon: FiUserPlus,
    accent: 'teal',
  },
  {
    title: 'XCEED Platform',
    description: 'Platform roles, exempted links and module contributors.',
    to: '/platform',
    icon: FiZap,
    accent: 'purple',
  },
];

const ModuleCard = ({ title, description, to, icon, accent }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const descColor = useColorModeValue('gray.600', 'gray.400');
  const iconBg = useColorModeValue(`${accent}.50`, `${accent}.900`);
  const iconColor = useColorModeValue(`${accent}.600`, `${accent}.300`);
  const hoverBorder = useColorModeValue(`${accent}.400`, `${accent}.500`);

  return (
    <Box
      as={RouterLink}
      to={to}
      role="group"
      bg={cardBg}
      borderWidth="1px"
      borderColor={border}
      borderRadius="xl"
      p={5}
      display="flex"
      flexDirection="column"
      gap={3}
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
        <Flex
          align="center"
          justify="center"
          boxSize={10}
          borderRadius="lg"
          bg={iconBg}
          color={iconColor}
        >
          <Icon as={icon} boxSize={5} />
        </Flex>
        <Icon
          as={FiArrowRight}
          boxSize={4}
          color={iconColor}
          opacity={0}
          transform="translateX(-6px)"
          transition="all 0.2s ease"
          _groupHover={{ opacity: 1, transform: 'translateX(0)' }}
        />
      </Flex>
      <Box>
        <Heading as="h3" size="sm" mb={1} lineHeight="1.35">
          {title}
        </Heading>
        {/* Clamped rather than trusted to be short: a card five to a row is
            narrow, and one long description would otherwise set the height of
            every card beside it. */}
        <Text fontSize="xs" color={descColor} noOfLines={3}>
          {description}
        </Text>
      </Box>
    </Box>
  );
};

/**
 * One errand in the header strip.
 *
 * Icon-only, so the label lives in the tooltip and in `aria-label` — the
 * tooltip is a hover, and an icon with no accessible name is unusable to
 * anyone reading the page with a screen reader or driving it from the keyboard.
 */
const QuickAction = ({ label, icon, to, onClick, isLoading }) => {
  const button = (
    <IconButton
      aria-label={label}
      icon={<Icon as={icon} boxSize={5} />}
      variant="ghost"
      size="md"
      isLoading={isLoading}
      {...(to ? { as: RouterLink, to } : { onClick })}
    />
  );

  // A tooltip wrapped around a button in a loading state would sit over a
  // spinner and say the thing it is already doing.
  return isLoading ? button : <Tooltip label={label} openDelay={300}>{button}</Tooltip>;
};

const SectionHeading = ({ children, hint }) => {
  const labelColor = useColorModeValue('gray.500', 'gray.400');
  return (
    <Box mb={5}>
      <Heading
        as="h2"
        fontSize="sm"
        fontWeight="bold"
        letterSpacing="0.12em"
        textTransform="uppercase"
        color={labelColor}
      >
        {children}
      </Heading>
      {hint && (
        <Text fontSize="sm" color={labelColor} mt={1}>
          {hint}
        </Text>
      )}
    </Box>
  );
};

const SuperAdminPage = () => {
  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const stripBg = useColorModeValue('white', 'gray.800');
  const stripBorder = useColorModeValue('gray.200', 'gray.700');
  const [isBackingUp, setIsBackingUp] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [isNotifying, setIsNotifying] = React.useState(false);
  const toast = useToast();

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const token = localStorage.getItem("token"); // or appropriate auth
      const response = await fetch("/api/v1/attendancemodule/mldatafoldertree/backup-db", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Backup failed");
      toast({
        title: "Backup Complete",
        description: "The database has been saved to ml-data/backup.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Backup Failed",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Builds the bundle and hands it to GitHub, which pushes it to every
  // installed app without anyone visiting a store.
  const handlePublishOTA = async () => {
    setIsPublishing(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/ota/trigger-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        toast({
          title: 'OTA update triggered',
          description: data.message || 'The build is running on GitHub.',
          status: 'success',
          duration: 6000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Could not trigger the update',
          description: data.error || 'Please check the server logs.',
          status: 'error',
          duration: 8000,
          isClosable: true,
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: 'Could not trigger the update',
        description: 'The server could not be reached.',
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // A store release is not an OTA publish: the new build sits in the Play Store
  // until each user goes and installs it, so it only reaches anyone if we say
  // so. One fixed message, sent as it is — the version number is on the store
  // listing the notification opens, and repeating it here only adds a field to
  // get wrong.
  const handleNotifyStoreRelease = async () => {
    setIsNotifying(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/ota/notify-store-release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        toast({
          title: 'Update notification sent',
          description: data.message || 'Every registered device has been notified.',
          status: 'success',
          duration: 6000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Could not send the notification',
          description: data.error || 'Please check the server logs.',
          status: 'error',
          duration: 8000,
          isClosable: true,
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: 'Could not send the notification',
        description: 'The server could not be reached.',
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setIsNotifying(false);
    }
  };

  const columns = { base: 1, sm: 2, md: 3, lg: 5 };

  return (
    <Box bg={pageBg} minH="100vh" py={{ base: 8, md: 14 }}>
      <Container maxW="7xl">
        <Flex
          align={{ base: 'flex-start', lg: 'center' }}
          justify="space-between"
          direction={{ base: 'column', lg: 'row' }}
          gap={5}
          mb={{ base: 8, md: 12 }}
        >
          <Box>
            <Heading as="h1" size="xl" mb={2}>
              Super Admin
            </Heading>
            <Text color={subColor} fontSize={{ base: 'md', md: 'lg' }}>
              Manage every module of the platform from one place.
            </Text>
          </Box>

          <Flex align="center" gap={3} flexWrap="wrap">
            {/* The errands, boxed together so the two release buttons beside
                them still read as the consequential pair. */}
            <Flex
              align="center"
              bg={stripBg}
              borderWidth="1px"
              borderColor={stripBorder}
              borderRadius="lg"
              px={1}
            >
              <QuickAction label="Bugs & Suggestions" icon={FiAlertCircle} to="/superadmin/bugs" />
              <QuickAction label="Message All Users" icon={FiSend} to="/superadmin/announce" />
              <QuickAction label="Mail Senders" icon={FiMail} to="/superadmin/mail" />
              <QuickAction label="Pull & Deploy" icon={FiUploadCloud} to="/superadmin/deploy" />
              <QuickAction
                label={isBackingUp ? 'Backing up…' : 'Database Backup'}
                icon={FiDatabase}
                onClick={handleBackup}
                isLoading={isBackingUp}
              />
            </Flex>

            <Button
              colorScheme="blue"
              onClick={handlePublishOTA}
              isLoading={isPublishing}
              loadingText="Publishing"
            >
              Publish OTA Update
            </Button>
            <Button
              colorScheme="green"
              variant="outline"
              onClick={handleNotifyStoreRelease}
              isLoading={isNotifying}
              loadingText="Sending"
            >
              Notify Play Store Update
            </Button>
          </Flex>
        </Flex>

        <SectionHeading hint="The modules XCEED is made of.">Main Modules</SectionHeading>
        <SimpleGrid columns={columns} spacing={5}>
          {MODULES.map((mod) => (
            <ModuleCard key={mod.title} {...mod} />
          ))}
        </SimpleGrid>

        <Divider my={{ base: 8, md: 10 }} />

        <SectionHeading hint="Who may use the platform, and how it is configured.">
          Administration
        </SectionHeading>
        <SimpleGrid columns={columns} spacing={5}>
          {ADMIN_TOOLS.map((tool) => (
            <ModuleCard key={tool.title} {...tool} />
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default SuperAdminPage;
