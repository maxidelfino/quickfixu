// tests/unit/middleware/validation.test.ts
// Unit tests for Zod validation middleware

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../../../src/middleware/validation.middleware';
import { ValidationError } from '../../../src/types/errors.types';

// Helper: create a mock Express Request
function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as Request;
}

// Helper: create a mock Express Response
function mockResponse(): Response {
  return {} as Response;
}

// Helper: create a jest.fn() next
function mockNext(): NextFunction {
  return jest.fn() as NextFunction;
}

describe('validateBody middleware', () => {
  it('should call next() with parsed body when validation passes', () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(2),
    });

    const middleware = validateBody(schema);
    const req = mockRequest({ body: { email: 'test@example.com', name: 'John' } });
    const res = mockResponse();
    const next = mockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'test@example.com', name: 'John' });
  });

  it('should call next(ValidationError) with details when validation fails', () => {
    const schema = z.object({
      email: z.string().email('Invalid email'),
      age: z.number().min(18),
    });

    const middleware = validateBody(schema);
    const req = mockRequest({ body: { email: 'not-an-email', age: 15 } });
    const res = mockResponse();
    const next = mockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = (next as jest.Mock).mock.calls[0][0];
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.statusCode).toBe(400);
    expect(error.details).toBeInstanceOf(Array);
  });

  it('should return field-level error details', () => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });

    const middleware = validateBody(schema);
    const req = mockRequest({ body: { email: 'bad', password: '123' } });
    const res = mockResponse();
    const next = mockNext();

    middleware(req, res, next);

    const error = (next as jest.Mock).mock.calls[0][0] as ValidationError;
    expect(error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
        expect.objectContaining({ field: 'password' }),
      ])
    );
  });
});

describe('validateQuery middleware', () => {
  it('should call next() with parsed query when validation passes', () => {
    const schema = z.object({
      page: z.coerce.number().int().positive(),
      limit: z.coerce.number().int().min(1).max(100),
    });

    const middleware = validateQuery(schema);
    const req = mockRequest({ query: { page: '1', limit: '10' } });
    const res = mockResponse();
    const next = mockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 1, limit: 10 });
  });

  it('should call next(ValidationError) when query validation fails', () => {
    const schema = z.object({
      page: z.coerce.number().int().positive(),
    });

    const middleware = validateQuery(schema);
    const req = mockRequest({ query: { page: '-1' } });
    const res = mockResponse();
    const next = mockNext();

    middleware(req, res, next);

    const error = (next as jest.Mock).mock.calls[0][0] as ValidationError;
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.statusCode).toBe(400);
  });
});

describe('validateParams middleware', () => {
  it('should call next() with parsed params when validation passes', () => {
    const schema = z.object({
      id: z.coerce.number().int().positive(),
    });

    const middleware = validateParams(schema);
    const req = mockRequest({ params: { id: '123' } });
    const res = mockResponse();
    const next = mockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.params).toEqual({ id: 123 });
  });

  it('should call next(ValidationError) when params validation fails', () => {
    const schema = z.object({
      id: z.coerce.number().int().positive(),
    });

    const middleware = validateParams(schema);
    const req = mockRequest({ params: { id: '-5' } });
    const res = mockResponse();
    const next = mockNext();

    middleware(req, res, next);

    const error = (next as jest.Mock).mock.calls[0][0] as ValidationError;
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.statusCode).toBe(400);
  });
});
