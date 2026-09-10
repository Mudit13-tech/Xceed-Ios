import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Heading,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { AttachmentList } from '../components/Attachments';
import MaterialModal from '../components/MaterialModal';
import { EmptyState, ErrorState, Loading, MaterialListSkeleton, TopicManager, buttonTextStyles, groupByTopic } from '../components/common';
import { formatDate } from '../format';
import { LmIcon } from '../components/Icon';

function MaterialRow({ item, classId, isTeacher, onChanged, onEdit }) {
  const toast = useToast();

  const remove = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    try {
      await lmApi.deleteCoursework(classId, item._id);
      onChanged();
    } catch (error) {
      toast({ status: 'error', title: error.message });
    }
  };

  return (
    <Box
      bg="lmBg.surface"
      borderWidth="1px"
      borderColor="lmBorder.base"
      borderRadius="lg"
      p={4}
      mb={3}
      _hover={{ borderColor: 'blue.300' }}
    >
      <Flex align="center" gap={4}>
        <Flex w="40px" h="40px" borderRadius="full" bg="lmHue.green50" color="green.600" align="center" justify="center" flexShrink={0}>
          <LmIcon name="material" size={20} />
        </Flex>
        <Box
          as={RouterLink}
          to={`/learning/class/${classId}/work/${item._id}`}
          flex="1"
          minW={0}
          _hover={{ textDecoration: 'none' }}
        >
          <Flex align="center" gap={2} wrap="wrap">
            <Heading size="sm" color="lmFg.heading" noOfLines={1}>
              {item.title}
            </Heading>
            {item.status !== 'published' && (
              <Badge colorScheme={item.status === 'draft' ? 'gray' : 'purple'}>{item.status}</Badge>
            )}
            {item.aiSourceSessionId && (
              <Badge colorScheme="purple" display="inline-flex" alignItems="center" gap={1}>
                <LmIcon name="ai" size={11} />
                AI
              </Badge>
            )}
          </Flex>
          <HStack spacing={3} mt={1} wrap="wrap">
            <Text fontSize="xs" color="lmFg.muted">
              Posted {formatDate(item.publishedAt)}
            </Text>
            {item.updated_at && new Date(item.updated_at) - new Date(item.publishedAt) > 1000 && (
              <Text fontSize="xs" color="lmFg.muted">
                · Last updated {formatDate(item.updated_at)}
              </Text>
            )}
          </HStack>
        </Box>

        {isTeacher && (
          <Menu>
            <MenuButton as={IconButton} size="sm" variant="ghost" icon={<span>⋮</span>} aria-label="Material actions" />
            <MenuList>
              <MenuItem {...buttonTextStyles} onClick={() => onEdit(item)}>
                Edit
              </MenuItem>
              <MenuItem color="red.600" onClick={remove}>
                Delete
              </MenuItem>
            </MenuList>
          </Menu>
        )}
      </Flex>

      {/* Links and files sit outside the row link so they stay clickable. */}
      <Box pl={{ base: 0, sm: '56px' }}>
        <AttachmentList attachments={item.attachments} compact />
      </Box>
    </Box>
  );
}

export default function Material() {
  const { classId, klass, isTeacher, reloadClass } = useOutletContext();
  const [editing, setEditing] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const topics = klass.topics || [];

  const {
    data: items = [],
    isLoading: loading,
    error,
    refetch: load,
  } = useQuery({
    queryKey: ['learning', 'material', classId],
    queryFn: () => lmApi.listCoursework(classId, { workType: 'material' }),
  });

  const openNew = () => {
    setEditing(null);
    onOpen();
  };
  const openEdit = (item) => {
    setEditing(item);
    onOpen();
  };
  const afterSave = async () => {
    await load();
    reloadClass();
  };

  const { grouped, untopiced } = groupByTopic(items, topics);

  if (loading) return <MaterialListSkeleton />;

  return (
    <Flex gap={6} align="flex-start" direction={{ base: 'column', lg: 'row' }}>
      <Box flex="1" minW={0} order={{ base: 2, lg: 1 }} w="100%">
        <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
          <Box>
            <Heading size="md">Material</Heading>
            <Text fontSize="sm" color="lmFg.muted">
              Reading material, notes and files for this class.
            </Text>
          </Box>
          {isTeacher && (
            <Button colorScheme="blue" size="sm" onClick={openNew}>
              + Add material
            </Button>
          )}
        </Flex>

        <ErrorState error={error} onRetry={load} />

        {items.length === 0 ? (
          <EmptyState
            icon="material"
            title="No material yet"
            description={
              isTeacher
                ? 'Share reading material, notes or files with the class.'
                : 'Your teacher has not shared any material yet.'
            }
            action={
              isTeacher ? (
                <Button size="sm" colorScheme="blue" onClick={openNew}>
                  Add material
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            {grouped.map((group) => (
              <Box key={group.topic._id} mb={6}>
                <Heading size="sm" color="lmFg.body" mb={2}>
                  {group.topic.name}
                </Heading>
                <Divider mb={3} />
                {group.items.map((item) => (
                  <MaterialRow
                    key={item._id}
                    item={item}
                    classId={classId}
                    isTeacher={isTeacher}
                    onChanged={afterSave}
                    onEdit={openEdit}
                  />
                ))}
              </Box>
            ))}
            {untopiced.length > 0 && (
              <Box>
                {grouped.length > 0 && (
                  <>
                    <Heading size="sm" color="lmFg.body" mb={2}>
                      Other
                    </Heading>
                    <Divider mb={3} />
                  </>
                )}
                {untopiced.map((item) => (
                  <MaterialRow
                    key={item._id}
                    item={item}
                    classId={classId}
                    isTeacher={isTeacher}
                    onChanged={afterSave}
                    onEdit={openEdit}
                  />
                ))}
              </Box>
            )}
          </>
        )}
      </Box>

      {isTeacher && (
        <Box w={{ base: '100%', lg: '260px' }} flexShrink={0} order={{ base: 1, lg: 2 }}>
          <TopicManager classId={classId} topics={topics} onChanged={afterSave} />
        </Box>
      )}

      <MaterialModal
        isOpen={isOpen}
        onClose={onClose}
        classId={classId}
        topics={topics}
        onSaved={afterSave}
        initial={editing}
      />
    </Flex>
  );
}
