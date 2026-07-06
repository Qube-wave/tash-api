import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, UnrecoverableError } from 'bullmq';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { NotificationsConfiguration } from 'src/config/notifications.config';
import { NOTIFICATION_QUEUE } from 'src/jobs/job-names';
import { ISendEmail, OtpNotificationData } from './notifications.interface';
import { Resend } from 'resend';
import { emailOtpTemplate } from './email.templates';

@Injectable()
export class NotificationsService {
  private readonly africasTalkingClient: AxiosInstance;
  private readonly resend: Resend;

  private readonly notificationsConfig: NotificationsConfiguration;
  private readonly logger = new Logger(NotificationsService.name);

  private readonly emailFrom: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {
    this.notificationsConfig =
      this.configService.getOrThrow<NotificationsConfiguration>(
        'notifications',
      );

    this.africasTalkingClient = axios.create({
      baseURL: this.notificationsConfig.africasTalkingBaseUrl,
      headers: {
        Accept: 'application/json',
        apiKey: this.notificationsConfig.africasTalkingApiKey.trim(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    this.resend = new Resend(this.notificationsConfig.resendApiKey);
    this.emailFrom = this.notificationsConfig.resendFromEmail;
  }

  async enqueuOtpSmsNotification(data: OtpNotificationData): Promise<void> {
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

  async sendOtpSmsNotification(data: OtpNotificationData): Promise<void> {
    try {
      const message = `Your Tash verification code is ${data.otp}. Do not share this code with anyone. This code is only valid for 15 minutes and 5 attempts`;

      const { to, response } = await this.sendSms({
        phoneNumber: data.phoneNumber!,
        message,
      });

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

      throw error;
    }
  }

  async enqueueOtpEmailNotification(data: OtpNotificationData): Promise<void> {
    try {
      await this.notificationQueue.add('send-email-otp', data);
    } catch (error: unknown) {
      this.logger.error('Could not enqueue email otp', {
        error: this.serializeError(error),
        metadata: this.redactNotificationData(data),
      });
      throw error;
    }
  }

  async sendOtpEmailNotification(data: OtpNotificationData): Promise<void> {
    try {
      const formattedOtp =
        data.otp.length === 6
          ? `${data.otp.slice(0, 3)}-${data.otp.slice(3)}`
          : data.otp;

      const emailHtml = emailOtpTemplate({
        otp: formattedOtp,
        expiresIn: String(data.ttl),
        maxAttempts: String(data.attempts),
        year: String(new Date().getFullYear()),
      });

      await this.sendEmail({
        from: this.emailFrom,
        to: data.email!,
        subject: 'Your Tash Verification code',
        html: emailHtml,
      });
    } catch (error: unknown) {
      this.logger.error('An error occurred while sending OTP', {
        error,
        metadata: this.redactNotificationData(data),
      });

      throw error;
    }
  }

  private async sendEmail(body: ISendEmail) {
    const { error } = await this.resend.emails.send({
      from: body.from,
      to: body.to,
      subject: body.subject,
      html: body.html,
    });

    if (error) {
      this.logger.error(
        `Error sending email to ${body.to} with subject: ${body.subject}`,
        error,
      );
    }
  }

  private async sendSms({
    phoneNumber,
    message,
  }: {
    phoneNumber: string;
    message: string;
  }): Promise<{
    to: string;
    response: AxiosResponse<unknown>;
  }> {
    try {
      const to = this.normalizePhoneNumberForAfricasTalking(phoneNumber);

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

      return {
        to,
        response,
      };
    } catch (error: unknown) {
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
    data: OtpNotificationData,
  ): Omit<OtpNotificationData, 'otp'> & { otp: string } {
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
