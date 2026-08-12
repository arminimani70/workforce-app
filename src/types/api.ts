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

export type Position = 'frontdesk' | 'helpdesk' | 'information' | 'consultation';

export const POSITIONS: Position[] = ['frontdesk', 'helpdesk', 'information', 'consultation'];

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

export type DayAvailabilityStatus = 'unavailable' | 'available' | 'flexible';

export interface DayAvailability {
  dayOfWeek: number; // 0 = Monday .. 6 = Sunday
  status: DayAvailabilityStatus;
  startTime?: string; // "HH:mm"
  endTime?: string;
  positions?: Position[];
}

export interface Availability {
  organizationId: string;
  employeeId: string;
  days: DayAvailability[];
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
