import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { BvnService, BvnStatusResponse } from './bvn.service';
import { VerifyBvnDto } from './dto/verify-bvn.dto';

@ApiTags('bvn')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bvn')
export class BvnController {
  constructor(private readonly bvnService: BvnService) {}

  @Post('verify')
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyBvnDto,
  ): Promise<BvnStatusResponse> {
    return this.bvnService.verify(user.uuid, dto);
  }

  @Get('status')
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BvnStatusResponse> {
    return this.bvnService.getStatus(user.uuid);
  }

  @Post('retry')
  retry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyBvnDto,
  ): Promise<BvnStatusResponse> {
    return this.bvnService.retry(user.uuid, dto);
  }
}
