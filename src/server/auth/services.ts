// Stubs — fully implemented in Phase 2
export async function checkLockout(
  _email: string
): Promise<{ locked: boolean }> {
  return { locked: false };
}

export async function recordFailedAttempt(
  _email: string,
  _userId?: string
): Promise<void> {}

export async function clearAttempts(_email: string): Promise<void> {}
