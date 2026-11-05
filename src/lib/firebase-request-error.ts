export class FirebaseRequestError extends Error {
  constructor() {
    super('Firebase request failed');
    this.name = 'FirebaseRequestError';
  }
}
