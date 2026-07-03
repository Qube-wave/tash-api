export function maskBvn(bvn: string): string {
  return `${bvn.slice(0, 3)}*****${bvn.slice(-3)}`;
}

export function namesMatch(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export interface BvnStatusProviderResult {
  verificationStatus: 'pending' | 'verified' | 'failed' | 'rejected';
  verifiedFirstName?: string;
  verifiedLastName?: string;
  verifiedDateOfBirth?: string;
}

export interface BvnIdentityInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

export type NormalizedBvnStatus =
  'pending' | 'verified' | 'failed' | 'rejected';

export function determineBvnStatus(
  input: BvnIdentityInput,
  result: BvnStatusProviderResult,
): NormalizedBvnStatus {
  if (result.verificationStatus === 'pending') return 'pending';
  if (result.verificationStatus === 'failed') return 'failed';
  if (result.verificationStatus === 'rejected') return 'rejected';

  const firstNameMatches =
    result.verifiedFirstName === undefined ||
    namesMatch(input.firstName, result.verifiedFirstName);
  const lastNameMatches =
    result.verifiedLastName === undefined ||
    namesMatch(input.lastName, result.verifiedLastName);
  const dobMatches =
    result.verifiedDateOfBirth === undefined ||
    input.dateOfBirth === result.verifiedDateOfBirth;

  return firstNameMatches && lastNameMatches && dobMatches
    ? 'verified'
    : 'rejected';
}
