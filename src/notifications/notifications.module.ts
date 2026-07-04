import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUE } from 'src/jobs/job-names';

@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 3_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
  ],
  providers: [NotificationsService],
})
export class NotificationsModule {}
