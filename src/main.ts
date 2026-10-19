
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';


async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3100',
      'https://valiha-thesis.vercel.app/',
    ],
    credentials: true,
  });

  const { ZodValidationPipe } = await import('nestjs-zod');

  app.useGlobalPipes(new ZodValidationPipe());

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
