import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { HttpError, usersApi } from '../api/client';
import { cardShadow, colors } from '../theme/colors';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function initials(fullName: string | undefined) {
  if (!fullName) return '?';
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  employee: 'Employee',
};

export default function ProfileScreen() {
  const { user, authFetch, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [birthDate, setBirthDate] = useState(user?.birthDate ? user.birthDate.slice(0, 10) : '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [emergencyContactName, setEmergencyContactName] = useState(
    user?.emergencyContactName ?? '',
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    user?.emergencyContactPhone ?? '',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const onSaveProfile = async () => {
    setError(null);
    setMessage(null);
    if (birthDate && !DATE_PATTERN.test(birthDate)) {
      setError('Birth date must be YYYY-MM-DD');
      return;
    }
    setIsSaving(true);
    try {
      await authFetch((token) =>
        usersApi.updateProfile(token, {
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          birthDate: birthDate || undefined,
          address: address.trim() || undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        }),
      );
      await refreshUser();
      setMessage('Saved');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const onChangePhoto = async (fromCamera: boolean) => {
    setError(null);
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Permission denied');
        return;
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (result.canceled || result.assets.length === 0) return;

      setIsUploadingPhoto(true);
      const manipulated = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400 } }],
        { compress: 0.6, format: SaveFormat.JPEG, base64: true },
      );
      if (!manipulated.base64) {
        setError('Could not process the image');
        return;
      }
      const dataUri = `data:image/jpeg;base64,${manipulated.base64}`;
      await authFetch((token) => usersApi.updateProfile(token, { avatarUrl: dataUri }));
      await refreshUser();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not update photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const onChangePassword = async () => {
    setPasswordError(null);
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setIsChangingPassword(true);
    try {
      await authFetch((token) =>
        usersApi.changePassword(token, { currentPassword, newPassword }),
      );
      setPasswordMessage('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof HttpError ? err.message : 'Could not change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
    >
      <View style={styles.avatarBox}>
        {isUploadingPhoto ? (
          <View style={styles.avatarLarge}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{initials(user?.fullName)}</Text>
          </View>
        )}
        <View style={styles.photoActions}>
          <Pressable style={styles.photoButton} onPress={() => onChangePhoto(false)}>
            <Ionicons name="images-outline" size={15} color={colors.cyan} />
            <Text style={styles.photoButtonText}>Choose Photo</Text>
          </Pressable>
          <Pressable style={styles.photoButton} onPress={() => onChangePhoto(true)}>
            <Ionicons name="camera-outline" size={15} color={colors.cyan} />
            <Text style={styles.photoButtonText}>Take Photo</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.text} />
          <Text style={styles.sectionTitleDark}>Account</Text>
        </View>
        <View style={styles.permanentRow}>
          <Text style={styles.permanentLabel}>Email</Text>
          <Text style={styles.permanentValue}>{user?.email}</Text>
        </View>
        <View style={styles.permanentRow}>
          <Text style={styles.permanentLabel}>Role</Text>
          <Text style={styles.permanentValue}>{user ? ROLE_LABELS[user.role] : ''}</Text>
        </View>
        <Text style={styles.permanentNote}>Only an owner or manager can change these.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="person-outline" size={16} color={colors.text} />
          <Text style={styles.sectionTitleDark}>Personal Info</Text>
        </View>

        <Text style={styles.fieldLabel}>Full name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

        <Text style={styles.fieldLabel}>Phone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="Optional"
        />

        <Text style={styles.fieldLabel}>Birth date</Text>
        <TextInput
          style={styles.input}
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="YYYY-MM-DD"
        />

        <Text style={styles.fieldLabel}>Address</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Optional"
        />

        <Text style={styles.fieldLabel}>Emergency contact name</Text>
        <TextInput
          style={styles.input}
          value={emergencyContactName}
          onChangeText={setEmergencyContactName}
          placeholder="Optional"
        />

        <Text style={styles.fieldLabel}>Emergency contact phone</Text>
        <TextInput
          style={styles.input}
          value={emergencyContactPhone}
          onChangeText={setEmergencyContactPhone}
          keyboardType="phone-pad"
          placeholder="Optional"
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {message && <Text style={styles.success}>{message}</Text>}

        <Pressable
          style={[styles.saveButton, isSaving && styles.buttonDisabled]}
          onPress={onSaveProfile}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="key-outline" size={16} color={colors.text} />
          <Text style={styles.sectionTitleDark}>Change Password</Text>
        </View>

        <Text style={styles.fieldLabel}>Current password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />

        <Text style={styles.fieldLabel}>New password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Min 8 characters"
        />

        <Text style={styles.fieldLabel}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        {passwordError && <Text style={styles.error}>{passwordError}</Text>}
        {passwordMessage && <Text style={styles.success}>{passwordMessage}</Text>}

        <Pressable
          style={[styles.saveButton, isChangingPassword && styles.buttonDisabled]}
          onPress={onChangePassword}
          disabled={isChangingPassword}
        >
          {isChangingPassword ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="key" size={16} color="#fff" />
              <Text style={styles.saveButtonText}>Change Password</Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14 },
  avatarBox: { alignItems: 'center', gap: 10 },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  photoButtonText: { color: colors.cyan, fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 4,
    ...cardShadow,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitleDark: { fontSize: 13, fontWeight: '700', color: colors.text },
  permanentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  permanentLabel: { fontSize: 13, color: colors.textMuted },
  permanentValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  permanentNote: { fontSize: 11, color: colors.textFaint, marginTop: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginTop: 4,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 12, marginTop: 8 },
  success: { color: colors.successText, fontSize: 12, marginTop: 8 },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.cyan,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
