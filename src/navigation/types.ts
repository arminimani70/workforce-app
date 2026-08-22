import type { ConversationType, Position, StockTemplate } from '../types/api';

export type AuthStackParamList = {
  Login: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  TimeClock: undefined;
  Schedule: undefined;
  Availability: undefined;
  ManagePositionHours: undefined;
  Team: undefined;
  Onboarding: undefined;
  DocumentViewer: { uri: string; title: string; mimeType: string };
  Profile: undefined;
  BuildSchedule: undefined;
  Messages: undefined;
  Chat: { conversationId: string; title: string; type: ConversationType };
  Checklist: undefined;
  ChecklistFill: { position: Position; jobSite: string; title?: string | null };
  ManageChecklists: undefined;
  ChecklistSubmissions: undefined;
  Forms: undefined;
  ManageForms: undefined;
  FormSubmissions: undefined;
  ManageBranches: undefined;
  Stock: undefined;
  StockSubmit: { template: StockTemplate };
  PurchaseList: { template: StockTemplate };
  ManageStock: undefined;
  StockSubmissions: undefined;
  Wastage: undefined;
  ManageWastageReasons: undefined;
  WastageEntries: undefined;
};
