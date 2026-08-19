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
  reason?: string;
  jobSite?: string;
  position?: Position;
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

// GET /shifts/coworkers populates employeeId into { _id, fullName, role, avatarUrl } instead
// of a plain id string, so it needs its own shape rather than reusing Shift.
export interface CoworkerShift {
  _id: string;
  employeeId: { _id: string; fullName: string; role: UserRole; avatarUrl?: string };
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

export interface OnboardingSection {
  title: string;
  content: string;
}

export interface OnboardingGuide {
  organizationId: string;
  sections: OnboardingSection[];
  updatedAt: string | null;
}

export type SwapRequestStatus =
  | 'open'
  | 'pending_target'
  | 'pending_manager'
  | 'approved'
  | 'rejected'
  | 'cancelled';

// requestingShiftId/requestingEmployeeId are always populated. targetShiftId is absent when
// the target had no shift that day (approval just reassigns requestingShiftId to them instead
// of trading two shifts). targetEmployeeId is absent while status is 'open' — a "Free
// Volunteer" broadcast nobody has claimed yet.
export interface SwapRequest {
  _id: string;
  organizationId: string;
  requestingShiftId: Shift;
  requestingEmployeeId: { _id: string; fullName: string; role: UserRole };
  targetShiftId?: Shift;
  targetEmployeeId?: { _id: string; fullName: string; role: UserRole };
  status: SwapRequestStatus;
  decidedBy?: string;
  createdAt: string;
}

export type ShiftEditRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ShiftEditRequest {
  _id: string;
  organizationId: string;
  shiftId: Shift;
  requestedBy: { _id: string; fullName: string; role: UserRole } | string;
  newStartTime: string;
  newEndTime: string;
  status: ShiftEditRequestStatus;
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
// position at that branch. title is a manager-set heading for that branch's checklist (e.g.
// "Morning Opening — Front Desk"), independent of jobSite itself.
export interface ChecklistTemplate {
  _id: string;
  position: Position;
  jobSite: string;
  title: string;
  openingItems: string[];
  closingItems: string[];
}

// Every item's done/not-done status is explicit once answered — an item simply absent from
// the array means it hasn't been marked either way yet.
export interface ChecklistItemStatus {
  item: string;
  done: boolean;
}

// The resolved checklist for today, for a given position+branch — not tied to a shift, so it
// can be opened and filled even on a day with no shift scheduled. openingSubmittedAt/
// closingSubmittedAt are null until that section has been explicitly submitted.
export interface TodayChecklist {
  date: string;
  position: Position;
  jobSite: string | null;
  title: string | null;
  openingItems: string[];
  closingItems: string[];
  openingStatuses: ChecklistItemStatus[];
  closingStatuses: ChecklistItemStatus[];
  openingSubmittedAt: string | null;
  closingSubmittedAt: string | null;
}

// One per (employee, day, position, branch) with at least one section submitted — what
// owner/manager see in the checklist review list.
export interface ChecklistSubmission {
  _id: string;
  employeeId: { _id: string; fullName: string; role: UserRole };
  date: string;
  position: Position;
  jobSite: string;
  openingStatuses: ChecklistItemStatus[];
  closingStatuses: ChecklistItemStatus[];
  openingSubmittedAt: string | null;
  closingSubmittedAt: string | null;
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

// The org-wide, canonical list of physical work locations. Shift.jobSite and
// ChecklistTemplate.jobSite stay plain-text snapshots of a branch's `name`, not a reference to
// this — picking a branch just fills that text field with its current name.
export interface Branch {
  _id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface StockItem {
  productName: string;
  unit: string;
}

// A manager-built, named list of products to count at one branch (jobSite is a plain-text
// branch-name snapshot). An employee submitting only ever fills in a quantity per row here —
// productName/unit are fixed by whoever built the list.
export interface StockTemplate {
  _id: string;
  organizationId: string;
  jobSite: string;
  title: string;
  items: StockItem[];
}

export interface StockEntryValue extends StockItem {
  quantity: number;
}

// A submitted stock count — snapshots the template's title/branch plus each row's counted
// quantity, so it stays readable even if the template is later edited or deleted.
export interface StockSubmission {
  _id: string;
  organizationId: string;
  stockTemplateId: string;
  templateTitle: string;
  jobSite: string;
  employeeId: { _id: string; fullName: string; role: UserRole };
  entries: StockEntryValue[];
  createdAt: string;
}

// An org-wide, manager-editable catalog of wastage reasons that populates the reason picker on
// the wastage submission form.
export interface WastageReason {
  _id: string;
  organizationId: string;
  label: string;
}

// One reported wastage event. jobSite and reason are picked from existing lists (branches,
// WastageReason) but stored as plain-text snapshots; productName/amount are free text the
// employee types by hand.
export interface WastageEntry {
  _id: string;
  organizationId: string;
  employeeId: { _id: string; fullName: string; role: UserRole };
  jobSite: string;
  reason: string;
  productName: string;
  amount: string;
  createdAt: string;
}
