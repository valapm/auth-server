export class Unauthorized extends Error {
  statusCode: number

  constructor(message: string) {
    super(message)
    this.name = "UnauthorizedError"
    this.statusCode = 401
  }
}

export class BadRequest extends Error {
  statusCode: number

  constructor(message: string) {
    super(message)
    this.name = "BadRequestError"
    this.statusCode = 400
  }
}

export class Forbidden extends Error {
  statusCode: number

  constructor(message: string) {
    super(message)
    this.name = "ForbiddenError"
    this.statusCode = 403
  }
}

export class NotFound extends Error {
  statusCode: number

  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
    this.statusCode = 404
  }
}
