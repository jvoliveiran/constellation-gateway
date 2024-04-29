import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { useContainer } from 'class-validator';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

export const createTestModule = () => {
  let prisma: PrismaService | null;
  let moduleFixture: TestingModule | null;
  let app: INestApplication | null;

  const init = async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidUnknownValues: false,
      }),
    );
    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    await app.init();
    prisma = (await app.get(PrismaService)) as PrismaService;
    return { prisma, app };
  };

  const close = async () => {
    if (app) await app.close();
    if (moduleFixture) await moduleFixture.close();

    app = null;
    prisma = null;
    moduleFixture = null;
  };

  return { init, close };
};
