import { Elysia, ValidationError } from 'elysia';
import { JOSEError } from 'jose/errors';
import { z } from 'zod';

type ErrorLocation = 'body' | 'query' | 'params' | 'headers' | 'cookie' | 'response' | 'unknown';

function validationLocation(error: ValidationError): ErrorLocation {
  const locations: ErrorLocation[] = ['body', 'query', 'params', 'headers', 'cookie', 'response'];
  return locations.find((location) => location === error.type) ?? 'unknown';
}

function toZodError(error: ValidationError): z.ZodError {
  const failures = error.all.length ? error.all : [{ path: '', message: error.message }];
  return new z.ZodError(
    failures.map((failure) => ({
      code: 'custom' as const,
      path: failure.path.split('/').filter(Boolean),
      message: failure.message,
    }))
  );
}

function formatIssues(location: ErrorLocation, error: z.ZodError) {
  return error.issues.map((issue) => ({
    location,
    path: issue.path.join('.') || '(root)',
    code: issue.code,
    message: issue.message,
  }));
}

export const errorHandler = () =>
  new Elysia({ name: 'error-handler' }).onError({ as: 'global' }, ({ code, error, request, set }) => {
    const { method } = request;
    const { pathname } = new URL(request.url);

    if (error instanceof z.ZodError) {
      console.error(JSON.stringify({ level: 'error', kind: 'validation', method, pathname, issues: formatIssues('unknown', error) }));
      set.status = 422;
      return { error: 'invalid_request' };
    }

    if (error instanceof ValidationError) {
      const issues = formatIssues(validationLocation(error), toZodError(error));
      console.error(JSON.stringify({ level: 'error', kind: 'validation', method, pathname, issues }));
      set.status = 422;
      return { error: 'invalid_request' };
    }

    if (error instanceof JOSEError) {
      console.error(
        JSON.stringify({
          level: 'error',
          kind: 'jwt',
          method,
          pathname,
          jwtCode: error.code,
          message: error.message,
          claim: 'claim' in error ? error.claim : undefined,
          reason: 'reason' in error ? error.reason : undefined,
        })
      );
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Not found' };
    }

    const cause = error instanceof Error ? error : new Error(String(error));
    console.error(
      JSON.stringify({ level: 'error', kind: 'unhandled', code, method, pathname, name: cause.name, message: cause.message, stack: cause.stack })
    );
    set.status = typeof set.status === 'number' && set.status >= 400 ? set.status : 500;
    return { error: 'Internal Server Error' };
  });
