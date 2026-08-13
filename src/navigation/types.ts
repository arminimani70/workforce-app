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
  Tasks: { dueDate?: string } | undefined;
  Onboarding: undefined;
  Profile: undefined;
  BuildSchedule: undefined;
};
