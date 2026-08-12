import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import TimeClockScreen from '../screens/TimeClockScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import AvailabilityScreen from '../screens/AvailabilityScreen';
import TeamScreen from '../screens/TeamScreen';
import TasksScreen from '../screens/TasksScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type { AppStackParamList, AuthStackParamList } from './types';
import { colors } from '../theme/colors';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <AppStack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
          }}
        >
          <AppStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <AppStack.Screen
            name="TimeClock"
            component={TimeClockScreen}
            options={{ title: 'Time Clock' }}
          />
          <AppStack.Screen
            name="Schedule"
            component={ScheduleScreen}
            options={{ title: 'Schedule' }}
          />
          <AppStack.Screen
            name="Availability"
            component={AvailabilityScreen}
            options={{ title: 'Availability' }}
          />
          <AppStack.Screen name="Team" component={TeamScreen} options={{ title: 'Team' }} />
          <AppStack.Screen name="Tasks" component={TasksScreen} options={{ title: 'Tasks' }} />
          <AppStack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ title: 'Onboarding' }}
          />
          <AppStack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: 'Profile' }}
          />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
