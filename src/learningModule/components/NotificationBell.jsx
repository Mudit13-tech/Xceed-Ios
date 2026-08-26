import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerContent,
  DrawerOverlay,
  Flex,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Text,
  useBreakpointValue,
  useDisclosure,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import lmApi from '../api/lmApi';
import { buttonTextStyles } from './common';
import { relativeTime } from '../format';
import NotificationPreferencesModal from './NotificationPreferencesModal';

const POLL_MS = 60000;

const ring = keyframes`
  0% { transform: rotate(0); }
  10% { transform: rotate(15deg); }
  20% { transform: rotate(-10deg); }
  30% { transform: rotate(5deg); }
  40% { transform: rotate(-5deg); }
  50% { transform: rotate(0); }
  100% { transform: rotate(0); }
`;

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

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const navigate = useNavigate();
  const isOpenRef = React.useRef(false);
  const isMobile = useBreakpointValue({ base: true, md: false });

  const { isOpen, onOpen: onPopoverOpen, onClose: onPopoverClose } = useDisclosure();

  const load = useCallback(async (forceUpdateItems = false) => {
    try {
      const data = await lmApi.notifications({ limit: 10 });
      if (!isOpenRef.current || forceUpdateItems === true) {
        setItems(data.items);
      }
      setUnread(data.unreadCount);
      return data;
    } catch {
      // A polling failure is not worth surfacing — the next tick retries.
      return null;
    }
  }, []);

  /**
   * Opening the panel counts as having seen what is in it.
   */
  const onOpen = useCallback(async () => {
    isOpenRef.current = true;
    onPopoverOpen();
    const data = await load(true);
    const seen = (data?.items || []).filter((item) => !item.read).map((item) => item._id);
    if (!seen.length) return;

    await lmApi.markNotificationsRead(seen, { silent: true }).catch(() => {});
    setUnread((count) => Math.max(0, count - seen.length));
    window.dispatchEvent(new Event('lmNotificationsCountUpdated'));
  }, [load, onPopoverOpen]);

  const onClose = useCallback(() => {
    isOpenRef.current = false;
    onPopoverClose();
    load();
  }, [load, onPopoverClose]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    window.addEventListener('lmNotificationsUpdated', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('lmNotificationsUpdated', load);
    };
  }, [load]);

  const open = async (notification) => {
    await lmApi.markNotificationsRead([notification._id]).catch(() => {});
    setUnread((count) => Math.max(0, count - (notification.read ? 0 : 1)));
    setItems((prev) => prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n)));
    if (notification.link) navigate(notification.link);
    onClose();
  };

  const markAll = async () => {
    await lmApi.markNotificationsRead().catch(() => {});
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    onClose();
  };

  const notificationList = (
    <>
      <Flex justify="space-between" align="center" px={4} pt={4} pb={2} borderBottomWidth="1px">
        <Text fontWeight="600" fontSize="sm">
          Notifications
        </Text>
        <Flex align="center" gap={2}>
          {unread > 0 && (
            <Button size="xs" variant="link" colorScheme="blue" onClick={markAll}>
              Mark all read
            </Button>
          )}
          <IconButton
            size="xs"
            variant="ghost"
            aria-label="Notification settings"
            icon={<span>⚙️</span>}
            onClick={() => setPrefsModalOpen(true)}
            title="Notification settings"
          />
        </Flex>
      </Flex>
      <Box maxH={isMobile ? 'calc(100vh - 88px)' : '420px'} overflowY="auto" px={0}>
        {items.length === 0 && (
          <Text px={4} py={6} fontSize="sm" color="lmFg.muted" textAlign="center">
            Nothing new.
          </Text>
        )}
        {items.map((notification, index) => (
          <Box key={notification._id}>
            {index > 0 && <Divider />}
            <Flex
              as="button"
              w="100%"
              textAlign="left"
              px={4}
              py={3}
              gap={3}
              bg={notification.read ? 'transparent' : 'lmHue.blue50'}
              _hover={{ bg: 'gray.50' }}
              onClick={() => open(notification)}
              {...buttonTextStyles}
            >
              <Text>{TYPE_ICONS[notification.type] || '🔔'}</Text>
              <Box flex="1" minW={0}>
                <Text fontSize="sm" fontWeight={notification.read ? '400' : '600'} noOfLines={2}>
                  {notification.title}
                </Text>
                {notification.body && (
                  <Text fontSize="xs" color="lmFg.subtle" noOfLines={2}>
                    {notification.body}
                  </Text>
                )}
                <Text fontSize="xs" color="lmFg.muted" mt={0.5}>
                  {relativeTime(notification.created_at)}
                </Text>
              </Box>
            </Flex>
          </Box>
        ))}
      </Box>
    </>
  );

  return (
    <>
      {isMobile ? (
        <>
          <Box position="relative" display="inline-block">
            <IconButton
              variant="ghost"
              aria-label="Notifications"
              onClick={onOpen}
              icon={<Box as="span" display="inline-block" animation={unread > 0 ? `${ring} 2s ease infinite` : 'none'}>🔔</Box>}
            />
            {unread > 0 && (
              <Badge
                position="absolute"
                top="0"
                right="0"
                colorScheme="red"
                borderRadius="full"
                fontSize="0.6rem"
                px={1.5}
                pointerEvents="none"
              >
                {unread > 9 ? '9+' : unread}
              </Badge>
            )}
          </Box>
          <Drawer isOpen={isOpen} onClose={onClose} placement="bottom" size="full">
            <DrawerOverlay />
            <DrawerContent h="100vh" maxH="100vh" borderTopRadius="0">
              {notificationList}
            </DrawerContent>
          </Drawer>
        </>
      ) : (
        <Popover placement="bottom-end" isOpen={isOpen} onOpen={onOpen} onClose={onClose}>
          <PopoverTrigger>
            <Box position="relative" display="inline-block">
              <IconButton
                variant="ghost"
                aria-label="Notifications"
                icon={<Box as="span" display="inline-block" animation={unread > 0 ? `${ring} 2s ease infinite` : 'none'}>🔔</Box>}
              />
              {unread > 0 && (
                <Badge
                  position="absolute"
                  top="0"
                  right="0"
                  colorScheme="red"
                  borderRadius="full"
                  fontSize="0.6rem"
                  px={1.5}
                  pointerEvents="none"
                >
                  {unread > 9 ? '9+' : unread}
                </Badge>
              )}
            </Box>
          </PopoverTrigger>
          <PopoverContent w="360px" maxW="90vw">
            <PopoverArrow />
            <PopoverHeader>
              <Flex justify="space-between" align="center">
                <Text fontWeight="600" fontSize="sm">
                  Notifications
                </Text>
                <Flex align="center" gap={2}>
                  {unread > 0 && (
                    <Button size="xs" variant="link" colorScheme="blue" onClick={markAll}>
                      Mark all read
                    </Button>
                  )}
                  <IconButton
                    size="xs"
                    variant="ghost"
                    aria-label="Notification settings"
                    icon={<span>⚙️</span>}
                    onClick={() => setPrefsModalOpen(true)}
                    title="Notification settings"
                  />
                </Flex>
              </Flex>
            </PopoverHeader>
            <PopoverBody px={0} maxH="420px" overflowY="auto">
              {items.length === 0 && (
                <Text px={4} py={6} fontSize="sm" color="lmFg.muted" textAlign="center">
                  Nothing new.
                </Text>
              )}
              {items.map((notification, index) => (
                <Box key={notification._id}>
                  {index > 0 && <Divider />}
                  <Flex
                    as="button"
                    w="100%"
                    textAlign="left"
                    px={4}
                    py={3}
                    gap={3}
                    bg={notification.read ? 'transparent' : 'lmHue.blue50'}
                    _hover={{ bg: 'gray.50' }}
                    onClick={() => open(notification)}
                    {...buttonTextStyles}
                  >
                    <Text>{TYPE_ICONS[notification.type] || '🔔'}</Text>
                    <Box flex="1" minW={0}>
                      <Text fontSize="sm" fontWeight={notification.read ? '400' : '600'} noOfLines={2}>
                        {notification.title}
                      </Text>
                      {notification.body && (
                        <Text fontSize="xs" color="lmFg.subtle" noOfLines={2}>
                          {notification.body}
                        </Text>
                      )}
                      <Text fontSize="xs" color="lmFg.muted" mt={0.5}>
                        {relativeTime(notification.created_at)}
                      </Text>
                    </Box>
                  </Flex>
                </Box>
              ))}
            </PopoverBody>
          </PopoverContent>
        </Popover>
      )}
      <NotificationPreferencesModal
        isOpen={prefsModalOpen}
        onClose={() => setPrefsModalOpen(false)}
      />
    </>
  );
}
