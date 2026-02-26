/**
 * Shared shutdown state so long-running work (e.g. model discovery) can bail out
 * before MongoDB is closed on SIGINT/SIGTERM.
 */
let isShuttingDown = false;

export function setShuttingDown() {
  isShuttingDown = true;
}

export function getShuttingDown() {
  return isShuttingDown;
}
