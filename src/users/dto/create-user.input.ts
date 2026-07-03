export interface CreateUserInput {
  email: string;
  phoneNumber: string;
  passwordHash: string;
  paymentTag: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  country: string;
  defaultCurrency: string;
}
