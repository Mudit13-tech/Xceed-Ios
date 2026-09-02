import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
} from '@chakra-ui/react';

/**
 * Builds a data table for a parameterised question, cell by cell.
 *
 * Cells are plain text and take {{variable}} the same way a prompt does, so the
 * given values differ per student. The chips along the top drop a placeholder
 * into whichever cell was last focused — the same gesture as the prompt's
 * variable bar, because it is the same job.
 *
 * The table is not written into the prompt's HTML. The editor is Quill 1.3.7,
 * which has no table blot and would flatten one back to paragraphs on the next
 * keystroke; instead the caller stores the table on the question and drops a
 * `{{table:key}}` token at the cursor, which survives editing because it is
 * just characters.
 */

const blankGrid = (rows, columns) =>
  Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''));

export default function TableBuilderModal({ isOpen, onClose, onSave, variables = [], initial = null }) {
  const [caption, setCaption] = useState('');
  const [header, setHeader] = useState(['', '']);
  const [rows, setRows] = useState(blankGrid(2, 2));
  // Which cell a variable chip should land in: the last one the teacher touched.
  const focused = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setCaption(initial?.caption || '');
    setHeader(initial?.header?.length ? [...initial.header] : ['', '']);
    setRows(initial?.rows?.length ? initial.rows.map((row) => [...row]) : blankGrid(2, 2));
    focused.current = null;
  }, [isOpen, initial]);

  const columnCount = Math.max(header.length, ...rows.map((row) => row.length), 1);

  const setHeaderCell = (index, value) =>
    setHeader(header.map((cell, i) => (i === index ? value : cell)));

  const setBodyCell = (rowIndex, columnIndex, value) =>
    setRows(rows.map((row, r) => (r === rowIndex ? row.map((cell, c) => (c === columnIndex ? value : cell)) : row)));

  const addColumn = () => {
    setHeader([...header, '']);
    setRows(rows.map((row) => [...row, '']));
  };

  const removeColumn = () => {
    if (columnCount <= 1) return;
    setHeader(header.slice(0, -1));
    setRows(rows.map((row) => row.slice(0, -1)));
  };

  const addRow = () => setRows([...rows, Array.from({ length: columnCount }, () => '')]);
  const removeRow = () => rows.length > 1 && setRows(rows.slice(0, -1));

  /** Drops {{name}} into the last focused cell, at its cursor. */
  const insertVariable = (name) => {
    const target = focused.current;
    const token = `{{${name}}}`;
    if (!target) return;

    const apply = (current) => {
      const at = target.cursor ?? String(current).length;
      return `${String(current).slice(0, at)}${token}${String(current).slice(at)}`;
    };

    if (target.kind === 'caption') setCaption(apply(caption));
    else if (target.kind === 'header') setHeaderCell(target.column, apply(header[target.column] || ''));
    else setBodyCell(target.row, target.column, apply(rows[target.row]?.[target.column] || ''));
  };

  const track = (descriptor) => ({
    onFocus: (event) => {
      focused.current = { ...descriptor, cursor: event.target.selectionStart };
    },
    onBlur: (event) => {
      focused.current = { ...descriptor, cursor: event.target.selectionStart };
    },
  });

  const save = () => {
    onSave({
      caption: caption.trim(),
      header: header.map((cell) => String(cell)),
      rows: rows.map((row) => row.map((cell) => String(cell))),
    });
    onClose();
  };

  const isEmpty = !header.some(Boolean) && !rows.some((row) => row.some(Boolean));

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {initial ? 'Edit table' : 'Insert table'}
          <Text fontSize="sm" fontWeight="400" color="lmFg.muted">
            {initial
              ? 'Changes apply wherever this table already appears.'
              : 'The table is dropped in at the cursor when you insert it.'}
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={3}>
            <FormLabel fontSize="sm">Caption (optional)</FormLabel>
            <Input
              size="sm"
              value={caption}
              placeholder="Given values"
              {...track({ kind: 'caption' })}
              onChange={(event) => setCaption(event.target.value)}
            />
          </FormControl>

          {variables.length > 0 && (
            <Box mb={3} p={2} bg="lmHue.blue50" borderRadius="md">
              <HStack spacing={2} wrap="wrap">
                <Text fontSize="xs" color="lmFg.muted">
                  Insert variable into the last cell you clicked:
                </Text>
                {variables.map((name) => (
                  <Tooltip key={name} label={`Put {{${name}}} in that cell`}>
                    <Button size="xs" variant="outline" fontFamily="mono" onClick={() => insertVariable(name)}>
                      {`{{${name}}}`}
                    </Button>
                  </Tooltip>
                ))}
              </HStack>
            </Box>
          )}

          <Flex gap={2} mb={2} wrap="wrap">
            <Button size="xs" variant="outline" onClick={addRow}>
              + Row
            </Button>
            <Button size="xs" variant="outline" onClick={removeRow} isDisabled={rows.length <= 1}>
              − Row
            </Button>
            <Button size="xs" variant="outline" onClick={addColumn}>
              + Column
            </Button>
            <Button size="xs" variant="outline" onClick={removeColumn} isDisabled={columnCount <= 1}>
              − Column
            </Button>
          </Flex>

          <Box overflowX="auto">
            <Table
              size="sm"
              variant="simple"
              // Fixed layout so the columns divide the modal evenly however many
              // there are — otherwise one long cell drags the grid wider than
              // the dialog and the rest collapse to nothing.
              sx={{
                tableLayout: 'fixed',
                width: '100%',
                minWidth: `${Math.max(320, columnCount * 150)}px`,
                'th, td': { borderColor: 'lmBorder.base', verticalAlign: 'top' },
              }}
            >
              <Thead>
                <Tr>
                  {header.map((cell, index) => (
                    <Th key={index} px={1}>
                      <Input
                        size="sm"
                        fontWeight="700"
                        placeholder={`Heading ${index + 1}`}
                        value={cell}
                        aria-label={`Heading ${index + 1}`}
                        {...track({ kind: 'header', column: index })}
                        onChange={(event) => setHeaderCell(index, event.target.value)}
                      />
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((row, rowIndex) => (
                  <Tr key={rowIndex}>
                    {row.map((cell, columnIndex) => (
                      <Td key={columnIndex} px={1}>
                        <Input
                          size="sm"
                          value={cell}
                          aria-label={`Row ${rowIndex + 1} column ${columnIndex + 1}`}
                          {...track({ kind: 'body', row: rowIndex, column: columnIndex })}
                          onChange={(event) => setBodyCell(rowIndex, columnIndex, event.target.value)}
                        />
                      </Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          <Text fontSize="xs" color="lmFg.muted" mt={2}>
            Leave a heading blank to use the table without a header row. Cells take{' '}
            {'{{variable}}'} anywhere in their text.
          </Text>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" colorScheme="blue" onClick={save} isDisabled={isEmpty}>
            {initial ? 'Save table' : 'Insert at cursor'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
