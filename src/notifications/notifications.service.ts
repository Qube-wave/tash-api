import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, UnrecoverableError } from 'bullmq';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { NotificationsConfiguration } from 'src/config/notifications.config';
import { NOTIFICATION_QUEUE } from 'src/jobs/job-names';
import { OtpSmsNotificationData } from './notifications.interface';

@Injectable()
export class NotificationsService {
  private readonly termiiClient: AxiosInstance;
  private readonly sendchampClient: AxiosInstance;
  private readonly africasTalkingClient: AxiosInstance;
  private readonly notificationsConfig: NotificationsConfiguration;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {
    this.notificationsConfig =
      this.configService.getOrThrow<NotificationsConfiguration>(
        'notifications',
      );

    this.termiiClient = axios.create({
      baseURL: this.notificationsConfig.termiiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.sendchampClient = axios.create({
      baseURL: this.notificationsConfig.sendchampBaseUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.notificationsConfig.sendchampApiKey}`,
      },
    });

    this.africasTalkingClient = axios.create({
      baseURL: this.notificationsConfig.africasTalkingBaseUrl,
      headers: {
        Accept: 'application/json',
        apiKey: this.notificationsConfig.africasTalkingApiKey.trim(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  async enqueuOtpSmsNotification(data: OtpSmsNotificationData): Promise<void> {
    try {
      await this.notificationQueue.add('send-sms-otp', data);
    } catch (error: unknown) {
      this.logger.error('Could not enqueue sms otp', {
        error: this.serializeError(error),
        metadata: this.redactNotificationData(data),
      });
      throw error;
    }
  }

  async sendOtpSmsNotification(data: OtpSmsNotificationData): Promise<void> {
    try {
      // await this.termiiClient.post('/api/sms/otp/send', {
      //   api_key: this.notificationsConfig.termiiApiKey,
      //   message_type: 'NUMERIC',
      //   to: data.phoneNumber,
      //   from: 'Tash',
      //   channel: 'dnd',
      //   pin_attempts: data.attempts,
      //   pin_time_to_live: data.ttl,
      //   pin_length: data.length,
      //   pin_placeholder: `< 123456 >`,
      //   message_text: `Your phone verification code is < 123456 > \n      // Do not share this code with anyone`,
      //   pin_type: 'NUMERIC',
      // });
      // await this.sendchampClient.post('/verification/create', {
      //   channel: 'sms',
      //   sender: 'Tash',
      //   token_type: 'numeric',
      //   token_length: data.length,
      //   expiration_time: data.ttl,
      //   customer_mobile_number: data.phoneNumber.replace(/^\+/, ''),
      //   meta_data: {
      //     token: data.otp,
      //   },
      //   token: data.otp,
      // });
      //
      //

      const to = this.normalizePhoneNumberForAfricasTalking(data.phoneNumber);

      const message = `Your Tash verification code is ${data.otp}. Do not share this code with anyone. This code is only valid for 15 minutes and 5 attempts`;

      const body = new URLSearchParams();

      body.append(
        'username',
        this.notificationsConfig.africasTalkingUsername.trim(),
      );

      body.append('to', to);
      body.append('message', message);

      // const senderId = this.notificationsConfig.africasTalkingSenderId?.trim();

      // if (senderId) {
      //   body.append('from', senderId);
      // }

      const response: AxiosResponse<unknown> =
        await this.africasTalkingClient.post('/version1/messaging', body);

      this.logger.log('OTP SMS sent successfully', {
        provider: 'africastalking',
        phoneNumber: this.maskPhoneNumber(to),
        response: response.data,
      });
    } catch (error: unknown) {
      this.logger.error('An error occurred while sending OTP', {
        error: this.serializeError(error),
        metadata: this.redactNotificationData(data),
      });

      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 401 || error.response?.status === 407)
      ) {
        throw new UnrecoverableError(
          'Notification provider rejected the configured access key.',
        );
      }

      throw error;
    }
  }

  private normalizePhoneNumberForAfricasTalking(phoneNumber: string): string {
    let cleaned = phoneNumber.trim().replace(/\s+/g, '');

    if (cleaned.startsWith('0')) {
      cleaned = `+234${cleaned.slice(1)}`;
    }

    if (cleaned.startsWith('234')) {
      cleaned = `+${cleaned}`;
    }

    if (!cleaned.startsWith('+')) {
      cleaned = `+${cleaned}`;
    }

    return cleaned;
  }

  private maskPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\s+/g, '');

    if (cleaned.length <= 7) {
      return '****';
    }

    return `${cleaned.slice(0, 4)}****${cleaned.slice(-3)}`;
  }

  private redactNotificationData(
    data: OtpSmsNotificationData,
  ): Omit<OtpSmsNotificationData, 'otp'> & { otp: string } {
    return {
      ...data,
      otp: '[redacted]',
    };
  }

  private serializeError(error: unknown): Record<string, unknown> {
    if (axios.isAxiosError(error)) {
      return {
        message: error.message,
        status: error.response?.status,
        response: error.response?.data,
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
      };
    }

    return { message: String(error) };
  }
}
