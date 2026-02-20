import React, { useEffect, useRef } from "react";
import {
  NavigationContainer,
  LinkingOptions,
  NavigationContainerRef,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import * as Linking from "expo-linking";

import { useAuth } from "../store/AuthContext";
import { useTheme } from "../store/ThemeContext";
import { useOnboarding } from "../store/OnboardingContext";
import { Theme } from "../theme";
import {
  RootStackParamList,
  AuthStackParamList,
  MainTabParamList,
} from "../types";
import {
  registerForPushNotificationsAsync,
  savePushTokenToBackend,
  addNotificationResponseReceivedListener,
  handleNotificationNavigation,
} from "../services/notifications";

// Onboarding Screen
import OnboardingScreen from "../screens/onboarding/OnboardingScreen";

// Auth Screens
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";

// Main Screens
import HomeScreen from "../screens/main/HomeScreen";
import MyGoalsScreen from "../screens/main/MyGoalsScreen";
import WalletScreen from "../screens/main/WalletScreen";
import ProfileScreen from "../screens/main/ProfileScreen";

// Stack Screens
import GoalDetailScreen from "../screens/GoalDetailScreen";
import CreateGoalScreen from "../screens/CreateGoalScreen";
import AIGoalClarificationScreen from "../screens/AIGoalClarificationScreen";
import AIGoalCreationScreen from "../screens/AIGoalCreationScreen";
import JoinGoalScreen from "../screens/JoinGoalScreen";
import AcceptGoalScreen from "../screens/AcceptGoalScreen";
import AddFundsScreen from "../screens/AddFundsScreen";
import WithdrawScreen from "../screens/WithdrawScreen";
import VerificationChatScreen from "../screens/VerificationChatScreen";

// Profile Screens
import EditProfileScreen from "../screens/EditProfileScreen";
import PaymentMethodsScreen from "../screens/PaymentMethodsScreen";
import PrivacySecurityScreen from "../screens/PrivacySecurityScreen";
import TermsOfServiceScreen from "../screens/TermsOfServiceScreen";
import HelpSupportScreen from "../screens/HelpSupportScreen";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// Deep linking configuration
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL("/"), "stakeup://"],
  config: {
    screens: {
      GoalDetail: {
        path: "goal/:shareCode",
        parse: {
          shareCode: (shareCode: string) => shareCode,
        },
      },
      AcceptGoal: {
        path: "accept/:shareCode",
        parse: {
          shareCode: (shareCode: string) => shareCode,
        },
      },
      Main: {
        screens: {
          Home: "home",
          MyGoals: "goals",
          Wallet: "wallet",
          Profile: "profile",
        },
      },
    },
  },
};

// Tab icon component
const TabIcon: React.FC<{ name: string; focused: boolean }> = ({
  name,
  focused,
}) => {
  const icons: Record<string, string> = {
    Home: "🏠",
    MyGoals: "🎯",
    Wallet: "💰",
    Profile: "👤",
  };

  return (
    <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.6 }}>
      {icons[name] || "•"}
    </Text>
  );
};

// Auth Navigator
const AuthNavigator = ({
  route,
}: {
  route?: { params?: { screen?: "Login" | "Register" } };
}) => {
  const initialRoute = route?.params?.screen || "Login";

  return (
    <AuthStack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
};

// Main Tab Navigator - needs theme for dynamic styling
const MainNavigator = () => {
  const { theme } = useTheme();

  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBarBg,
          borderTopColor: theme.colors.tabBarBorder,
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: "Inter-SemiBold",
        },
      })}
    >
      <MainTab.Screen name="Home" component={HomeScreen} />
      <MainTab.Screen
        name="MyGoals"
        component={MyGoalsScreen}
        options={{ title: "My Goals" }}
      />
      <MainTab.Screen name="Wallet" component={WalletScreen} />
      <MainTab.Screen name="Profile" component={ProfileScreen} />
    </MainTab.Navigator>
  );
};

// Loading Screen
const LoadingScreen = () => {
  const { theme } = useTheme();
  const styles = createLoadingStyles(theme);

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
};

// Root Navigator
export const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, isDark } = useTheme();
  const { onboardingComplete } = useOnboarding();
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);

  // Create navigation theme based on app theme
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.primary,
    },
  };

  // Setup push notifications
  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotificationsAsync().then((token) => {
        if (token) {
          savePushTokenToBackend(token);
        }
      });

      // Handle notification tap
      const subscription = addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data;
          handleNotificationNavigation(data, (screen, params) => {
            if (navigationRef.current) {
              navigationRef.current.navigate(screen as any, params);
            }
          });
        }
      );

      return () => subscription.remove();
    }
  }, [isAuthenticated]);

  if (isLoading || onboardingComplete === null) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      linking={linking}
      ref={navigationRef}
      theme={navigationTheme}
    >
      <RootStack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: {
            fontFamily: "Inter-Bold",
          },
          headerShadowVisible: false,
        }}
      >
        {isAuthenticated ? (
          <>
            <RootStack.Screen
              name="Main"
              component={MainNavigator}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="GoalDetail"
              component={GoalDetailScreen}
              options={{ title: "Goal Details" }}
            />
            <RootStack.Screen
              name="CreateGoal"
              component={CreateGoalScreen}
              options={{ title: "Create Goal" }}
            />
            <RootStack.Screen
              name="AIGoalClarification"
              component={AIGoalClarificationScreen}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="AIGoalCreation"
              component={AIGoalCreationScreen}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="JoinGoal"
              component={JoinGoalScreen}
              options={{ title: "Join Goal" }}
            />
            <RootStack.Screen
              name="AcceptGoal"
              component={AcceptGoalScreen}
              options={{ title: "Accept Goal" }}
            />
            <RootStack.Screen
              name="AddFunds"
              component={AddFundsScreen}
              options={{ title: "Add Funds" }}
            />
            <RootStack.Screen
              name="Withdraw"
              component={WithdrawScreen}
              options={{ title: "Withdraw" }}
            />
            <RootStack.Screen
              name="VerificationChat"
              component={VerificationChatScreen}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ title: "Edit Profile" }}
            />
            <RootStack.Screen
              name="PaymentMethods"
              component={PaymentMethodsScreen}
              options={{ title: "Payment Methods" }}
            />
            <RootStack.Screen
              name="PrivacySecurity"
              component={PrivacySecurityScreen}
              options={{ title: "Privacy & Security" }}
            />
            <RootStack.Screen
              name="TermsOfService"
              component={TermsOfServiceScreen}
              options={{ title: "Terms of Service" }}
            />
            <RootStack.Screen
              name="HelpSupport"
              component={HelpSupportScreen}
              options={{ title: "Help & Support" }}
            />
          </>
        ) : !onboardingComplete ? (
          <RootStack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <RootStack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ headerShown: false }}
          />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const createLoadingStyles = (theme: Theme) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      marginTop: 16,
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontFamily: "Inter-Regular",
    },
  });

export default AppNavigator;
