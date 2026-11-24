export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string = 'bad_request') {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string = 'insufficient_scope') {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = 'not_found') {
    super(404, message);
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(message: string = 'payload_too_large') {
    super(413, message);
  }
}

export class UnsupportedMediaTypeError extends HttpError {
  constructor(message: string = 'unsupported_media_type') {
    super(415, message);
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message: string = 'unprocessable_entity') {
    super(422, message);
  }
}

export class BadGatewayError extends HttpError {
  constructor(message: string = 'bad_gateway') {
    super(502, message);
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message: string = 'service_unavailable') {
    super(503, message);
  }
}
