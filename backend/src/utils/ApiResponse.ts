/**
 * Standard API response wrapper for consistent response format.
 * All successful API responses should use this class.
 */
export class ApiResponse<T> {
  public readonly success: boolean;
  public readonly statusCode: number;
  public readonly message: string;
  public readonly data: T;

  constructor(statusCode: number, data: T, message: string = 'Success') {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }

  /** Create a 200 OK response */
  static success<T>(data: T, message: string = 'Success', statusCode: number = 200): ApiResponse<T> {
    return new ApiResponse<T>(statusCode, data, message);
  }

  /** Create a 201 Created response */
  static created<T>(data: T, message: string = 'Created successfully'): ApiResponse<T> {
    return new ApiResponse<T>(201, data, message);
  }
}
