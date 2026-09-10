import React from 'react';

import LmAdminHodDashboard from './LmAdminHodDashboard';

/**
 * The Dean (Academic) dashboard — its own route, its own gate, its own chunk.
 *
 * The screen itself is the head of department's, in its `dean` variant: the
 * dean's question is the HOD's question asked of every department at once, so
 * the tiles, charts and tables are the same ones over a wider set of classes,
 * plus the department-by-department breakdown the server only sends when the
 * view spans more than one. A second implementation would be a second set of
 * arithmetic free to drift, and the first bug would be a figure that meant one
 * thing on the dean's screen and something else on a head of department's.
 *
 * What is genuinely separate is everything around it: `/learning/dean-dashboard`
 * behind `RequireDean`, served by `/dean/dashboard` behind `requireDean`, and
 * reached from a nav item only a DEAN account is shown. See VARIANTS in
 * LmAdminHodDashboard for the differences the variant carries.
 */
export default function LmDeanDashboard() {
  return <LmAdminHodDashboard variant="dean" />;
}
