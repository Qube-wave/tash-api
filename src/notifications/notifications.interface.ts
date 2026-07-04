export interface OtpSmsNotificationData {
  phoneNumber: string;
  otp: string;
  attempts: number;
  ttl: number;
  length: 6;
}
