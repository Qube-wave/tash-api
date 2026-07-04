import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppConfiguration } from './config/app.config';

export function isCorsOriginAllowed(
  origin: string | undefined,
  appConfig: Pick<AppConfiguration, 'corsOrigins' | 'nodeEnv'>,
): boolean {
  if (origin === undefined || appConfig.corsOrigins.includes(origin)) {
    return true;
  }

  return (
    appConfig.nodeEnv !== 'production' && appConfig.corsOrigins.length === 0
  );
}

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfiguration>('app');

  app.use(
    helmet({
      // 1. Relax Cross-Origin Resource Policy so other ports can read the API data
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'unsafe-none' },

      // 2. Keep your working CSP configuration below
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          scriptSrc: [`'self'`, `'unsafe-inline'`, `https://cloudflare.com`],
          styleSrc: [`'self'`, `'unsafe-inline'`, `https://cloudflare.com`],
          imgSrc: [`'self'`, `data:`, `validator.swagger.io`],
        },
      },
    }),
  );

  const corsOptions: CorsOptions = {
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      callback(null, isCorsOriginAllowed(origin, appConfig));
    },
    credentials: true,
  };

  app.enableCors(corsOptions);
  app.setGlobalPrefix(appConfig.apiPrefix, {
    exclude: ['health', 'health/readiness'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Tash API')
      .setDescription('Payments API for Tash.')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey(
        {
          type: 'apiKey',
          name: 'Idempotency-Key',
          in: 'header',
        },
        'idempotency-key',
      )
      .build(),
  );

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
