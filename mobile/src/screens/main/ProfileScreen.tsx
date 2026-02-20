import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { Theme } from '../../theme';
import { formatCentsToDollars } from '../../utils/formatters';
import { authApi } from '../../services/api';
import { ReminderPreferences, ReminderFrequency, RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = createStyles(theme);
  
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [reminderPrefs, setReminderPrefs] = useState<ReminderPreferences>({
    enabled: true,
    defaultFrequency: null,
    defaultReminderTime: '09:00',
    timezone: null,
  });
  const [loading, setLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);

  useEffect(() => {
    loadReminderPreferences();
  }, []);

  const loadReminderPreferences = async () => {
    try {
      const response = await authApi.getReminderPreferences();
      setReminderPrefs(response.reminderPreferences);
    } catch (error) {
      console.log('Error loading reminder preferences:', error);
    }
  };

  const updateReminderPreference = async (update: Partial<ReminderPreferences>) => {
    try {
      setLoading(true);
      const response = await authApi.updateReminderPreferences(update);
      setReminderPrefs(response.reminderPreferences);
    } catch (error) {
      Alert.alert('Error', 'Failed to update reminder preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getFrequencyLabel = (frequency: ReminderFrequency | null) => {
    switch (frequency) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      default:
        return 'Auto (based on goal)';
    }
  };

  const timeOptions = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00',
  ];

  const frequencyOptions: Array<{ value: ReminderFrequency | null; label: string }> = [
    { value: null, label: 'Auto (based on goal duration)' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const menuItems = [
    { icon: '👤', label: 'Edit Profile', onPress: () => navigation.navigate('EditProfile') },
    { icon: '🔔', label: 'Reminder Settings', onPress: () => setShowReminderSettings(true) },
    { icon: '🔒', label: 'Privacy & Security', onPress: () => navigation.navigate('PrivacySecurity') },
    { icon: '💳', label: 'Payment Methods', onPress: () => navigation.navigate('PaymentMethods') },
    { icon: '📜', label: 'Terms of Service', onPress: () => navigation.navigate('TermsOfService') },
    { icon: '❓', label: 'Help & Support', onPress: () => navigation.navigate('HelpSupport') },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'User'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatCentsToDollars(user?.walletBalance || 0)}
            </Text>
            <Text style={styles.statLabel}>Wallet</Text>
          </View>
        </View>
      </View>

      {/* Theme Toggle Section */}
      <View style={styles.themeSection}>
        <View style={styles.themeSectionHeader}>
          <Text style={styles.themeSectionTitle}>🎨 Appearance</Text>
        </View>
        <View style={styles.themeToggleRow}>
          <View style={styles.themeToggleInfo}>
            <Text style={styles.themeToggleLabel}>Dark Mode</Text>
            <Text style={styles.themeToggleDescription}>
              {isDark ? 'High-Performance Dark theme' : 'Clean FinTech Light theme'}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={isDark ? '#FFFFFF' : theme.colors.surface}
            ios_backgroundColor={theme.colors.border}
          />
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menu}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.menuItem,
              index === menuItems.length - 1 && styles.menuItemLast,
            ]}
            onPress={item.onPress}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={styles.version}>NudgeMe v1.0.0</Text>

      {/* Reminder Settings Modal */}
      <Modal
        visible={showReminderSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReminderSettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReminderSettings(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reminder Settings</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Configure your default reminder preferences. These settings apply to all goals unless overridden.
            </Text>

            {/* Enable Reminders */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Reminders</Text>
                <Text style={styles.settingDescription}>
                  Receive progress reminders for your goals
                </Text>
              </View>
              <Switch
                value={reminderPrefs.enabled}
                onValueChange={(value) => updateReminderPreference({ enabled: value })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={reminderPrefs.enabled ? '#FFFFFF' : theme.colors.textSecondary}
                disabled={loading}
              />
            </View>

            {/* Default Frequency */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setShowFrequencyPicker(true)}
              disabled={!reminderPrefs.enabled}
            >
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, !reminderPrefs.enabled && styles.settingDisabled]}>
                  Default Frequency
                </Text>
                <Text style={[styles.settingDescription, !reminderPrefs.enabled && styles.settingDisabled]}>
                  How often to send reminders
                </Text>
              </View>
              <View style={styles.settingValue}>
                <Text style={[styles.settingValueText, !reminderPrefs.enabled && styles.settingDisabled]}>
                  {getFrequencyLabel(reminderPrefs.defaultFrequency)}
                </Text>
                <Text style={styles.menuArrow}>›</Text>
              </View>
            </TouchableOpacity>

            {/* Default Time */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setShowTimePicker(true)}
              disabled={!reminderPrefs.enabled}
            >
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, !reminderPrefs.enabled && styles.settingDisabled]}>
                  Reminder Time
                </Text>
                <Text style={[styles.settingDescription, !reminderPrefs.enabled && styles.settingDisabled]}>
                  When to receive daily reminders
                </Text>
              </View>
              <View style={styles.settingValue}>
                <Text style={[styles.settingValueText, !reminderPrefs.enabled && styles.settingDisabled]}>
                  {formatTime(reminderPrefs.defaultReminderTime)}
                </Text>
                <Text style={styles.menuArrow}>›</Text>
              </View>
            </TouchableOpacity>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>💡</Text>
              <Text style={styles.infoText}>
                Reminder frequency is automatically determined based on goal duration:
                {'\n'}• Weekly goals: Daily reminders
                {'\n'}• Monthly goals: Weekly reminders
                {'\n'}• Yearly goals: Monthly reminders
                {'\n\n'}You can override this for individual goals or set a default frequency above.
              </Text>
            </View>
          </ScrollView>
        </View>

        {/* Frequency Picker Modal */}
        <Modal
          visible={showFrequencyPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFrequencyPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowFrequencyPicker(false)}
          >
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerTitle}>Select Frequency</Text>
              {frequencyOptions.map((option) => (
                <TouchableOpacity
                  key={option.value || 'auto'}
                  style={[
                    styles.pickerOption,
                    reminderPrefs.defaultFrequency === option.value && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    updateReminderPreference({ defaultFrequency: option.value });
                    setShowFrequencyPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      reminderPrefs.defaultFrequency === option.value && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {reminderPrefs.defaultFrequency === option.value && (
                    <Text style={styles.pickerCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Time Picker Modal */}
        <Modal
          visible={showTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowTimePicker(false)}
          >
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerTitle}>Select Time</Text>
              <ScrollView style={styles.timeScrollView}>
                {timeOptions.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.pickerOption,
                      reminderPrefs.defaultReminderTime === time && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      updateReminderPreference({ defaultReminderTime: time });
                      setShowTimePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        reminderPrefs.defaultReminderTime === time && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {formatTime(time)}
                    </Text>
                    {reminderPrefs.defaultReminderTime === time && (
                      <Text style={styles.pickerCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>
    </ScrollView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingBottom: 100,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: theme.isDark ? 'Inter-Bold' : 'Inter-SemiBold',
    color: theme.colors.textPrimary,
  },
  profileCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    borderRadius: theme.borderRadius.card,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 18,
    fontFamily: theme.isDark ? 'JetBrainsMono-Bold' : 'Inter-Bold',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textMuted,
  },
  // Theme toggle section
  themeSection: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    borderRadius: theme.borderRadius.cardSmall,
    marginBottom: 24,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  themeSectionHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  themeSectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: theme.colors.textSecondary,
  },
  themeToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  themeToggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  themeToggleLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  themeToggleDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
  },
  // Menu styles
  menu: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    borderRadius: theme.borderRadius.cardSmall,
    marginBottom: 24,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textPrimary,
  },
  menuArrow: {
    fontSize: 24,
    color: theme.colors.textMuted,
  },
  logoutButton: {
    backgroundColor: theme.colors.errorBg,
    marginHorizontal: 20,
    borderRadius: theme.borderRadius.button,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  logoutText: {
    color: theme.isDark ? '#FCA5A5' : theme.colors.danger,
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  version: {
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 20,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalCloseText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: theme.colors.textPrimary,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: theme.borderRadius.button,
    marginBottom: 12,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textSecondary,
  },
  settingDisabled: {
    opacity: 0.5,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValueText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: theme.colors.primary,
    marginRight: 8,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: theme.colors.infoBg,
    padding: 16,
    borderRadius: theme.borderRadius.button,
    marginTop: 12,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: theme.isDark ? '#93C5FD' : theme.colors.info,
    lineHeight: 20,
  },
  // Picker styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.cardSmall,
    width: '100%',
    maxWidth: 320,
    maxHeight: 400,
    padding: 16,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.colors.border,
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: theme.colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerOptionSelected: {
    backgroundColor: theme.colors.primary,
  },
  pickerOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: theme.colors.textPrimary,
  },
  pickerOptionTextSelected: {
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  pickerCheck: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  timeScrollView: {
    maxHeight: 300,
  },
});

export default ProfileScreen;
