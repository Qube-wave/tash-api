export interface OtpNotificationData {
  email?: string;
  phoneNumber?: string;
  otp: string;
  attempts: number;
  ttl: number;
  length: 6;
}

export interface ISendEmail {
  from: string;
  to: string;
  subject: string;
  html: string;
}
