import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { authApi } from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and get the push token
 */
export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token: string | undefined;

  // Only works on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return undefined;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push notification permissions');
    return undefined;
  }

  // Get the push token
  try {
    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    token = pushTokenData.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return undefined;
  }

  // Configure Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    });
  }

  return token;
}

/**
 * Save push token to backend
 */
export async function savePushTokenToBackend(token: string): Promise<void> {
  try {
    await authApi.updatePushToken(token);
    console.log('Push token saved to backend');
  } catch (error) {
    console.error('Failed to save push token:', error);
  }
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: trigger || null, // null means immediate
  });
}

/**
 * Cancel a scheduled notification
 */
export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Add notification received listener
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add notification response listener (when user taps notification)
 */
export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Notification types for the app
 */
export type NotificationType = 
  | 'goal_invitation'
  | 'goal_completed'
  | 'goal_failed'
  | 'goal_deadline_reminder'
  | 'progress_reminder'
  | 'payment_received'
  | 'participant_joined'
  | 'verification_result';

/**
 * Handle notification based on type
 */
export function handleNotificationNavigation(
  data: { type?: NotificationType; goalId?: string; [key: string]: unknown },
  navigate: (screen: string, params?: Record<string, unknown>) => void
): void {
  switch (data.type) {
    case 'goal_invitation':
    case 'goal_completed':
    case 'goal_failed':
    case 'goal_deadline_reminder':
    case 'progress_reminder':
    case 'participant_joined':
    case 'verification_result':
      if (data.goalId) {
        navigate('GoalDetail', { goalId: data.goalId });
      }
      break;
    case 'payment_received':
      navigate('Wallet');
      break;
    default:
      // Navigate to home if no specific handler
      break;
  }
}

