/**
 * Custom API Error class for consistent error handling throughout the application.
 * Extends the built-in Error class with HTTP status codes and an optional errors array.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errors: string[];

  constructor(statusCode: number, message: string, errors: string[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = 'ApiError';

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /** Create a 400 Bad Request error */
  static badRequest(message: string, errors: string[] = []): ApiError {
    return new ApiError(400, message, errors);
  }

  /** Create a 401 Unauthorized error */
  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }

  /** Create a 403 Forbidden error */
  static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }

  /** Create a 404 Not Found error */
  static notFound(message: string = 'Resource not found'): ApiError {
    return new ApiError(404, message);
  }

  /** Create a 500 Internal Server Error */
  static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(500, message);
  }
}
