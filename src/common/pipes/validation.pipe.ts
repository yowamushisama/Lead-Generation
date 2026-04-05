import { ValidationPipe as NestValidationPipe, ValidationPipeOptions } from '@nestjs/common';

const defaultOptions: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
  validationError: {
    target: false,
    value: false,
  },
};

export class AppValidationPipe extends NestValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super({
      ...defaultOptions,
      ...options,
    });
  }
}
