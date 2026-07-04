import { registerAs } from '@nestjs/config';

export interface NotificationsConfiguration {
  termiiApiKey: string;
}

export default registerAs('notifications', (): NotificationsConfiguration => ({
  termiiApiKey: process.env.TERMII_API_KEY ?? '',
}));
