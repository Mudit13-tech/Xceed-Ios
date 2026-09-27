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
import usePolling from '../../utils/usePolling';
import { buttonTextStyles } from './common';
import { notificationIcon, relativeTime } from '../format';
import NotificationPreferencesModal from './NotificationPreferencesModal';
import { LmIcon } from './Icon';

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

  /* The bell is on every learning page, so this one timer is the platform's
     most-run request: once a minute, per signed-in tab. Students leave those
     tabs open for days — a lecture tab, a coursework tab, one from Tuesday —
     and a bare setInterval kept every one of them asking for notifications
     nobody was there to read. usePolling stops while the tab is hidden and
     fires once on return, so a student coming back still lands on a current
     count. */
  usePolling(load, POLL_MS);

  useEffect(() => {
    window.addEventListener('lmNotificationsUpdated', load);
    return () => window.removeEventListener('lmNotificationsUpdated', load);
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
            icon={<LmIcon name="settings" size={16} />}
            onClick={() => setPrefsModalOpen(true)}
            title="Notification settings"
          />
          {/* The only way out of the mobile panel, so it is sized to be hit
              rather than to match the row: `xs` is a 24px box, which is under
              every touch-target guideline there is and was being drawn at the
              very top of the screen. */}
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Close notifications"
            icon={<LmIcon name="close" size={18} />}
            onClick={onClose}
            title="Close notifications"
          />
        </Flex>
      </Flex>
      {/* Takes whatever is left under the header rather than guessing at it.
          The old `calc(100vh - 88px)` was a guess at the header's height and
          it did not know about the notch: with the panel inset by the safe
          area the sum was 59px out, which put the last notification under the
          home indicator. This list is only rendered inside the mobile drawer,
          which is a flex column. */}
      <Box flex="1" minH={0} overflowY="auto" px={0}>
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
              <Box color="lmFg.subtle" pt={0.5}>
                <LmIcon name={notificationIcon(notification.type)} size={18} />
              </Box>
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
              icon={
                <Box as="span" display="inline-flex" animation={unread > 0 ? `${ring} 2s ease infinite` : 'none'}>
                  <LmIcon name="notifications" size={20} />
                </Box>
              }
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
          {/* Full-screen, so nothing of the page is left to tap to get out of
              it: no overlay to click through, and on iOS no hardware back key
              behind it either. That makes the header's X the only exit, and an
              exit drawn under the Dynamic Island is not an exit -- the panel
              covers the whole screen, the status bar included, and a `fixed`
              element takes no notice of the padding safeArea.js puts on the
              page's own header. Hence the insets here, which are 0 everywhere
              that has no cutout. src/mobile/swipeBack.js adds the second way
              out: an edge swipe now dismisses the panel rather than being
              refused by it. */}
          <Drawer isOpen={isOpen} onClose={onClose} placement="bottom" size="full">
            <DrawerOverlay />
            <DrawerContent
              h="100vh"
              maxH="100vh"
              borderTopRadius="0"
              display="flex"
              flexDirection="column"
              pt="calc(var(--xceed-safe-top, 0px) + var(--chakra-space-3))"
              pb="var(--xceed-safe-bottom, 0px)"
            >
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
                icon={
                <Box as="span" display="inline-flex" animation={unread > 0 ? `${ring} 2s ease infinite` : 'none'}>
                  <LmIcon name="notifications" size={20} />
                </Box>
              }
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
                    icon={<LmIcon name="settings" size={16} />}
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
                    <Box color="lmFg.subtle" pt={0.5}>
                <LmIcon name={notificationIcon(notification.type)} size={18} />
              </Box>
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
