import type { ApiError, CurrentUser, TokenPair } from '../types/api';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; accessToken?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const apiError = data as ApiError | undefined;
    const message = Array.isArray(apiError?.message)
      ? apiError.message.join(', ')
      : (apiError?.message ?? 'Request failed');
    throw new HttpError(response.status, message);
  }

  return data as T;
}

export const authApi = {
  register: (dto: {
    organizationName: string;
    fullName: string;
    email: string;
    password: string;
  }) => request<TokenPair>('/auth/register', { method: 'POST', body: dto }),

  login: (dto: { email: string; password: string }) =>
    request<TokenPair>('/auth/login', { method: 'POST', body: dto }),

  refresh: (refreshToken: string) =>
    request<TokenPair>('/auth/refresh', { method: 'POST', body: { refreshToken } }),
};

export const usersApi = {
  me: (accessToken: string) => request<CurrentUser>('/users/me', { accessToken }),
};
