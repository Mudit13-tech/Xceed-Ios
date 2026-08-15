import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  HStack,
  Heading,
  Input,
  Select,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { ErrorState, Loading, SectionCard } from '../components/common';
import RichTextEditor from '../components/RichTextEditor';
import CircuitCanvas from '../components/lab/CircuitCanvas';
import { Palette, PartInspector } from '../components/lab/BenchPanels';
import {
  placeComponent,
  removeComponent,
  rotateComponent,
  updateComponent,
} from '../components/lab/benchOps';

/**
 * Setting up an experiment.
 *
 * Three decisions, in the order a teacher makes them: what the class is asked to
 * do, what bench they get, and what they must write down.
 *
 * ## Why the starting circuit is optional and matters
 *
 * Left empty, the student builds from nothing — the right shape when wiring *is*
 * the skill. Laid out fully, the experiment becomes "predict what this reads, then
 * run it and see", which is a different and equally good lab. Half-built is the
 * most useful of the three: here is the supply and the load, now connect the meters
 * correctly. All three are the same field, so none of them needed a mode switch.
 *
 * ## Why expected values are optional per reading
 *
 * A reading with an expected value is checked automatically. A reading without one
 * is simply collected, and the teacher marks it. Both are wanted: the current
 * through a fixed resistor has one right answer, and "what happens to the power
 * factor as you increase the inductance" does not. Requiring an expected value for
 * everything would have quietly banned the second kind of question.
 */
export default function LabEditor() {
  const { classId } = useOutletContext();
  const { labId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [lab, setLab] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [fetched, cat] = await Promise.all([
        lmApi.getLab(classId, labId),
        lmApi.labCatalogue(classId),
      ]);
      setLab(fetched);
      setCatalogue(cat.domains || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, labId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await lmApi.updateLab(classId, labId, {
        title: lab.title,
        brief: lab.brief,
        task: lab.task,
        domain: lab.domain,
        startingCircuit: lab.startingCircuit,
        readings: lab.readings,
        settings: lab.settings,
      });
      toast({ status: 'success', title: 'Saved' });
      await load();
    } catch (err) {
      toast({
        status: 'error',
        title: err.message,
        description: err.payload?.errors?.slice(0, 3).join(' · '),
        duration: 10000,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Loading the experiment…" />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!lab) return null;

  const domain = catalogue.find((candidate) => candidate.key === lab.domain);
  const palette = domain?.parts || [];
  const circuit = lab.startingCircuit || { components: [], wires: [] };
  const selected = circuit.components.find((component) => component.id === selectedId) || null;
  const selectedPart = palette.find((part) => part.type === selected?.type) || null;

  const set = (patch) => setLab({ ...lab, ...patch });
  const setSettings = (patch) => setLab({ ...lab, settings: { ...lab.settings, ...patch } });
  const setCircuit = (next) => setLab({ ...lab, startingCircuit: next });

  const addReading = () =>
    set({
      readings: [
        ...(lab.readings || []),
        {
          // A key the teacher never sees but the student's answer is matched by,
          // so renaming the label later does not orphan what they typed.
          key: `r${Date.now().toString(36)}`,
          label: '',
          unit: '',
          source: 'instrument',
          expected: null,
          tolerancePercent: 5,
        },
      ],
    });

  const setReading = (index, patch) =>
    set({
      readings: lab.readings.map((reading, i) => (i === index ? { ...reading, ...patch } : reading)),
    });

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4} gap={3} wrap="wrap">
        <Box>
          <Heading size="md">Set up the experiment</Heading>
          <Text fontSize="sm" color="gray.500">
            {domain?.label} bench · {palette.length} components available
          </Text>
        </Box>
        <HStack>
          <Button size="sm" variant="outline" onClick={() => navigate(`/learning/class/${classId}/lab/${labId}`)}>
            Open the bench
          </Button>
          <Button size="sm" colorScheme="teal" onClick={save} isLoading={saving}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/learning/class/${classId}/labs`)}>
            Back
          </Button>
        </HStack>
      </Flex>

      <SectionCard mb={3}>
        <VStack align="stretch" spacing={3}>
          <Box>
            <Text fontSize="sm" fontWeight="600" mb={1}>
              Title
            </Text>
            <Input value={lab.title} onChange={(event) => set({ title: event.target.value })} />
          </Box>

          <Flex gap={3} wrap="wrap">
            <Box flex="1" minW="200px">
              <Text fontSize="sm" fontWeight="600" mb={1}>
                Bench
              </Text>
              <Select value={lab.domain} onChange={(event) => set({ domain: event.target.value })}>
                {catalogue.map((candidate) => (
                  <option key={candidate.key} value={candidate.key}>
                    {candidate.label}
                  </option>
                ))}
              </Select>
              {/* Worth saying plainly: the domain fixes the palette, so moving an
                  experiment to a bench without a transistor on it will reject the
                  transistor already in the circuit rather than quietly drop it. */}
              <Text fontSize="xs" color="gray.500" mt={1}>
                Changing the bench changes which components exist. Anything already placed that the
                new bench does not have will be refused on save.
              </Text>
            </Box>
            <Box flex="1" minW="200px">
              <Text fontSize="sm" fontWeight="600" mb={1}>
                Runs allowed
              </Text>
              <HStack wrap="wrap">
                {(domain?.analyses || []).map((analysis) => (
                  <Checkbox
                    key={analysis}
                    isChecked={(lab.settings.analyses || []).includes(analysis)}
                    onChange={(event) =>
                      setSettings({
                        analyses: event.target.checked
                          ? [...(lab.settings.analyses || []), analysis]
                          : (lab.settings.analyses || []).filter((one) => one !== analysis),
                      })
                    }
                  >
                    <Text fontSize="sm">
                      {analysis === 'dc' ? 'DC' : analysis === 'ac' ? 'AC' : 'Scope'}
                    </Text>
                  </Checkbox>
                ))}
              </HStack>
            </Box>
            <Box flex="0 0 150px">
              <Text fontSize="sm" fontWeight="600" mb={1}>
                Frequency (Hz)
              </Text>
              <Input
                type="number"
                value={lab.settings.frequency ?? 50}
                onChange={(event) => setSettings({ frequency: Number(event.target.value) })}
              />
            </Box>
          </Flex>

          <Box>
            <Text fontSize="sm" fontWeight="600" mb={1}>
              The task
            </Text>
            <Input
              value={lab.task || ''}
              placeholder="Measure the current, voltage and power in a series R–L circuit."
              onChange={(event) => set({ task: event.target.value })}
            />
          </Box>

          <Box>
            <Text fontSize="sm" fontWeight="600" mb={1}>
              Aim, theory and procedure
            </Text>
            <RichTextEditor value={lab.brief || ''} onChange={(html) => set({ brief: html })} />
          </Box>

          <Divider />

          <HStack wrap="wrap" spacing={5}>
            <Checkbox
              isChecked={lab.settings.allowEditing !== false}
              onChange={(event) => setSettings({ allowEditing: event.target.checked })}
            >
              <Text fontSize="sm">Students may change the circuit</Text>
            </Checkbox>
            <Checkbox
              isChecked={!!lab.settings.showExpectedAfterSubmit}
              onChange={(event) => setSettings({ showExpectedAfterSubmit: event.target.checked })}
            >
              <Text fontSize="sm">Show expected values after submitting</Text>
            </Checkbox>
            <HStack>
              <Text fontSize="sm">Attempts</Text>
              <Input
                size="sm"
                type="number"
                maxW="90px"
                value={lab.settings.attemptsAllowed ?? 0}
                onChange={(event) => setSettings({ attemptsAllowed: Number(event.target.value) })}
              />
              <Text fontSize="xs" color="gray.500">
                0 = unlimited
              </Text>
            </HStack>
          </HStack>
        </VStack>
      </SectionCard>

      {/* The starting layout. */}
      <SectionCard mb={3}>
        <Flex justify="space-between" align="center" mb={2}>
          <Box>
            <Text fontSize="sm" fontWeight="600">
              Starting layout
            </Text>
            <Text fontSize="xs" color="gray.500">
              Leave it empty and they build from scratch. Place part of it and they finish the wiring.
              Place all of it and the experiment becomes “predict, then run”.
            </Text>
          </Box>
          {!!circuit.components.length && (
            <Button
              size="xs"
              variant="ghost"
              colorScheme="red"
              onClick={() => setCircuit({ components: [], wires: [] })}
            >
              Clear the bench
            </Button>
          )}
        </Flex>

        <Flex gap={3} align="flex-start" wrap={{ base: 'wrap', lg: 'nowrap' }}>
          <Box flex="0 0 200px" minW="190px">
            <Palette
              parts={palette}
              onPlace={(type) => {
                const { circuit: next, id } = placeComponent(
                  circuit,
                  type,
                  palette.find((part) => part.type === type),
                );
                setCircuit(next);
                setSelectedId(id);
              }}
            />
          </Box>
          <Box flex="1 1 auto" minW="300px">
            <CircuitCanvas
              circuit={circuit}
              onChange={setCircuit}
              palette={palette}
              selectedId={selectedId}
              onSelect={setSelectedId}
              height={400}
            />
          </Box>
          <Box flex="0 0 250px" minW="230px">
            <PartInspector
              component={selected}
              part={selectedPart}
              onChange={(next) => setCircuit(updateComponent(circuit, next))}
              onRotate={() => setCircuit(rotateComponent(circuit, selectedId))}
              onDelete={() => {
                setCircuit(removeComponent(circuit, selectedId));
                setSelectedId(null);
              }}
            />
          </Box>
        </Flex>
      </SectionCard>

      {/* What they must record. */}
      <SectionCard>
        <Flex justify="space-between" align="center" mb={2}>
          <Box>
            <Text fontSize="sm" fontWeight="600">
              Readings to record
            </Text>
            <Text fontSize="xs" color="gray.500">
              Give an expected value and it is checked automatically. Leave it blank and you mark it
              yourself — which is the right choice for anything that has no single right answer.
            </Text>
          </Box>
          <Button size="sm" onClick={addReading}>
            + Add a reading
          </Button>
        </Flex>

        {!(lab.readings || []).length ? (
          <Text fontSize="sm" color="gray.500">
            None yet. Without any, students still build and run the circuit — they just have nothing
            to write down.
          </Text>
        ) : (
          <Table size="sm">
            <Thead>
              <Tr>
                <Th px={1}>What to report</Th>
                <Th px={1}>Unit</Th>
                <Th px={1}>How</Th>
                <Th px={1} isNumeric>
                  Expected
                </Th>
                <Th px={1} isNumeric>
                  ± %
                </Th>
                <Th px={1} />
              </Tr>
            </Thead>
            <Tbody>
              {lab.readings.map((reading, index) => (
                <Tr key={reading.key}>
                  <Td px={1}>
                    <Input
                      size="sm"
                      placeholder="Current through the load"
                      value={reading.label}
                      onChange={(event) => setReading(index, { label: event.target.value })}
                    />
                  </Td>
                  <Td px={1}>
                    <Input
                      size="sm"
                      maxW="70px"
                      placeholder="A"
                      value={reading.unit || ''}
                      onChange={(event) => setReading(index, { unit: event.target.value })}
                    />
                  </Td>
                  <Td px={1}>
                    <Select
                      size="sm"
                      maxW="130px"
                      value={reading.source}
                      onChange={(event) => setReading(index, { source: event.target.value })}
                    >
                      <option value="instrument">Measured</option>
                      <option value="derived">Calculated</option>
                    </Select>
                  </Td>
                  <Td px={1}>
                    <Input
                      size="sm"
                      maxW="110px"
                      type="number"
                      placeholder="—"
                      value={reading.expected ?? ''}
                      onChange={(event) =>
                        setReading(index, {
                          expected: event.target.value === '' ? null : Number(event.target.value),
                        })
                      }
                    />
                  </Td>
                  <Td px={1}>
                    <Input
                      size="sm"
                      maxW="70px"
                      type="number"
                      value={reading.tolerancePercent ?? 5}
                      onChange={(event) =>
                        setReading(index, { tolerancePercent: Number(event.target.value) })
                      }
                    />
                  </Td>
                  <Td px={1}>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() =>
                        set({ readings: lab.readings.filter((_, i) => i !== index) })
                      }
                    >
                      ✕
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <Text fontSize="xs" color="gray.500" mt={3}>
          <Badge colorScheme="blue" mr={1}>
            Measured
          </Badge>
          read straight off an instrument.{' '}
          <Badge colorScheme="purple" mr={1}>
            Calculated
          </Badge>
          worked out from the readings — the student is asked to show their working, which is where a
          wattmeter reading and V × I stop agreeing.
        </Text>
      </SectionCard>
    </Box>
  );
}
