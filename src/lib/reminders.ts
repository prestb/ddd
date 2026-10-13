import { Platform } from 'react-native';

export async function scheduleDailyReminder(hour = 7, minute = 0) {
  try {
    const validHour = Math.min(Math.max(Math.round(hour), 0), 23);
    const validMinute = Math.min(Math.max(Math.round(minute), 0), 59);

    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return { ok: false, message: 'Notification permission was not granted' };
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-dew', {
        name: 'Daily Dew reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your Daily Dew is ready',
        body: 'Take a quiet moment for Scripture, reflection, and prayer.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: validHour,
        minute: validMinute,
        ...(Platform.OS === 'android' ? { channelId: 'daily-dew' } : {}),
      },
    });

    const formattedHour = `${validHour % 12 || 12}:${String(validMinute).padStart(2, '0')} ${validHour >= 12 ? 'PM' : 'AM'}`;
    return { ok: true, message: `Every day at ${formattedHour}` };
  } catch {
    return { ok: false, message: 'Reminders need an Android development build' };
  }
}

export async function cancelDailyReminder() {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Expo Go cannot manage Android notification schedules on SDK 53+.
  }
}
