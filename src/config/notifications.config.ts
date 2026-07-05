import { registerAs } from '@nestjs/config';

export interface NotificationsConfiguration {
  termiiApiKey: string;
  termiiBaseUrl: string;
  sendchampBaseUrl: string;
  sendchampApiKey: string;

  africasTalkingBaseUrl: string;
  africasTalkingApiKey: string;
  africasTalkingSenderId: string;
  africasTalkingUsername: string;
}

export default registerAs('notifications', (): NotificationsConfiguration => ({
  termiiApiKey: process.env.TERMII_API_KEY?.trim() ?? '',
  termiiBaseUrl:
    process.env.TERMII_BASE_URL?.trim() ?? 'https://api.ng.termii.com',
  sendchampBaseUrl:
    process.env.SENDCHAMP_BASE_URL?.trim() ??
    'https://api.sendchamp.com/api/v1',
  sendchampApiKey: process.env.SENDCHAMP_API_KEY?.trim() ?? '',
  africasTalkingBaseUrl:
    process.env.AFRICAS_TALKING_BASE_URL?.trim() ??
    'https://api.africastalking.com',
  africasTalkingApiKey: process.env.AFRICAS_TALKING_API_KEY?.trim() ?? '',
  africasTalkingSenderId: process.env.AFRICAS_TALKING_SENDER_ID?.trim() ?? '',
  africasTalkingUsername: process.env.AFRICAS_TALKING_USERNAME?.trim() ?? '',
}));
