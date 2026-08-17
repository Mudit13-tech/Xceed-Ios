import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Box, Button, Flex, HStack, Heading, IconButton,useColorModeValue, Text } from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { buttonTextStyles, EmptyState, ErrorState, Loading } from '../components/common';
import { relativeTime } from '../format';
import NotificationPreferencesModal from '../components/NotificationPreferencesModal';

const TYPE_ICONS = {
  announcement: '📣',
  coursework: '📄',
  comment: '💬',
  grade: '💯',
  submission: '📥',
  invite: '✉️',
  join_request: '🙋',
  quiz: '🧠',
  quiz_result: '🎯',
  material: '📚',
  feedback: '🕊️',
  dev_team: '🚀',
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const navigate = useNavigate();

  const readBg = useColorModeValue('white', 'gray.700');
  const readBorder = useColorModeValue('gray.200', 'gray.600');
  const unreadBg = useColorModeValue('blue.50', 'blue.900');
  const unreadBorder = useColorModeValue('blue.200', 'blue.700');
  const notificationTextColor = useColorModeValue('gray.800', 'gray.100');
  const notificationBodyColor = useColorModeValue('gray.600', 'gray.300');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await lmApi.notifications({ limit: 100 });
      setItems(data.items);
      setUnread(data.unreadCount);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('lmNotificationsUpdated', load);
    return () => {
      window.removeEventListener('lmNotificationsUpdated', load);
    };
  }, [load]);

  const open = async (notification) => {
    await lmApi.markNotificationsRead([notification._id]).catch(() => {});
    if (notification.link) navigate(notification.link);
    else load();
  };

  if (loading) return <Loading />;

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
        <Box>
          <Heading size="lg">Notifications</Heading>
          <Text color="gray.500" fontSize="sm">
            {unread} unread
          </Text>
        </Box>
        <HStack>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<span>⚙️</span>}
            onClick={() => setPrefsModalOpen(true)}
          >
            Notification Settings
          </Button>
          <Button
            size="sm"
            variant="outline"
            isDisabled={unread === 0}
            onClick={async () => {
              await lmApi.markNotificationsRead().catch(() => {});
              load();
            }}
          >
            Mark all read
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await lmApi.clearReadNotifications().catch(() => {});
              load();
            }}
          >
            Clear read
          </Button>
        </HStack>
      </Flex>

      <NotificationPreferencesModal
        isOpen={prefsModalOpen}
        onClose={() => setPrefsModalOpen(false)}
      />

      <ErrorState error={error} onRetry={load} />

      {items.length === 0 ? (
        <EmptyState icon="🔔" title="No notifications" description="Class activity shows up here." />
      ) : (
        items.map((notification) => (
          <Flex
            key={notification._id}
            bg={notification.read ? readBg : unreadBg}
            borderWidth="1px"
            borderColor={notification.read ? readBorder : unreadBorder}
            borderRadius="lg"
            p={4}
            mb={2}
            gap={3}
            align="flex-start"
          >
            <Text fontSize="lg">{TYPE_ICONS[notification.type] || '🔔'}</Text>
            <Box
              as="button"
              flex="1"
              minW={0}
              textAlign="left"
              onClick={() => open(notification)}
              {...buttonTextStyles}
              color={notificationTextColor}
            >
              <Text fontSize="sm" fontWeight={notification.read ? '500' : '700'}>
                {notification.title}
              </Text>
              {notification.body && (
                <Text fontSize="sm" color={notificationBodyColor} noOfLines={2}>
                  {notification.body}
                </Text>
              )}
              <HStack spacing={2} mt={1}>
                {notification.className && (
                  <Badge colorScheme="gray" fontSize="0.65rem">
                    {notification.className}
                  </Badge>
                )}
                <Text fontSize="xs" color="gray.400">
                  {relativeTime(notification.created_at)}
                </Text>
              </HStack>
            </Box>
            <IconButton
              size="xs"
              variant="ghost"
              aria-label="Dismiss notification"
              icon={<span>✕</span>}
              onClick={async () => {
                await lmApi.deleteNotification(notification._id).catch(() => {});
                load();
              }}
            />
          </Flex>
        ))
      )}
    </Box>
  );
}
