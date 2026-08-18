import React, { useMemo } from 'react';
import { Badge, Box, Flex, HStack, SimpleGrid, Text } from '@chakra-ui/react';
import { eng } from './format';

/**
 * The oscilloscope screen.
 *
 * ## Why a CRO and a DSO are drawn differently
 *
 * They are not two names for the same instrument, and a lab that treated them as
 * one would be teaching that they are. A cathode-ray oscilloscope shows you a
 * trace, and every number you want off it you get by counting divisions and
 * multiplying by the time base — which is the skill the instrument teaches. A
 * digital storage oscilloscope measures the waveform and prints the numbers.
 *
 * So a CRO here gets a graticule and no numbers, and a DSO gets the same trace
 * plus the measurement panel a real one shows: peak-to-peak, RMS, mean, period,
 * frequency. A student asked to find the RMS value of a rectified sine learns
 * something quite different depending on which one is on the bench, and now the
 * teacher can choose.
 *
 * ## The measurements
 *
 * Computed here from the samples the solver returned, not asked for from the
 * server. They are properties of a trace rather than of a circuit — RMS is
 * √(mean of squares) whatever produced the samples — and computing them beside
 * the drawing keeps them consistent with what is on screen. The period is found
 * from zero crossings of the mean-removed signal, which is what a real DSO's
 * trigger does and which gets the right answer for a rectified or clipped wave
 * where "the frequency of the source" would not.
 */

/** Divisions, as on the real thing: 10 across, 8 down. */
const DIV_X = 10;
const DIV_Y = 8;

const WIDTH = 620;
const HEIGHT = 320;

/** Peak-to-peak, RMS, mean, and the period from zero crossings. */
function measure(samples, times) {
  if (!samples?.length) return null;

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let squares = 0;

  samples.forEach((value) => {
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
    squares += value * value;
  });

  const mean = sum / samples.length;
  const rms = Math.sqrt(squares / samples.length);

  // Zero crossings of the AC part. Removing the mean first is what makes this work
  // for a rectified wave, whose "zero crossings" without it are none at all.
  const crossings = [];
  for (let i = 1; i < samples.length; i += 1) {
    const previous = samples[i - 1] - mean;
    const current = samples[i] - mean;
    if (previous <= 0 && current > 0) {
      // Linear interpolation between the two samples, so the period does not
      // quantise to the step size — at 200 points a cycle that would be a 0.5%
      // error in the frequency, which is visible.
      const fraction = previous === current ? 0 : -previous / (current - previous);
      crossings.push(times[i - 1] + (times[i] - times[i - 1]) * fraction);
    }
  }

  // Averaged over every cycle captured rather than taken from the first two: one
  // period measured off a noisy first cycle is the classic wrong reading.
  const period =
    crossings.length >= 2
      ? (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1)
      : null;

  return {
    min,
    max,
    peakToPeak: max - min,
    mean,
    rms,
    period,
    frequency: period ? 1 / period : null,
  };
}

export default function ScopeView({ result, probe }) {
  const trace = useMemo(
    () => (result?.traces || []).find((candidate) => candidate.id === probe?.id) || null,
    [result, probe],
  );

  const stats = useMemo(() => measure(trace?.samples, result?.times), [trace, result]);

  if (!result?.ok) return null;
  if (!trace) {
    return (
      <Text fontSize="sm" color="lmFg.muted">
        No trace — this probe is not wired to anything, or the run was not a transient one.
      </Text>
    );
  }

  const isDso = probe?.type === 'dso';
  const samples = trace.samples || [];
  const times = result.times || [];

  // A symmetric vertical scale about zero, rounded up to something a division
  // would actually be set to. A scope's Y axis is not auto-fitted to the data:
  // it is set in volts per division, and a trace that filled the screen exactly
  // would hide the fact that it is nearly clipping.
  const peak = Math.max(Math.abs(stats?.min ?? 0), Math.abs(stats?.max ?? 0), 1e-9);
  const perDivisionRaw = (peak * 2) / (DIV_Y - 2);
  const exponent = Math.floor(Math.log10(perDivisionRaw));
  const mantissa = perDivisionRaw / 10 ** exponent;
  const nice = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10;
  const voltsPerDivision = nice * 10 ** exponent;
  const fullScale = (voltsPerDivision * DIV_Y) / 2;

  const duration = times[times.length - 1] || 1;
  const secondsPerDivision = duration / DIV_X;

  const x = (index) => (times[index] / duration) * WIDTH;
  const y = (value) => HEIGHT / 2 - (value / fullScale) * (HEIGHT / 2);

  const path = samples.map((value, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`).join(' ');

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={2}>
        <HStack>
          <Text fontSize="sm" fontWeight="700">
            {probe.label || probe.type.toUpperCase()}
          </Text>
          <Badge colorScheme={isDso ? 'purple' : 'green'}>{isDso ? 'DSO' : 'CRO'}</Badge>
          {trace.thinned && (
            <Badge colorScheme="gray" fontSize="9px">
              stored at reduced resolution
            </Badge>
          )}
        </HStack>
        <HStack fontSize="10px" color="lmFg.muted">
          <Text>{eng(voltsPerDivision, 'V')}/div</Text>
          <Text>{eng(secondsPerDivision, 's')}/div</Text>
        </HStack>
      </Flex>

      {/* The screen. Dark, because a scope screen is, and because a thin bright
          trace on dark is far easier to follow than the reverse. */}
      <Box
        as="svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        bg="#0B1220"
        borderRadius="md"
        borderWidth="1px"
        // The bezel of a dark screen, so it stays dark in light mode too — this
        // is not a `lmBorder` token and should not become one.
        borderColor="gray.700"
      >
        {/* The graticule. This is the instrument on a CRO: the divisions are how
            a reading is taken. */}
        {Array.from({ length: DIV_X + 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={(i / DIV_X) * WIDTH}
            y1={0}
            x2={(i / DIV_X) * WIDTH}
            y2={HEIGHT}
            stroke={i === DIV_X / 2 ? '#4A5568' : '#1F2937'}
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: DIV_Y + 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={(i / DIV_Y) * HEIGHT}
            x2={WIDTH}
            y2={(i / DIV_Y) * HEIGHT}
            stroke={i === DIV_Y / 2 ? '#4A5568' : '#1F2937'}
            strokeWidth={1}
          />
        ))}

        <path d={path} fill="none" stroke="#68D391" strokeWidth={2} strokeLinejoin="round" />
      </Box>

      {isDso ? (
        // The measurement panel a digital scope prints for you.
        <SimpleGrid columns={{ base: 3, md: 6 }} spacing={2} mt={2}>
          {[
            ['Vpp', eng(stats.peakToPeak, 'V')],
            ['Vmax', eng(stats.max, 'V')],
            ['Vmin', eng(stats.min, 'V')],
            ['Vrms', eng(stats.rms, 'V')],
            ['Vmean', eng(stats.mean, 'V')],
            ['Freq', stats.frequency ? eng(stats.frequency, 'Hz') : '—'],
          ].map(([label, value]) => (
            <Box key={label} bg="lmBg.sunken" borderRadius="md" p={2} textAlign="center">
              <Text fontSize="9px" color="lmFg.muted" textTransform="uppercase">
                {label}
              </Text>
              <Text fontSize="sm" fontWeight="700">
                {value}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      ) : (
        <Text fontSize="xs" color="lmFg.muted" mt={2}>
          Read the trace off the graticule: count divisions and multiply by{' '}
          {eng(voltsPerDivision, 'V')} per division vertically, {eng(secondsPerDivision, 's')} per
          division horizontally. Put a DSO on the bench if you want the numbers computed for you.
        </Text>
      )}
    </Box>
  );
}

export { measure };
