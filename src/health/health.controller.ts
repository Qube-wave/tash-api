import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import type { HealthStatus, ReadinessStatus } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ description: 'API liveness status.' })
  getLiveness(): HealthStatus {
    return this.healthService.getLiveness();
  }

  @Get('readiness')
  @ApiOkResponse({ description: 'API dependency readiness status.' })
  getReadiness(): Promise<ReadinessStatus> {
    return this.healthService.getReadiness();
  }
}
