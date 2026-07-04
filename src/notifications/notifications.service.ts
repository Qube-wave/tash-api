import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { NotificationsConfiguration } from 'src/config/notifications.config';
import { OtpSmsNotificationData } from './notifications.interface';
import { InjectQueue } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUE } from 'src/jobs/job-names';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  private termiiClient;
  private notificationsConfig;
  private logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {
    this.termiiClient = axios.create({
      baseURL: 'https://v4.api.termii.com/',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.notificationsConfig =
      this.configService.getOrThrow<NotificationsConfiguration>(
        'notifications',
      );
  }

  async enqueuOtpSmsNotification(data: OtpSmsNotificationData) {
    try {
      await this.notificationQueue.add('send-sms-otp', data);
    } catch (error: unknown) {
      this.logger.error('Could not enqueue sms otp', {
        error,
        metadata: data,
      });
    }
  }

  async sendOtpSmsNotification(data: OtpSmsNotificationData): Promise<void> {
    try {
      await this.termiiClient.post('/api/sms/otp/send', {
        api_key: this.notificationsConfig.termiiApiKey,
        message_type: 'NUMERIC',
        to: data.phoneNumber,
        from: 'Tash <usetash.app>',
        channel: 'generic',
        pin_attempts: data.attempts,
        pin_time_to_live: data.ttl,
        pin_length: data.length,
        pin_placeholder: '< 123456 >',
        message_text:
          'Your phone verification code is < 123456 > \n Do not share this code with anyone',
        pin_type: 'NUMERIC',
      });
    } catch (error: any) {
      const axiosError = error as AxiosError;

      this.logger.error('An error occured while sending OTP', {
        axiosError,
        metadata: {
          ...data,
        },
      });
    }
  }
}
