import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Heading,
  Input,
  Select,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  VStack,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { ErrorState, Loading, SectionCard } from '../components/common';
import CircuitCanvas from '../components/lab/CircuitCanvas';
import { InstrumentReadings, Palette, PartInspector } from '../components/lab/BenchPanels';
import ScopeView from '../components/lab/ScopeView';
import { eng } from '../components/lab/format';
import {
  placeComponent,
  removeComponent,
  rotateComponent,
  updateComponent,
} from '../components/lab/benchOps';

/**
 * The bench: where the experiment is actually done.
 *
 * One screen for both audiences, because it is the same bench. A teacher opens it
 * to check the experiment runs; a student opens it to do the experiment. What
 * differs is only what is recorded — a teacher's Run is not stored against
 * anything, and the server enforces that rather than this component.
 *
 * ## Why Run is a request and not a local computation
 *
 * The solver lives on the server and there is only one of it. That means a round
 * trip per Run, which is the right cost: a run is a deliberate act after wiring
 * something up, not a keystroke. The alternative — a second solver in the browser —
 * would drift from the first, and the day it drifted a student would be marked
 * wrong for being right.
 *
 * ## Why the circuit is saved separately from being run
 *
 * A circuit being built is half-finished by definition, and a student who wires
 * three components and closes the tab should not lose them. So the bench saves
 * quietly on a debounce, and Run is a separate deliberate action. The save endpoint
 * accepts an incomplete circuit; the run endpoint does not.
 */
export default function LabBench() {
  const { classId, isTeacher } = useOutletContext();
  const { labId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [lab, setLab] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [circuit, setCircuit] = useState({ components: [], wires: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [analysis, setAnalysis] = useState('dc');
  const [frequency, setFrequency] = useState(50);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const [readings, setReadings] = useState({});
  const [conclusion, setConclusion] = useState('');
  const [submitted, setSubmitted] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const fetched = await lmApi.getLab(classId, labId);
      setLab(fetched);
      setAnalysis((fetched.settings?.analyses || ['dc'])[0] || 'dc');
      setFrequency(fetched.settings?.frequency ?? 50);

      if (isTeacher) {
        setCircuit(fetched.startingCircuit || { components: [], wires: [] });
      } else {
        const mine = await lmApi.myLabAttempt(classId, labId);
        setAttempt(mine.attempt);
        if (mine.attempt) {
          setCircuit(mine.attempt.circuit || { components: [], wires: [] });
          setConclusion(mine.attempt.conclusion || '');
          setReadings(
            Object.fromEntries(
              (mine.attempt.readings || []).map((reading) => [reading.key, reading]),
            ),
          );
        }
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, labId, isTeacher]);

  useEffect(() => {
    load();
  }, [load]);

  /* ─────────────────────────── quiet saving ──────────────────────────── */

  const saveTimer = useRef(null);
  // The last payload queued, so an unmount mid-debounce can still send it.
  const unsaved = useRef(null);

  const queueSave = useCallback(
    (next) => {
      if (isTeacher || !attempt || attempt.status === 'submitted') return;
      unsaved.current = { classId, labId, body: next };
      clearTimeout(saveTimer.current);
      // A second and a half after the last change. Long enough that dragging a
      // component does not fire a request per pixel, short enough that a closed
      // tab loses nothing worth mourning.
      saveTimer.current = setTimeout(async () => {
        try {
          await lmApi.saveLabCircuit(classId, labId, next);
          unsaved.current = null;
        } catch {
          // Deliberately silent. A failed background save is not something to
          // interrupt someone mid-experiment with — Run and Submit both send the
          // circuit again, so nothing is lost by this one not landing.
        }
      }, 1500);
    },
    [classId, labId, isTeacher, attempt],
  );

  /**
   * On the way out, send whatever the debounce had not got to yet.
   *
   * Navigating away from a half-built circuit is the most likely way to lose one,
   * and it is also exactly when the 1.5 s timer has not fired. Fire-and-forget,
   * because there is nothing left to show an error to — and it covers navigation
   * within the app rather than the tab being closed, which no amount of care here
   * can make reliable.
   */
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      const pending = unsaved.current;
      if (pending) {
        lmApi.saveLabCircuit(pending.classId, pending.labId, pending.body).catch(() => {});
      }
    },
    [],
  );

  const changeCircuit = (next) => {
    setCircuit(next);
    queueSave({ circuit: next });
  };

  /* ───────────────────────────── running ─────────────────────────────── */

  const run = async () => {
    setRunning(true);
    try {
      const solved = await lmApi.runLab(classId, labId, { circuit, analysis, frequency });
      setResult(solved);
      if (!solved.ok) {
        toast({ status: 'warning', title: 'The circuit did not solve', description: solved.message, duration: 8000 });
      }
    } catch (err) {
      // A 400 here is the server refusing the circuit — a part from another bench,
      // a wire to a terminal that is not there. Worth showing loudly, because it
      // means the bench and the server disagree about what was drawn.
      toast({ status: 'error', title: err.message, duration: 9000 });
    } finally {
      setRunning(false);
    }
  };

  /* ──────────────────────────── submitting ───────────────────────────── */

  const submit = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Submit this experiment? You will not be able to change the bench afterwards.')) {
      return;
    }
    try {
      const outcome = await lmApi.submitLabAttempt(classId, labId, {
        circuit,
        conclusion,
        readings: Object.values(readings),
      });
      setSubmitted(outcome);
      toast({ status: 'success', title: 'Submitted' });
      await load();
    } catch (err) {
      toast({ status: 'error', title: err.message });
    }
  };

  /* ───────────────────────────── derived ─────────────────────────────── */

  const palette = lab?.domainSpec?.parts || [];
  const selected = circuit.components.find((component) => component.id === selectedId) || null;
  const selectedPart = palette.find((part) => part.type === selected?.type) || null;

  const probes = useMemo(
    () => circuit.components.filter((component) => component.type === 'cro' || component.type === 'dso'),
    [circuit],
  );

  /** Meter readings keyed by component id, for the labels on the canvas. */
  const canvasReadings = useMemo(() => {
    if (!result?.ok) return {};
    return Object.fromEntries(
      (result.instruments || [])
        .filter((meter) => meter.type !== 'cro' && meter.type !== 'dso')
        .map((meter) => [meter.id, eng(meter.magnitude, meter.unit)]),
    );
  }, [result]);

  const locked = !isTeacher && (!attempt || attempt.status === 'submitted');
  const canEdit = !locked && (lab?.settings?.allowEditing !== false || isTeacher);

  if (loading) return <Loading label="Setting up the bench…" />;
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!lab) return null;

  return (
    <Box>
      <Flex justify="space-between" align="flex-start" mb={4} gap={3} wrap="wrap">
        <Box>
          <HStack>
            <Heading size="md">{lab.title}</Heading>
            <Badge colorScheme="teal">{lab.domainSpec?.label || lab.domain}</Badge>
            {isTeacher && <Badge colorScheme="blue">Teacher view — nothing is recorded</Badge>}
            {attempt?.status === 'submitted' && <Badge colorScheme="green">Submitted</Badge>}
          </HStack>
          {lab.task && (
            <Text fontSize="sm" color="gray.600" mt={1} maxW="720px">
              {lab.task}
            </Text>
          )}
        </Box>
        <HStack>
          {isTeacher && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/learning/class/${classId}/lab/${labId}/edit`)}>
              Edit experiment
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => navigate(`/learning/class/${classId}/labs`)}>
            Back
          </Button>
        </HStack>
      </Flex>

      {lab.brief && (
        <SectionCard mb={3}>
          <Box fontSize="sm" color="gray.700" dangerouslySetInnerHTML={{ __html: lab.brief }} />
        </SectionCard>
      )}

      {locked && attempt?.status !== 'submitted' && (
        <SectionCard mb={3}>
          <Text fontSize="sm" color="orange.700">
            This experiment is not open to you right now — either it has not started, its due date has
            passed, or you have used all your attempts.
          </Text>
        </SectionCard>
      )}

      <Flex gap={4} align="flex-start" wrap={{ base: 'wrap', lg: 'nowrap' }}>
        {/* The palette. Left, because that is where a parts bin sits. */}
        {canEdit && (
          <Box flex="0 0 210px" minW="200px">
            <SectionCard>
              <Text fontSize="sm" fontWeight="700" mb={2}>
                Components
              </Text>
              <Palette
                parts={palette}
                onPlace={(type) => {
                  // Same helper the canvas's drag-and-drop uses, so a part gets
                  // the same designator and the same defaults either way. It
                  // lands in the middle of the bench, where it is visible and
                  // can be dragged from.
                  const { circuit: next, id } = placeComponent(
                    circuit,
                    type,
                    palette.find((candidate) => candidate.type === type),
                  );
                  changeCircuit(next);
                  setSelectedId(id);
                }}
              />
            </SectionCard>
          </Box>
        )}

        {/* The bench itself. */}
        <Box flex="1 1 auto" minW="320px">
          <SectionCard>
            <Flex justify="space-between" align="center" mb={2} gap={2} wrap="wrap">
              <HStack>
                <Select
                  size="sm"
                  maxW="170px"
                  value={analysis}
                  onChange={(event) => setAnalysis(event.target.value)}
                >
                  {(lab.settings?.analyses || ['dc']).map((option) => (
                    <option key={option} value={option}>
                      {option === 'dc' ? 'DC operating point' : option === 'ac' ? 'AC steady state' : 'Transient (scope)'}
                    </option>
                  ))}
                </Select>
                {analysis !== 'dc' && (
                  <HStack>
                    <Input
                      size="sm"
                      maxW="110px"
                      type="number"
                      value={frequency}
                      onChange={(event) => setFrequency(Number(event.target.value))}
                    />
                    <Text fontSize="xs" color="gray.500">
                      Hz
                    </Text>
                  </HStack>
                )}
              </HStack>
              <Button size="sm" colorScheme="teal" onClick={run} isLoading={running}>
                ▶ Run
              </Button>
            </Flex>

            {/* A frequency of zero is a real setting — a DC supply stepped at
                t = 0 — and the solver treats it as one, so it is worth saying
                rather than letting a student assume it is invalid. */}
            {analysis === 'transient' && Number(frequency) === 0 && (
              <Text fontSize="xs" color="gray.500" mb={2}>
                0 Hz on a transient run is a DC supply switched on at t = 0 — the step response.
              </Text>
            )}

            <CircuitCanvas
              circuit={circuit}
              onChange={changeCircuit}
              palette={palette}
              readOnly={!canEdit}
              selectedId={selectedId}
              onSelect={setSelectedId}
              readings={canvasReadings}
            />

            <Text fontSize="xs" color="gray.500" mt={2}>
              Drag a component on, or click it in the palette. Click one terminal then another to wire
              them. Click a wire to remove it.
            </Text>
          </SectionCard>

          {/* The scopes, one screen each. */}
          {result?.ok && result.analysis === 'transient' && probes.length > 0 && (
            <SectionCard mt={3}>
              <Tabs size="sm" variant="enclosed">
                <TabList>
                  {probes.map((probe) => (
                    <Tab key={probe.id}>{probe.label || probe.id}</Tab>
                  ))}
                </TabList>
                <TabPanels>
                  {probes.map((probe) => (
                    <TabPanel key={probe.id} px={0}>
                      <ScopeView result={result} probe={probe} />
                    </TabPanel>
                  ))}
                </TabPanels>
              </Tabs>
            </SectionCard>
          )}
        </Box>

        {/* Readings and the selected part. */}
        <Box flex="0 0 290px" minW="260px">
          <SectionCard mb={3}>
            <Text fontSize="sm" fontWeight="700" mb={2}>
              Instruments
            </Text>
            <InstrumentReadings result={result} />
          </SectionCard>

          <SectionCard mb={3}>
            <PartInspector
              component={selected}
              part={selectedPart}
              readOnly={!canEdit}
              onChange={(next) => changeCircuit(updateComponent(circuit, next))}
              onRotate={() => changeCircuit(rotateComponent(circuit, selectedId))}
              onDelete={() => {
                // `removeComponent` takes the wires with it. Left behind they
                // would name a component that is not there, and the net solver
                // resolves an unknown pin to ground rather than complaining — so
                // the circuit would still solve, as something nobody drew.
                changeCircuit(removeComponent(circuit, selectedId));
                setSelectedId(null);
              }}
            />
          </SectionCard>

          {/* What the student has to write down. */}
          {!isTeacher && (lab.readings || []).length > 0 && (
            <SectionCard>
              <Text fontSize="sm" fontWeight="700" mb={1}>
                Record your readings
              </Text>
              <Text fontSize="xs" color="gray.500" mb={3}>
                Read these off the instruments and type them in. Show your working for anything you
                worked out rather than measured.
              </Text>
              <VStack align="stretch" spacing={3}>
                {lab.readings.map((wanted) => {
                  const given = readings[wanted.key] || {};
                  const marked = submitted?.readings?.find((row) => row.key === wanted.key);
                  return (
                    <Box key={wanted.key}>
                      <Flex justify="space-between" align="center">
                        <Text fontSize="xs" color="gray.600">
                          {wanted.label}
                          {wanted.unit ? ` (${wanted.unit})` : ''}
                        </Text>
                        <HStack spacing={1}>
                          <Badge fontSize="9px" colorScheme={wanted.source === 'derived' ? 'purple' : 'blue'}>
                            {wanted.source === 'derived' ? 'calculate' : 'measure'}
                          </Badge>
                          {marked?.correct === true && <Text color="green.500">✓</Text>}
                          {marked?.correct === false && <Text color="red.500">✕</Text>}
                        </HStack>
                      </Flex>
                      <Input
                        size="sm"
                        type="number"
                        isDisabled={locked}
                        value={given.value ?? ''}
                        onChange={(event) => {
                          const next = {
                            ...readings,
                            [wanted.key]: {
                              ...given,
                              key: wanted.key,
                              value: event.target.value === '' ? null : Number(event.target.value),
                            },
                          };
                          setReadings(next);
                          queueSave({ circuit, readings: Object.values(next) });
                        }}
                      />
                      {wanted.source === 'derived' && (
                        <Input
                          size="sm"
                          mt={1}
                          placeholder="How you got it"
                          isDisabled={locked}
                          value={given.working ?? ''}
                          onChange={(event) => {
                            const next = {
                              ...readings,
                              [wanted.key]: { ...given, key: wanted.key, working: event.target.value },
                            };
                            setReadings(next);
                            queueSave({ circuit, readings: Object.values(next) });
                          }}
                        />
                      )}
                    </Box>
                  );
                })}

                <Divider />
                <Box>
                  <Text fontSize="xs" color="gray.600" mb={1}>
                    Conclusion
                  </Text>
                  <Textarea
                    size="sm"
                    rows={4}
                    isDisabled={locked}
                    placeholder="What did the experiment show?"
                    value={conclusion}
                    onChange={(event) => {
                      setConclusion(event.target.value);
                      queueSave({ circuit, conclusion: event.target.value });
                    }}
                  />
                </Box>

                {attempt?.status === 'submitted' ? (
                  <Box bg="green.50" p={3} borderRadius="md">
                    <Text fontSize="sm" fontWeight="600" color="green.800">
                      Submitted
                    </Text>
                    {attempt.percent !== null && attempt.percent !== undefined && (
                      <Text fontSize="sm" color="green.800">
                        {attempt.correctCount}/{attempt.checkedCount} readings within tolerance (
                        {attempt.percent}%)
                      </Text>
                    )}
                    {attempt.teacherFeedback && (
                      <Text fontSize="sm" color="gray.700" mt={2}>
                        {attempt.teacherFeedback}
                      </Text>
                    )}
                  </Box>
                ) : (
                  <Button colorScheme="green" size="sm" onClick={submit} isDisabled={locked}>
                    Submit experiment
                  </Button>
                )}
              </VStack>
            </SectionCard>
          )}
        </Box>
      </Flex>
    </Box>
  );
}
