import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfiguration } from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);

  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfiguration>('app');

  await app.listen(appConfig.port);
}

void bootstrap();
