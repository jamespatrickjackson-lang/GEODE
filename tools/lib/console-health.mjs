const EXPECTED_READ_PIXELS_WARNING =
  /GPU stall due to ReadPixels/i;

function consoleMessageType(message) {
  return String(message?.type ?? message?.level ?? "").toLowerCase();
}

function consoleMessageText(message) {
  return String(message?.text ?? message?.message ?? "");
}

export function isExpectedReadPixelsWarning(message) {
  const type = consoleMessageType(message);
  if (type !== "warning" && type !== "warn") return false;
  return EXPECTED_READ_PIXELS_WARNING.test(consoleMessageText(message));
}

export function classifyConsoleMessages(messages = []) {
  const expectedWarnings = [];
  const unexpected = [];

  for (const message of messages) {
    if (isExpectedReadPixelsWarning(message)) {
      expectedWarnings.push(message);
    } else {
      unexpected.push(message);
    }
  }

  return { expectedWarnings, unexpected };
}
