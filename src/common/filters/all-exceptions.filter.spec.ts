import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ErrorCodes } from '../api-response/api-response';

function mockHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = {
    url: '/api/v1/test',
    requestId: 'req-123',
    headers: {},
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  };
  return { host: host as never, response, json, status };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('maps a NotFoundException to the standard error envelope', () => {
    const { host, status, json } = mockHost();
    const exception = new NotFoundException('Resource not found');
    filter.catch(exception as HttpException, host);

    expect(status).toHaveBeenCalledWith(404);
    const body = json.mock.calls[0][0];
    expect(body).toMatchObject({
      success: false,
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: 'Resource not found',
        requestId: 'req-123',
        path: '/api/v1/test',
      },
    });
    expect(body.error.timestamp).toBeDefined();
  });

  it('aggregates validation messages into details', () => {
    const { host, json } = mockHost();
    const exception = new BadRequestException(['name must not be empty', 'price is required']);
    filter.catch(exception as HttpException, host);

    const body = json.mock.calls[0][0];
    expect(body.error.code).toBe(ErrorCodes.BAD_REQUEST);
    expect(body.error.details).toEqual(['name must not be empty', 'price is required']);
  });

  it('masks unknown errors as INTERNAL_SERVER_ERROR with 500', () => {
    const { host, status, json } = mockHost();
    filter.catch(new Error('boom') as never, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0].error.code).toBe(ErrorCodes.INTERNAL);
    expect(json.mock.calls[0][0].error.message).toBe('Internal server error');
  });
});
