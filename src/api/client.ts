import type {
  ApiError,
  AvailabilityEntry,
  AvailabilityStatus,
  Branch,
  ChatMessage,
  ChecklistSubmission,
  ChecklistTemplate,
  Conversation,
  CoworkerShift,
  CurrentUser,
  FormField,
  FormFieldValue,
  FormSubmission,
  FormTemplate,
  LiveChecklist,
  OnboardingGuide,
  OnboardingSection,
  OrgAvailabilityEntry,
  OrgMember,
  Position,
  Shift,
  ShiftEditRequest,
  StockItem,
  StockSubmission,
  StockTemplate,
  SwapRequest,
  TimeClockEntry,
  TimeTotal,
  TokenPair,
  WastageEntry,
  WastageReason,
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
  clockIn: (
    accessToken: string,
    location: { lat: number; lng: number } | undefined,
    extra?: {
      dayStart: string;
      dayEnd: string;
      reason?: string;
      jobSite?: string;
      position?: Position;
    },
  ) =>
    request<TimeClockEntry>('/time-clock/clock-in', {
      method: 'POST',
      accessToken,
      body: { ...location, ...extra },
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

export const swapRequestsApi = {
  // Omit targetEmployeeId for a "Free Volunteer" broadcast instead of naming a specific person.
  create: (accessToken: string, dto: { requestingShiftId: string; targetEmployeeId?: string }) =>
    request<SwapRequest>('/shifts/swap-requests', { method: 'POST', accessToken, body: dto }),

  // Who's eligible to be picked as a direct target for this shift: free that day, or working
  // the same position at a different branch.
  candidates: (accessToken: string, shiftId: string) =>
    request<OrgMember[]>(`/shifts/swap-requests/candidates?shiftId=${shiftId}`, { accessToken }),

  mine: (accessToken: string) =>
    request<SwapRequest[]>('/shifts/swap-requests/me', { accessToken }),

  // Open ("Free Volunteer") requests the caller is free that day to claim.
  open: (accessToken: string) =>
    request<SwapRequest[]>('/shifts/swap-requests/open', { accessToken }),

  // Org-wide, owner/manager only — every request already accepted by its target, awaiting
  // final manager approval.
  pendingManager: (accessToken: string) =>
    request<SwapRequest[]>('/shifts/swap-requests', { accessToken }),

  volunteer: (accessToken: string, id: string) =>
    request<SwapRequest>(`/shifts/swap-requests/${id}/volunteer`, { method: 'PATCH', accessToken }),

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

export const shiftEditRequestsApi = {
  create: (accessToken: string, dto: { shiftId: string; startTime: string; endTime: string }) =>
    request<ShiftEditRequest>('/shifts/edit-requests', { method: 'POST', accessToken, body: dto }),

  mine: (accessToken: string) =>
    request<ShiftEditRequest[]>('/shifts/edit-requests/me', { accessToken }),

  // Org-wide, owner/manager only — every request still awaiting approval.
  pendingManager: (accessToken: string) =>
    request<ShiftEditRequest[]>('/shifts/edit-requests', { accessToken }),

  cancel: (accessToken: string, id: string) =>
    request<ShiftEditRequest>(`/shifts/edit-requests/${id}/cancel`, { method: 'PATCH', accessToken }),

  approve: (accessToken: string, id: string) =>
    request<ShiftEditRequest>(`/shifts/edit-requests/${id}/approve`, { method: 'PATCH', accessToken }),

  reject: (accessToken: string, id: string) =>
    request<ShiftEditRequest>(`/shifts/edit-requests/${id}/reject`, { method: 'PATCH', accessToken }),
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
    dto: {
      position: Position;
      jobSite: string;
      title?: string;
      openingItems: string[];
      closingItems: string[];
    },
  ) =>
    request<ChecklistTemplate>('/checklists/templates', {
      method: 'PUT',
      accessToken,
      body: dto,
    }),

  // Any authenticated user — the catalog of available checklist "forms" to browse and pick
  // from, as well as the source list for owner/manager's Manage Checklists editor.
  listTemplates: (accessToken: string) =>
    request<ChecklistTemplate[]>('/checklists/templates', { accessToken }),

  current: (accessToken: string, position: Position, jobSite: string) =>
    request<LiveChecklist>(
      `/checklists/current?position=${position}${jobSite ? `&jobSite=${encodeURIComponent(jobSite)}` : ''}`,
      { accessToken },
    ),

  updateOpening: (
    accessToken: string,
    position: Position,
    jobSite: string,
    item: string,
    done: boolean,
    photoUrl?: string,
  ) =>
    request<unknown>('/checklists/current/opening', {
      method: 'PATCH',
      accessToken,
      body: { position, jobSite, item, done, photoUrl },
    }),

  updateClosing: (
    accessToken: string,
    position: Position,
    jobSite: string,
    item: string,
    done: boolean,
    photoUrl?: string,
  ) =>
    request<unknown>('/checklists/current/closing', {
      method: 'PATCH',
      accessToken,
      body: { position, jobSite, item, done, photoUrl },
    }),

  submitOpening: (accessToken: string, position: Position, jobSite: string) =>
    request<ChecklistSubmission>('/checklists/current/opening/submit', {
      method: 'PATCH',
      accessToken,
      body: { position, jobSite },
    }),

  submitClosing: (accessToken: string, position: Position, jobSite: string) =>
    request<ChecklistSubmission>('/checklists/current/closing/submit', {
      method: 'PATCH',
      accessToken,
      body: { position, jobSite },
    }),

  // Owner/manager only.
  listSubmissions: (accessToken: string) =>
    request<ChecklistSubmission[]>('/checklists/submissions', { accessToken }),
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

export const branchesApi = {
  // Any authenticated user — populates branch pickers and the clock-in geofence map.
  list: (accessToken: string) => request<Branch[]>('/branches', { accessToken }),

  // Owner/manager only. Include id to update an existing branch in place.
  upsert: (
    accessToken: string,
    dto: { id?: string; name: string; lat: number; lng: number; radiusMeters?: number },
  ) => request<Branch>('/branches', { method: 'PUT', accessToken, body: dto }),

  // Owner/manager only.
  delete: (accessToken: string, id: string) =>
    request<void>(`/branches/${id}`, { method: 'DELETE', accessToken }),
};

export const stockApi = {
  // Owner/manager only. Include id to update an existing list in place.
  upsertTemplate: (
    accessToken: string,
    dto: { id?: string; jobSite: string; title: string; items: StockItem[] },
  ) => request<StockTemplate>('/stock/templates', { method: 'PUT', accessToken, body: dto }),

  // Any authenticated user — the catalog to pick a stock list from.
  listTemplates: (accessToken: string) =>
    request<StockTemplate[]>('/stock/templates', { accessToken }),

  // Owner/manager only.
  deleteTemplate: (accessToken: string, id: string) =>
    request<void>(`/stock/templates/${id}`, { method: 'DELETE', accessToken }),

  submit: (
    accessToken: string,
    dto: { stockTemplateId: string; quantities: { productName: string; quantity: number }[] },
  ) => request<StockSubmission>('/stock/submissions', { method: 'POST', accessToken, body: dto }),

  // Owner/manager only.
  listSubmissions: (accessToken: string) =>
    request<StockSubmission[]>('/stock/submissions', { accessToken }),
};

export const wastageApi = {
  // Owner/manager only. Include id to rename an existing reason in place.
  upsertReason: (accessToken: string, dto: { id?: string; label: string }) =>
    request<WastageReason>('/wastage/reasons', { method: 'PUT', accessToken, body: dto }),

  // Any authenticated user — populates the reason picker on the submission form.
  listReasons: (accessToken: string) =>
    request<WastageReason[]>('/wastage/reasons', { accessToken }),

  // Owner/manager only.
  deleteReason: (accessToken: string, id: string) =>
    request<void>(`/wastage/reasons/${id}`, { method: 'DELETE', accessToken }),

  create: (
    accessToken: string,
    dto: { jobSite: string; reason: string; productName: string; amount: string },
  ) => request<WastageEntry>('/wastage/entries', { method: 'POST', accessToken, body: dto }),

  // Owner/manager only.
  listEntries: (accessToken: string) =>
    request<WastageEntry[]>('/wastage/entries', { accessToken }),
};
