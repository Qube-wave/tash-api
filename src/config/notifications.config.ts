import { registerAs } from '@nestjs/config';

export interface NotificationsConfiguration {
  africasTalkingBaseUrl: string;
  africasTalkingApiKey: string;
  africasTalkingSenderId: string;
  africasTalkingUsername: string;

  resendApiKey: string;
  resendFromEmail: string;
}

export default registerAs('notifications', (): NotificationsConfiguration => ({
  africasTalkingBaseUrl:
    process.env.AFRICAS_TALKING_BASE_URL?.trim() ??
    'https://api.africastalking.com',
  africasTalkingApiKey: process.env.AFRICAS_TALKING_API_KEY?.trim() ?? '',
  africasTalkingSenderId: process.env.AFRICAS_TALKING_SENDER_ID?.trim() ?? '',
  africasTalkingUsername: process.env.AFRICAS_TALKING_USERNAME?.trim() ?? '',

  resendApiKey: process.env.RESEND_API_KEY?.trim() ?? '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL?.trim() ?? '',
}));
