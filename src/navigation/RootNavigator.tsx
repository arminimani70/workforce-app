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
import OnboardingScreen from '../screens/OnboardingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BuildScheduleScreen from '../screens/BuildScheduleScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ChatScreen from '../screens/ChatScreen';
import ChecklistScreen from '../screens/ChecklistScreen';
import ManageChecklistsScreen from '../screens/ManageChecklistsScreen';
import FormsScreen from '../screens/FormsScreen';
import ManageFormsScreen from '../screens/ManageFormsScreen';
import FormSubmissionsScreen from '../screens/FormSubmissionsScreen';
import ManageBranchesScreen from '../screens/ManageBranchesScreen';
import StockScreen from '../screens/StockScreen';
import StockSubmitScreen from '../screens/StockSubmitScreen';
import ManageStockScreen from '../screens/ManageStockScreen';
import StockSubmissionsScreen from '../screens/StockSubmissionsScreen';
import WastageScreen from '../screens/WastageScreen';
import ManageWastageReasonsScreen from '../screens/ManageWastageReasonsScreen';
import WastageEntriesScreen from '../screens/WastageEntriesScreen';
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
          <AppStack.Screen
            name="BuildSchedule"
            component={BuildScheduleScreen}
            options={{ title: 'Build Schedule' }}
          />
          <AppStack.Screen
            name="Messages"
            component={MessagesScreen}
            options={{ title: 'Messages' }}
          />
          <AppStack.Screen
            name="Chat"
            component={ChatScreen}
            options={({ route }) => ({ title: route.params.employeeName })}
          />
          <AppStack.Screen
            name="Checklist"
            component={ChecklistScreen}
            options={{ title: 'Checklist' }}
          />
          <AppStack.Screen
            name="ManageChecklists"
            component={ManageChecklistsScreen}
            options={{ title: 'Manage Checklists' }}
          />
          <AppStack.Screen name="Forms" component={FormsScreen} options={{ title: 'Forms' }} />
          <AppStack.Screen
            name="ManageForms"
            component={ManageFormsScreen}
            options={{ title: 'Manage Forms' }}
          />
          <AppStack.Screen
            name="FormSubmissions"
            component={FormSubmissionsScreen}
            options={{ title: 'Submission History' }}
          />
          <AppStack.Screen
            name="ManageBranches"
            component={ManageBranchesScreen}
            options={{ title: 'Manage Branches' }}
          />
          <AppStack.Screen name="Stock" component={StockScreen} options={{ title: 'Stock' }} />
          <AppStack.Screen
            name="StockSubmit"
            component={StockSubmitScreen}
            options={{ title: 'Count Stock' }}
          />
          <AppStack.Screen
            name="ManageStock"
            component={ManageStockScreen}
            options={{ title: 'Manage Stock Lists' }}
          />
          <AppStack.Screen
            name="StockSubmissions"
            component={StockSubmissionsScreen}
            options={{ title: 'Stock History' }}
          />
          <AppStack.Screen
            name="Wastage"
            component={WastageScreen}
            options={{ title: 'Wastage' }}
          />
          <AppStack.Screen
            name="ManageWastageReasons"
            component={ManageWastageReasonsScreen}
            options={{ title: 'Manage Reasons' }}
          />
          <AppStack.Screen
            name="WastageEntries"
            component={WastageEntriesScreen}
            options={{ title: 'Wastage History' }}
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
