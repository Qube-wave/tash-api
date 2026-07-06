import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { NOTIFICATION_QUEUE } from '../jobs/job-names';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'notifications') {
                return {
                  africasTalkingApiKey: 'test-api-key',
                  africasTalkingBaseUrl: 'https://api.africastalking.com',
                  africasTalkingSenderId: '',
                  africasTalkingUsername: 'sandbox',
                  resendApiKey: 'test-resend-key',
                  resendFromEmail: 'Tash <test@example.com>',
                };
              }

              if (key === 'app') {
                return { baseUrl: 'http://localhost:3000' };
              }

              throw new Error(`Unexpected config key: ${key}`);
            }),
          },
        },
        {
          provide: getQueueToken(NOTIFICATION_QUEUE),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
