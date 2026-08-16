import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** Error type that route handlers throw to produce a clean JSON response. */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, 'bad_request', details);
  }
  static unauthorized(message = 'You need to sign in to continue.') {
    return new ApiError(401, message, 'unauthorized');
  }
  static forbidden(message = 'You do not have access to this resource.') {
    return new ApiError(403, message, 'forbidden');
  }
  static notFound(message = 'Not found.') {
    return new ApiError(404, message, 'not_found');
  }
  static conflict(message: string) {
    return new ApiError(409, message, 'conflict');
  }
  static tooMany(message = 'Too many attempts. Please wait a moment and try again.') {
    return new ApiError(429, message, 'rate_limited');
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as Record<string, unknown>, { status });
}

/**
 * Wraps a route handler so every thrown error becomes a predictable JSON body:
 * `{ error: string, code: string, details?: unknown }`.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse | Response>,
) {
  return async (...args: Args): Promise<NextResponse | Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details ?? undefined },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    const first = error.issues[0];
    return NextResponse.json(
      {
        error: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input.',
        code: 'validation_error',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 422 },
    );
  }

  const err = error as { code?: string; meta?: { target?: string[] } };
  if (err?.code === 'P2002') {
    const target = err.meta?.target?.join(', ') ?? 'field';
    return NextResponse.json(
      { error: `That ${target} is already in use.`, code: 'conflict' },
      { status: 409 },
    );
  }
  if (err?.code === 'P2025') {
    return NextResponse.json({ error: 'Record not found.', code: 'not_found' }, { status: 404 });
  }

  console.error('[api] Unhandled error:', error);
  return NextResponse.json(
    {
      error: 'Something went wrong on our side. Please try again.',
      code: 'internal_error',
    },
    { status: 500 },
  );
}

/** Parses a JSON request body, converting malformed JSON into a 400. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw ApiError.badRequest('Request body must be valid JSON.');
  }
}

export function clientIp(request: Request): string | undefined {
  const h = request.headers;
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    undefined
  );
}
