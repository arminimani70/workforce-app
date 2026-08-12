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

export interface Shift {
  _id: string;
  organizationId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  jobSite?: string;
  position?: Position;
  status: ShiftStatus;
  confirmed: boolean;
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
