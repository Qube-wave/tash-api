export function assertNotSelfTransfer(
  senderUserId: number,
  recipientUserId: number,
): void {
  if (senderUserId === recipientUserId) {
    throw new Error('Self transfer is not allowed.');
  }
}

export function assertTransferCurrencyMatchesWallet(
  requestedCurrency: string,
  walletCurrency: string,
): void {
  if (requestedCurrency.toUpperCase() !== walletCurrency.toUpperCase()) {
    throw new Error('Transfer currency must match wallet currency.');
  }
}
