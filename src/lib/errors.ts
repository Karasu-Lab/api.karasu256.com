export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly reason?: string
  ) {
    super(message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string = 'bad_request', reason?: string) {
    super(400, message, reason);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string = 'Unauthorized', reason?: string) {
    super(401, message, reason);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string = 'insufficient_scope', reason?: string) {
    super(403, message, reason);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = 'not_found', reason?: string) {
    super(404, message, reason);
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(message: string = 'payload_too_large', reason?: string) {
    super(413, message, reason);
  }
}

export class UnsupportedMediaTypeError extends HttpError {
  constructor(message: string = 'unsupported_media_type', reason?: string) {
    super(415, message, reason);
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message: string = 'unprocessable_entity', reason?: string) {
    super(422, message, reason);
  }
}

export class BadGatewayError extends HttpError {
  constructor(message: string = 'bad_gateway', reason?: string) {
    super(502, message, reason);
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message: string = 'service_unavailable', reason?: string) {
    super(503, message, reason);
  }
}
