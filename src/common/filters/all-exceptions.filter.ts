import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCodes, ErrorResponse } from '../api-response/api-response';

interface ErrorInfo {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

function httpErrorToInfo(exception: HttpException): ErrorInfo {
  const status = exception.getStatus();
  const body = exception.getResponse();
  const message =
    typeof body === 'string'
      ? body
      : (body as { message?: string | string[] }).message;
  return {
    status,
    code:
      status === HttpStatus.BAD_REQUEST
        ? ErrorCodes.BAD_REQUEST
        : status === HttpStatus.UNAUTHORIZED
          ? ErrorCodes.UNAUTHORIZED
          : status === HttpStatus.FORBIDDEN
            ? ErrorCodes.FORBIDDEN
            : status === HttpStatus.NOT_FOUND
              ? ErrorCodes.NOT_FOUND
              : status === HttpStatus.CONFLICT
                ? ErrorCodes.CONFLICT
                : status === HttpStatus.UNPROCESSABLE_ENTITY
                  ? ErrorCodes.UNPROCESSABLE
                  : status === HttpStatus.TOO_MANY_REQUESTS
                    ? ErrorCodes.TOO_MANY_REQUESTS
                    : ErrorCodes.BAD_REQUEST,
    message: Array.isArray(message) ? message.join(', ') : (message ?? 'Bad request'),
    details: Array.isArray(message) ? message : undefined,
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request as unknown as { requestId?: string }).requestId;
    const path = request.url;

    let info: ErrorInfo;
    if (exception instanceof HttpException) {
      info = httpErrorToInfo(exception);
    } else if (exception instanceof Error) {
      // Prisma known errors
      if (exception.name === 'PrismaClientKnownRequestError') {
        const prismaErr = exception as { code?: string };
        if (prismaErr.code === 'P2002') {
          info = {
            status: HttpStatus.CONFLICT,
            code: ErrorCodes.CONFLICT,
            message: 'A record with the same unique value already exists.',
          };
        } else if (prismaErr.code === 'P2025') {
          info = {
            status: HttpStatus.NOT_FOUND,
            code: ErrorCodes.NOT_FOUND,
            message: 'The requested record was not found.',
          };
        } else {
          this.logger.error(exception.stack, exception.message);
          info = {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            code: ErrorCodes.INTERNAL,
            message: 'Internal server error',
          };
        }
      } else {
        this.logger.error(exception.stack, exception.message);
        info = {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ErrorCodes.INTERNAL,
          message: 'Internal server error',
        };
      }
    } else {
      info = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCodes.INTERNAL,
        message: 'Internal server error',
      };
    }

    const body: ErrorResponse = {
      success: false,
      error: {
        code: info.code,
        message: info.message,
        ...(info.details !== undefined ? { details: info.details } : {}),
        requestId,
        path,
        timestamp: new Date().toISOString(),
      },
    };

    response.status(info.status).json(body);
  }
}
