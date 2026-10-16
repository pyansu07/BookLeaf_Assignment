export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = "ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthorized: (message = "Authentication required") =>
    new AppError(401, message, "UNAUTHORIZED"),
  forbidden: (message = "You do not have access to this resource") =>
    new AppError(403, message, "FORBIDDEN"),
  notFound: (message = "Resource not found") =>
    new AppError(404, message, "NOT_FOUND"),
  badRequest: (message = "Invalid request") =>
    new AppError(400, message, "BAD_REQUEST"),
  conflict: (message = "Resource conflict") =>
    new AppError(409, message, "CONFLICT"),
};
