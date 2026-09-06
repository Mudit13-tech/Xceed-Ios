/**
 * Chart colours for the learning module, in one place.
 *
 * The categorical slots are fixed and assigned in order, never cycled and never
 * reassigned when a filter drops a series — a colour belongs to "Quizzes", not
 * to "third thing on the chart". Both columns are validated as a set for
 * colourblind separation against the surface they sit on (worst adjacent pair
 * ΔE 9.1 light / 8.4 dark, OKLab ×100). Three of the light steps land under 3:1
 * against a white card, which is allowed only with relief: every chart that uses
 * them is either directly labelled or repeated in a table, so no number is ever
 * carried by hue alone.
 *
 * Lives outside the component file so that file exports components only, which
 * is what keeps fast refresh working.
 */
import { useColorModeValue } from '@chakra-ui/react';

const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];

/** Chart colours for the current colour mode. */
export function useChartTheme() {
  const series = useColorModeValue(SERIES_LIGHT, SERIES_DARK);
  const grid = useColorModeValue('#E2E8F0', '#4A5568');
  const axis = useColorModeValue('#4A5568', '#A0AEC0');
  // The card the chart is drawn on — used as the gap between stacked segments,
  // which is what keeps two adjacent fills from reading as one block.
  const surface = useColorModeValue('#FFFFFF', '#2D3748');
  return { series, grid, axis, surface };
}
