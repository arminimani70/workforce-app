import type { StockTemplate } from '../types/api';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  TimeClock: undefined;
  Schedule: undefined;
  Availability: undefined;
  Team: undefined;
  Onboarding: undefined;
  Profile: undefined;
  BuildSchedule: undefined;
  Messages: undefined;
  Chat: { employeeId: string; employeeName: string };
  Checklist: { shiftId: string };
  ManageChecklists: undefined;
  Forms: undefined;
  ManageForms: undefined;
  FormSubmissions: undefined;
  ManageBranches: undefined;
  Stock: undefined;
  StockSubmit: { template: StockTemplate };
  ManageStock: undefined;
  StockSubmissions: undefined;
  Wastage: undefined;
  ManageWastageReasons: undefined;
  WastageEntries: undefined;
};
