export type UserRole = 'owner' | 'manager' | 'employee';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface CurrentUser {
  _id: string;
  organizationId: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: 'active' | 'invited' | 'suspended';
  // Self-editable profile fields (PATCH /users/me). email and role are not among them — those
  // stay admin-set. Only present on GET /users/me, not on the org-wide GET /users listing.
  phone?: string;
  avatarUrl?: string; // a data:image/... URI, not an external link
  birthDate?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export type OrgMember = CurrentUser;

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface TimeClockEntry {
  _id: string;
  organizationId: string;
  employeeId: string;
  clockInTime: string;
  clockOutTime?: string;
  clockInLocation?: GeoPoint;
  clockOutLocation?: GeoPoint;
}

export type Position = 'frontdesk' | 'helpdesk' | 'information' | 'consultation' | 'manager';

export const POSITIONS: Position[] = [
  'frontdesk',
  'helpdesk',
  'information',
  'consultation',
  'manager',
];

export type ShiftStatus = 'scheduled' | 'completed' | 'missed';
export type ShiftApproval = 'pending' | 'approved' | 'rejected';

export interface Shift {
  _id: string;
  organizationId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  jobSite?: string;
  position?: Position;
  status: ShiftStatus;
  approval: ShiftApproval;
  createdBy: string;
}

// GET /shifts/coworkers populates employeeId into { _id, fullName, role } instead of a
// plain id string, so it needs its own shape rather than reusing Shift.
export interface CoworkerShift {
  _id: string;
  employeeId: { _id: string; fullName: string; role: UserRole };
  startTime: string;
  endTime: string;
  jobSite?: string;
  position?: Position;
}

export type AvailabilityStatus = 'unavailable' | 'available' | 'flexible';

// One entry per (employee, exact calendar date) — not a recurring weekly pattern. A date with
// no entry simply hasn't been set yet.
export interface AvailabilityEntry {
  _id: string;
  organizationId: string;
  employeeId: string;
  date: string;
  status: AvailabilityStatus;
  startTime?: string; // "HH:mm"
  endTime?: string;
  positions?: Position[];
}

// GET /availability (org-wide) populates employeeId into { _id, fullName, role }.
export interface OrgAvailabilityEntry extends Omit<AvailabilityEntry, 'employeeId'> {
  employeeId: { _id: string; fullName: string; role: UserRole };
}

export interface TimeTotal {
  totalSeconds: number;
}

export type TaskStatus = 'pending' | 'in_progress' | 'done';

export interface Task {
  _id: string;
  organizationId: string;
  title: string;
  description?: string;
  assignedTo: string;
  dueDate: string;
  position?: Position;
  status: TaskStatus;
  createdBy: string;
}

// GET /tasks (org-wide) populates assignedTo into { _id, fullName, role }.
export interface OrgTask extends Omit<Task, 'assignedTo'> {
  assignedTo: { _id: string; fullName: string; role: UserRole };
}

export interface TaskBatchResult {
  dueDate: string;
  created: boolean;
  reason?: string;
  task?: Task;
}

export interface OnboardingGuide {
  organizationId: string;
  content: string;
  updatedAt: string | null;
}

export type SwapRequestStatus =
  | 'pending_target'
  | 'pending_manager'
  | 'approved'
  | 'rejected'
  | 'cancelled';

// employeeId fields and shiftId fields are always populated by the backend.
export interface SwapRequest {
  _id: string;
  organizationId: string;
  requestingShiftId: Shift;
  requestingEmployeeId: { _id: string; fullName: string; role: UserRole };
  targetShiftId: Shift;
  targetEmployeeId: { _id: string; fullName: string; role: UserRole };
  status: SwapRequestStatus;
  decidedBy?: string;
  createdAt: string;
}

// Direct 1:1 messages — senderId is always populated; recipientId is a bare id (only the
// sender's identity matters for rendering a thread).
export interface ChatMessage {
  _id: string;
  senderId: { _id: string; fullName: string; role: UserRole };
  recipientId: string;
  text: string;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  employeeId: { _id: string; fullName: string; role: UserRole };
  lastMessage: string;
  lastMessageAt: string;
  lastMessageFromMe: boolean;
  unreadCount: number;
}

// One per (position, jobSite) — what to do at the start and end of a shift for that
// position at that branch.
export interface ChecklistTemplate {
  _id: string;
  position: Position;
  jobSite: string;
  openingItems: string[];
  closingItems: string[];
}

// The resolved checklist for one specific shift: the matching template's items (empty if none
// defined) plus that shift's current completion progress.
export interface ShiftChecklist {
  shiftId: string;
  position: Position | null;
  jobSite: string | null;
  openingItems: string[];
  closingItems: string[];
  openingCompletedItems: string[];
  closingCompletedItems: string[];
}

export type FormFieldType = 'text' | 'number';

export interface FormField {
  label: string;
  type: FormFieldType;
}

// Org-wide catalog of ad hoc report types — not tied to a position or branch, unlike
// checklists; anyone can submit any of them whenever something needs reporting.
export interface FormTemplate {
  _id: string;
  title: string;
  fields: FormField[];
}

export interface FormFieldValue {
  label: string;
  value: string;
}

// A filled-out form, as submitted — values are a label+value snapshot, not a live reference
// to the template's current fields.
export interface FormSubmission {
  _id: string;
  formTemplateId: string;
  formTitle: string;
  employeeId: { _id: string; fullName: string; role: UserRole };
  values: FormFieldValue[];
  createdAt: string;
}
