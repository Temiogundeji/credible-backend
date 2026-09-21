export class ContributionApplicationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'ContributionApplicationError';
  }
}
