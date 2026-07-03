export function assertBankTransferAccountNameMatches(
  requestedName: string,
  resolvedName: string,
): void {
  if (
    requestedName.trim().toLowerCase() !== resolvedName.trim().toLowerCase()
  ) {
    throw new Error('Resolved bank account name does not match request.');
  }
}
