export type RequestLogEntry = {
  operationName: string;
  operationType: string;
  queryHash: string;
  durationMs: number;
  errorCount: number;
  errors?: RequestLogError[];
  userId: string | undefined;
  correlationId: string | undefined;
  clientIp: string | undefined;
};

export type RequestLogError = {
  message: string;
  code: string | undefined;
};
