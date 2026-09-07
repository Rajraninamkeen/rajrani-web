import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                env: 'test',
                apiBaseUrl: 'http://localhost:4000',
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(AppController);
  });

  it('should describe the API root', () => {
    const result = controller.getRoot();
    expect(result).toMatchObject({
      name: 'bilokat-api',
      version: '0.1.0',
      env: 'test',
    });
  });
});
