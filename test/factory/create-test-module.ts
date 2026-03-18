import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

export const createTestModule = () => {
  let moduleFixture: TestingModule | null;
  let app: INestApplication | null;

  const init = async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    return { app };
  };

  const close = async () => {
    if (app) await app.close();
    if (moduleFixture) await moduleFixture.close();

    app = null;
    moduleFixture = null;
  };

  return { init, close };
};
