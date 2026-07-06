import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATION_QUEUE } from 'src/jobs/job-names';
import { OtpNotificationData } from './notifications.interface';
import { NotificationsService } from './notifications.service';

const SEND_SMS_OTP_JOB = 'send-sms-otp';
const SEND_EMAIL_OTP_JOB = 'send-email-otp';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOtpSmsNotificationData(
  value: unknown,
): value is OtpNotificationData {
  return (
    isRecord(value) &&
    typeof value.phoneNumber === 'string' &&
    typeof value.otp === 'string' &&
    typeof value.attempts === 'number' &&
    typeof value.ttl === 'number' &&
    value.length === 6
  );
}

@Processor(NOTIFICATION_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notificationService: NotificationsService) {
    super();
  }

  async process(job: Job<unknown, void, string>): Promise<void> {
    if ((job.name = SEND_SMS_OTP_JOB)) {
      if (!isOtpSmsNotificationData(job.data)) {
        throw new Error(`Invalid notification job payload: ${job.name}`);
      }

      await this.notificationService.sendOtpSmsNotification(job.data);
    } else if (job.name === SEND_EMAIL_OTP_JOB) {
      if (!isOtpSmsNotificationData(job.data)) {
        throw new Error(`Invalid notification job payload: ${job.name}`);
      }

      await this.notificationService.sendOtpEmailNotification(job.data);
    }
  }

  @OnWorkerEvent('completed')
  onSuccess(job: Job<unknown, unknown, string>): void {
    this.logger.log(`[ Job completed ] Name: ${job.name} Id: ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailure(
    job: Job<unknown, unknown, string> | undefined,
    error: Error,
  ): void {
    const jobLabel =
      job === undefined ? 'unknown' : `${job.name} Id: ${job.id}`;
    this.logger.error(
      `[ Job failed ] Name: ${jobLabel}`,
      error.stack ?? error.message,
    );
  }
}
