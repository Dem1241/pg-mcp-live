export type SuccessEnvelope<T> = {
  ok: true;
  summary: string;
  data: T;
};

export type ErrorEnvelope = {
  ok: false;
  summary: string;
  error: {
    message: string;
  };
};

export function createSuccessEnvelope<T>(summary: string, data: T): SuccessEnvelope<T> {
  return {
    ok: true,
    summary,
    data,
  };
}

export function createErrorEnvelope(summary: string, message: string): ErrorEnvelope {
  return {
    ok: false,
    summary,
    error: {
      message,
    },
  };
}

export function createSuccessToolResponse<T>(summary: string, data: T) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(createSuccessEnvelope(summary, data), null, 2),
      },
    ],
  };
}

export function createErrorToolResponse(summary: string, message: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(createErrorEnvelope(summary, message), null, 2),
      },
    ],
  };
}
