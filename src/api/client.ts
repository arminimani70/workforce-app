import type {
  ApiError,
  Availability,
  CoworkerShift,
  CurrentUser,
  DayAvailability,
  OrgMember,
  Position,
  Shift,
  TimeClockEntry,
  TimeTotal,
  TokenPair,
} from '../types/api';

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

  list: (accessToken: string) => request<OrgMember[]>('/users', { accessToken }),

  createEmployee: (
    accessToken: string,
    dto: { fullName: string; email: string; password: string },
  ) => request<OrgMember>('/users', { method: 'POST', accessToken, body: dto }),
};

export const timeClockApi = {
  clockIn: (accessToken: string, location?: { lat: number; lng: number }) =>
    request<TimeClockEntry>('/time-clock/clock-in', {
      method: 'POST',
      accessToken,
      body: location ?? {},
    }),

  clockOut: (accessToken: string, location?: { lat: number; lng: number }) =>
    request<TimeClockEntry>('/time-clock/clock-out', {
      method: 'POST',
      accessToken,
      body: location ?? {},
    }),

  status: (accessToken: string) =>
    request<TimeClockEntry | null>('/time-clock/status', { accessToken }),

  total: (accessToken: string, range?: { from: string; to: string }) => {
    const query = range ? `?from=${range.from}&to=${range.to}` : '';
    return request<TimeTotal>(`/time-clock/total${query}`, { accessToken });
  },
};

export const schedulingApi = {
  myShifts: (accessToken: string, range?: { from: string; to: string }) => {
    const query = range ? `?from=${range.from}&to=${range.to}` : '';
    return request<Shift[]>(`/shifts/me${query}`, { accessToken });
  },

  create: (
    accessToken: string,
    dto: {
      employeeId: string;
      startTime: string;
      endTime: string;
      jobSite?: string;
      position?: Position;
    },
  ) => request<Shift>('/shifts', { method: 'POST', accessToken, body: dto }),

  confirm: (accessToken: string, shiftId: string) =>
    request<Shift>(`/shifts/${shiftId}/confirm`, { method: 'PATCH', accessToken }),

  // Org-wide, owner/manager only — every shift regardless of who it's assigned to.
  all: (accessToken: string) => request<Shift[]>('/shifts', { accessToken }),

  coworkers: (accessToken: string, range: { from: string; to: string }) =>
    request<CoworkerShift[]>(`/shifts/coworkers?from=${range.from}&to=${range.to}`, {
      accessToken,
    }),
};

export const availabilityApi = {
  getMine: (accessToken: string) => request<Availability>('/availability/me', { accessToken }),

  updateMine: (accessToken: string, days: DayAvailability[]) =>
    request<Availability>('/availability/me', {
      method: 'PUT',
      accessToken,
      body: { days },
    }),
};
