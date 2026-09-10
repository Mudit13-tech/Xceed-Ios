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
  useToast,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import {
  FiCalendar,
  FiUserCheck,
  FiAward,
  FiMic,
  FiFileText,
  FiUsers,
  FiActivity,
  FiZap,
  FiArrowRight,
  FiAlertCircle,
  FiUserPlus,
  FiUploadCloud,
  FiDatabase,
  FiMail,
} from 'react-icons/fi';
import getEnvironment from '../getenvironment';

const MODULES = [
  {
    title: 'Time Table Admin',
    description: 'Create and manage department timetables, semesters and slots.',
    to: '/tt/admin',
    icon: FiCalendar,
    accent: 'blue',
  },
  {
    title: 'iLEED Admin',
    description: 'Intelligent learning engagement and entity detection: cameras, ground truth and reports.',
    to: '/attendance',
    icon: FiUserCheck,
    accent: 'cyan',
  },
  {
    title: 'Certificate Management Admin',
    description: 'Design certificate templates and manage event certificates.',
    to: '/cm/addevent',
    icon: FiAward,
    accent: 'green',
  },
  {
    title: 'Conference Management Admin',
    description: 'Set up conferences, tracks and submission workflows.',
    to: '/cf/addconf',
    icon: FiMic,
    accent: 'purple',
  },
  {
    title: 'Review Management Admin',
    description: 'Assign editors and oversee the paper review pipeline.',
    to: '/prm/assigneditor',
    icon: FiFileText,
    accent: 'orange',
  },
  {
    title: 'User Management',
    description: 'Manage user accounts, roles and access permissions.',
    to: '/usermanagement',
    icon: FiUsers,
    accent: 'teal',
  },
  {
    title: 'Academic Leadership',
    description:
      'Map each department to the account that heads it, appoint the Dean (Academic) who reads all of them, and choose what each of their dashboards shows.',
    to: '/superadmin/hods',
    icon: FiUserCheck,
    accent: 'purple',
  },
  {
    title: 'Bugs & Suggestions',
    description: 'Read what users have reported, and approve the reports worth acting on.',
    to: '/superadmin/bugs',
    icon: FiAlertCircle,
    accent: 'red',
  },
  {
    title: 'Development Team Applications',
    description:
      'Students asking to help build XCEED. Read their work, then accept or reject with a message — and spot-check the event proofs that let them apply.',
    to: '/superadmin/dev-team',
    icon: FiUserPlus,
    accent: 'teal',
  },
  {
    title: 'Mail Senders',
    description:
      'Which mailbox each module sends from, and how much mail each sender has sent this week.',
    to: '/superadmin/mail',
    icon: FiMail,
    accent: 'blue',
  },
  {
    title: 'Pull & Deploy',
    description: 'Merge a pull request, pull main and restart the Node server and React build.',
    to: '/superadmin/deploy',
    icon: FiUploadCloud,
    accent: 'red',
  },
  {
    title: 'Logs',
    description: 'Inspect platform activity and system logs.',
    to: '/platform',
    icon: FiActivity,
    accent: 'pink',
  },
  {
    title: 'XCEED',
    description: 'Open the XCEED platform tools.',
    to: '/platform',
    icon: FiZap,
    accent: 'gray',
  },
];

const ModuleCard = ({ title, description, to, icon, accent, onClick }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const descColor = useColorModeValue('gray.600', 'gray.400');
  const iconBg = useColorModeValue(`${accent}.50`, `${accent}.900`);
  const iconColor = useColorModeValue(`${accent}.600`, `${accent}.300`);
  const hoverBorder = useColorModeValue(`${accent}.400`, `${accent}.500`);

  const asProp = onClick ? 'button' : RouterLink;
  const linkProps = onClick ? { onClick, textAlign: 'left', w: '100%' } : { to };

  return (
    <Box
      as={asProp}
      {...linkProps}
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
        <Flex
          align="center"
          justify="center"
          boxSize={12}
          borderRadius="lg"
          bg={iconBg}
          color={iconColor}
        >
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

const SuperAdminPage = () => {
  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const [isBackingUp, setIsBackingUp] = React.useState(false);
  const toast = useToast();

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const token = localStorage.getItem("token"); // or appropriate auth
      // Absolute, via getEnvironment(). A relative path is wrong twice over: in
      // the Capacitor shell it resolves to the local asset origin and never
      // reaches the server, and even on the web the fetch wrapper in main.jsx
      // only recognises a URL that starts with the API origin, so a relative
      // one gets no X-App-Name header — which the server's csrfGuard requires
      // of any state-changing request.
      const response = await fetch(`${getEnvironment()}/api/v1/attendancemodule/mldatafoldertree/backup-db`, {
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

  return (
    <Box bg={pageBg} minH="100vh" py={{ base: 8, md: 14 }}>
      <Container maxW="6xl">
        <Box mb={{ base: 8, md: 12 }} textAlign={{ base: 'left', md: 'center' }}>
          <Heading as="h1" size="xl" mb={2}>
            Super Admin
          </Heading>
          <Text color={subColor} fontSize={{ base: 'md', md: 'lg' }}>
            Manage every module of the platform from one place.
          </Text>
        </Box>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={6}>
          {MODULES.map((mod) => (
            <ModuleCard key={mod.title} {...mod} />
          ))}
          <ModuleCard 
            title={isBackingUp ? "Backing up..." : "Database Backup"}
            description="Export MongoDB database to the ml-data backup folder."
            icon={FiDatabase}
            accent="blue"
            onClick={isBackingUp ? undefined : handleBackup}
          />
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default SuperAdminPage;
