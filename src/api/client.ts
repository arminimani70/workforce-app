import type {
  ApiError,
  AvailabilityEntry,
  AvailabilityStatus,
  ChatMessage,
  ChecklistTemplate,
  Conversation,
  CoworkerShift,
  CurrentUser,
  FormField,
  FormFieldValue,
  FormSubmission,
  FormTemplate,
  OnboardingGuide,
  OnboardingSection,
  OrgAvailabilityEntry,
  OrgMember,
  OrgTask,
  Position,
  Shift,
  ShiftChecklist,
  SwapRequest,
  Task,
  TaskBatchResult,
  TaskStatus,
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

  updateProfile: (
    accessToken: string,
    dto: {
      fullName?: string;
      phone?: string;
      birthDate?: string;
      address?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      avatarUrl?: string;
    },
  ) => request<CurrentUser>('/users/me', { method: 'PATCH', accessToken, body: dto }),

  changePassword: (
    accessToken: string,
    dto: { currentPassword: string; newPassword: string },
  ) =>
    request<{ success: boolean }>('/users/me/password', {
      method: 'PATCH',
      accessToken,
      body: dto,
    }),
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

  reject: (accessToken: string, shiftId: string) =>
    request<Shift>(`/shifts/${shiftId}/reject`, { method: 'PATCH', accessToken }),

  // Org-wide, owner/manager only — every shift regardless of who it's assigned to.
  all: (accessToken: string) => request<Shift[]>('/shifts', { accessToken }),

  coworkers: (accessToken: string, range: { from: string; to: string }) =>
    request<CoworkerShift[]>(`/shifts/coworkers?from=${range.from}&to=${range.to}`, {
      accessToken,
    }),

  // Bulk-confirms every still-pending shift in the range — the "Publish Week" action.
  publishWeek: (accessToken: string, range: { from: string; to: string }) =>
    request<{ publishedCount: number }>(
      `/shifts/publish?from=${range.from}&to=${range.to}`,
      { method: 'PATCH', accessToken },
    ),
};

export const availabilityApi = {
  getMine: (accessToken: string, range: { from: string; to: string }) =>
    request<AvailabilityEntry[]>(
      `/availability/me?from=${range.from}&to=${range.to}`,
      { accessToken },
    ),

  updateMine: (
    accessToken: string,
    dto: {
      date: string;
      status: AvailabilityStatus;
      startTime?: string;
      endTime?: string;
      positions?: Position[];
    },
  ) => request<AvailabilityEntry>('/availability/me', { method: 'PUT', accessToken, body: dto }),

  deleteMine: (accessToken: string, date: string) =>
    request<{ acknowledged: boolean }>(`/availability/me?date=${date}`, {
      method: 'DELETE',
      accessToken,
    }),

  // Org-wide, owner/manager only — every entry in the range, across all employees.
  all: (accessToken: string, range: { from: string; to: string }) =>
    request<OrgAvailabilityEntry[]>(
      `/availability?from=${range.from}&to=${range.to}`,
      { accessToken },
    ),
};

export const tasksApi = {
  create: (
    accessToken: string,
    dto: {
      title: string;
      description?: string;
      dueDate: string;
      assignedTo?: string;
      position?: Position;
    },
  ) => request<Task>('/tasks', { method: 'POST', accessToken, body: dto }),

  createBatch: (
    accessToken: string,
    dto: { title: string; description?: string; position: Position; dueDates: string[] },
  ) => request<TaskBatchResult[]>('/tasks/batch', { method: 'POST', accessToken, body: dto }),

  mine: (accessToken: string) => request<Task[]>('/tasks/me', { accessToken }),

  all: (accessToken: string) => request<OrgTask[]>('/tasks', { accessToken }),

  updateStatus: (accessToken: string, taskId: string, status: TaskStatus) =>
    request<Task>(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      accessToken,
      body: { status },
    }),
};

export const swapRequestsApi = {
  create: (accessToken: string, dto: { requestingShiftId: string; targetShiftId: string }) =>
    request<SwapRequest>('/shifts/swap-requests', { method: 'POST', accessToken, body: dto }),

  mine: (accessToken: string) =>
    request<SwapRequest[]>('/shifts/swap-requests/me', { accessToken }),

  // Org-wide, owner/manager only — every request already accepted by its target, awaiting
  // final manager approval.
  pendingManager: (accessToken: string) =>
    request<SwapRequest[]>('/shifts/swap-requests', { accessToken }),

  accept: (accessToken: string, id: string) =>
    request<SwapRequest>(`/shifts/swap-requests/${id}/accept`, { method: 'PATCH', accessToken }),

  decline: (accessToken: string, id: string) =>
    request<SwapRequest>(`/shifts/swap-requests/${id}/decline`, { method: 'PATCH', accessToken }),

  cancel: (accessToken: string, id: string) =>
    request<SwapRequest>(`/shifts/swap-requests/${id}/cancel`, { method: 'PATCH', accessToken }),

  approve: (accessToken: string, id: string) =>
    request<SwapRequest>(`/shifts/swap-requests/${id}/approve`, { method: 'PATCH', accessToken }),

  deny: (accessToken: string, id: string) =>
    request<SwapRequest>(`/shifts/swap-requests/${id}/deny`, { method: 'PATCH', accessToken }),
};

export const messagesApi = {
  send: (accessToken: string, dto: { recipientId: string; text: string }) =>
    request<ChatMessage>('/messages', { method: 'POST', accessToken, body: dto }),

  conversations: (accessToken: string) =>
    request<Conversation[]>('/messages/conversations', { accessToken }),

  unreadCount: (accessToken: string) =>
    request<{ count: number }>('/messages/unread-count', { accessToken }),

  thread: (accessToken: string, employeeId: string) =>
    request<ChatMessage[]>(`/messages/with/${employeeId}`, { accessToken }),

  markRead: (accessToken: string, employeeId: string) =>
    request<{ acknowledged: boolean }>(`/messages/with/${employeeId}/read`, {
      method: 'PATCH',
      accessToken,
    }),
};

export const checklistsApi = {
  // Owner/manager only.
  upsertTemplate: (
    accessToken: string,
    dto: { position: Position; jobSite: string; openingItems: string[]; closingItems: string[] },
  ) =>
    request<ChecklistTemplate>('/checklists/templates', {
      method: 'PUT',
      accessToken,
      body: dto,
    }),

  // Owner/manager only.
  listTemplates: (accessToken: string) =>
    request<ChecklistTemplate[]>('/checklists/templates', { accessToken }),

  forShift: (accessToken: string, shiftId: string) =>
    request<ShiftChecklist>(`/checklists/shift/${shiftId}`, { accessToken }),

  updateOpening: (accessToken: string, shiftId: string, completedItems: string[]) =>
    request<{ openingCompletedItems: string[] }>(`/checklists/shift/${shiftId}/opening`, {
      method: 'PATCH',
      accessToken,
      body: { completedItems },
    }),

  updateClosing: (accessToken: string, shiftId: string, completedItems: string[]) =>
    request<{ closingCompletedItems: string[] }>(`/checklists/shift/${shiftId}/closing`, {
      method: 'PATCH',
      accessToken,
      body: { completedItems },
    }),
};

export const formsApi = {
  listTemplates: (accessToken: string) =>
    request<FormTemplate[]>('/forms/templates', { accessToken }),

  // Owner/manager only. Include id to update an existing template in place.
  upsertTemplate: (
    accessToken: string,
    dto: { id?: string; title: string; fields: FormField[] },
  ) =>
    request<FormTemplate>('/forms/templates', { method: 'PUT', accessToken, body: dto }),

  // Owner/manager only.
  deleteTemplate: (accessToken: string, id: string) =>
    request<void>(`/forms/templates/${id}`, { method: 'DELETE', accessToken }),

  submit: (accessToken: string, dto: { formTemplateId: string; values: FormFieldValue[] }) =>
    request<FormSubmission>('/forms/submissions', { method: 'POST', accessToken, body: dto }),

  // Owner/manager only.
  listSubmissions: (accessToken: string) =>
    request<FormSubmission[]>('/forms/submissions', { accessToken }),
};

export const onboardingApi = {
  get: (accessToken: string) => request<OnboardingGuide>('/onboarding', { accessToken }),

  update: (accessToken: string, sections: OnboardingSection[]) =>
    request<OnboardingGuide>('/onboarding', { method: 'PUT', accessToken, body: { sections } }),
};
