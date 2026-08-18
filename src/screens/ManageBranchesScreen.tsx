import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { branchesApi, HttpError } from '../api/client';
import type { Branch } from '../types/api';
import { cardShadow, colors } from '../theme/colors';
import { NoteBox } from '../components/NoteBox';
import { AppMapCircle, AppMapMarker, AppMapView, type LatLng, type MapPressEvent } from '../components/AppMap';

const DEFAULT_RADIUS = 100;
// Falls back to a harmless default map center (no GPS fix yet, or permission not granted) so
// the picker is never blank — the owner just taps/drags to the real spot.
const FALLBACK_REGION = { latitude: 35.6892, longitude: 51.389 };

export default function ManageBranchesScreen() {
  const { authFetch } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [radiusText, setRadiusText] = useState(String(DEFAULT_RADIUS));
  const [point, setPoint] = useState<LatLng>(FALLBACK_REGION);
  const [isLocating, setIsLocating] = useState(false);

  const mapRef = useRef<AppMapView>(null);

  const load = useCallback(async () => {
    try {
      const result = await authFetch((token) => branchesApi.list(token));
      setBranches(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not load branches');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const moveMapTo = (coordinate: LatLng) => {
    setPoint(coordinate);
    mapRef.current?.animateToRegion({
      ...coordinate,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const startNew = () => {
    setEditingId(null);
    setName('');
    setRadiusText(String(DEFAULT_RADIUS));
    setMessage(null);
    setError(null);
  };

  const editBranch = (branch: Branch) => {
    setEditingId(branch._id);
    setName(branch.name);
    setRadiusText(String(branch.radiusMeters));
    setMessage(null);
    setError(null);
    moveMapTo({ latitude: branch.lat, longitude: branch.lng });
  };

  const onMapPress = (event: MapPressEvent) => {
    setPoint(event.nativeEvent.coordinate);
  };

  const useMyLocation = async () => {
    setError(null);
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is needed to use your current position');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      moveMapTo({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      setError('Could not get your current location');
    } finally {
      setIsLocating(false);
    }
  };

  const onSave = async () => {
    if (!name.trim()) {
      setError('Give the branch a name');
      return;
    }
    const radiusMeters = Number(radiusText);
    if (!Number.isFinite(radiusMeters) || radiusMeters < 10 || radiusMeters > 5000) {
      setError('Radius must be a number between 10 and 5000 meters');
      return;
    }
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      await authFetch((token) =>
        branchesApi.upsert(token, {
          id: editingId ?? undefined,
          name: name.trim(),
          lat: point.latitude,
          lng: point.longitude,
          radiusMeters,
        }),
      );
      setMessage('Saved');
      startNew();
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not save branch');
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    setError(null);
    setDeletingId(id);
    try {
      await authFetch((token) => branchesApi.delete(token, id));
      if (editingId === id) startNew();
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not delete branch');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {branches.length > 0 && (
        <>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="business-outline" size={16} color={colors.text} />
            <Text style={styles.sectionTitleDark}>Existing Branches</Text>
          </View>
          {branches.map((branch) => (
            <View key={branch._id} style={styles.branchRow}>
              <Pressable style={styles.branchInfo} onPress={() => editBranch(branch)}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.branchText}>{branch.name}</Text>
                <Text style={styles.branchMeta}>{branch.radiusMeters} m radius</Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(branch._id)}
                disabled={deletingId === branch._id}
                hitSlop={8}
              >
                {deletingId === branch._id ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                )}
              </Pressable>
            </View>
          ))}
        </>
      )}

      <View style={styles.sectionTitleRow}>
        <Ionicons name="create-outline" size={16} color={colors.text} />
        <Text style={styles.sectionTitleDark}>{editingId ? 'Edit Branch' : 'New Branch'}</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Name, e.g. Downtown"
        value={name}
        onChangeText={setName}
      />

      <View style={styles.radiusRow}>
        <Text style={styles.sectionLabel}>Geofence radius</Text>
        <TextInput
          style={styles.radiusInput}
          value={radiusText}
          onChangeText={setRadiusText}
          keyboardType="numeric"
          placeholder="100"
        />
        <Text style={styles.radiusUnit}>meters</Text>
      </View>

      <NoteBox variant="info">
        Tap the map to place the branch, or use your current location if you're standing there.
      </NoteBox>

      <AppMapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ ...point, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        onPress={onMapPress}
      >
        <AppMapMarker
          coordinate={point}
          draggable
          onDragEnd={(e) => setPoint(e.nativeEvent.coordinate)}
        />
        <AppMapCircle
          center={point}
          radius={Number(radiusText) || DEFAULT_RADIUS}
          strokeColor={colors.primary}
          fillColor="rgba(59,130,246,0.15)"
        />
      </AppMapView>

      <Pressable style={styles.locateButton} onPress={useMyLocation} disabled={isLocating}>
        {isLocating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="navigate-outline" size={16} color={colors.primary} />
        )}
        <Text style={styles.locateButtonText}>Use my current location</Text>
      </Pressable>

      {message && <NoteBox variant="success">{message}</NoteBox>}
      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.saveButton, isSaving && styles.buttonDisabled]}
        onPress={onSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text style={styles.saveButtonText}>{editingId ? 'Save Changes' : 'Create Branch'}</Text>
          </>
        )}
      </Pressable>

      {editingId && (
        <Pressable style={styles.cancelButton} onPress={startNew}>
          <Text style={styles.cancelButtonText}>Cancel editing, start a new branch</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  error: { color: colors.danger },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  sectionTitleDark: { fontSize: 13, fontWeight: '700', color: colors.text },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    ...cardShadow,
  },
  branchInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  branchText: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  branchMeta: { fontSize: 12, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  radiusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radiusInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    width: 90,
  },
  radiusUnit: { fontSize: 13, color: colors.textMuted },
  map: {
    width: '100%',
    height: 260,
    borderRadius: 12,
  },
  locateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  locateButtonText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.teal,
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelButton: { alignItems: 'center', padding: 8 },
  cancelButtonText: { color: colors.textMuted, fontSize: 13 },
});
