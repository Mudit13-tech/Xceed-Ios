// client/src/attendancemodule/NodeConsole.jsx
// Reachable via the "Server" status pill's "View Console" action
// (HealthDashboard.jsx) — same pattern as H100 -> /attendance/gpu.

import getEnvironment from '../getenvironment';
import { styles, cssReset } from './config';
import ServiceConsole from './ServiceConsole';
import ServerMetricsPanel from './ServerMetricsPanel';
import ErrorConsole from './ErrorConsole';

const apiUrl = getEnvironment();
const NODE_LOGS_URL = `${apiUrl}/api/v1/attendancemodule/health/node-logs`;

export default function NodeConsole() {
  return (
    <div style={styles.page}>
      <style>{cssReset}</style>
      {/* Above the log, not below it. The question that brings anyone to this page
          is "is the server all right", and the log cannot answer it: a process
          whose event loop is blocked prints nothing unusual. The summary belongs
          where it is read first. */}
      <ServerMetricsPanel />
      <ServiceConsole
        title="Node.js Server Console"
        subtitle="Latest output from the Express backend process"
        logsUrl={NODE_LOGS_URL}
        defaultLoggerLabel="node"
      />
      {/* Below the log rather than above it, because it is the answer to a
          question the log has already raised: the summary says "12 server
          errors in the last minute", the log shows them buried in everything
          else, and this pulls just those out. Reading order follows that. */}
      <ErrorConsole />
    </div>
  );
}
