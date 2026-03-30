import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { LAHORE_CENTER, reverseGeocode } from '@lib/geoapify';
import { tokens } from '@theme/tokens';

const DEBOUNCE_MS = 450;

interface AddressMapPickerProps {
  /** When set (e.g. editing), marker starts here. */
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  onSelect: (addressLine: string, city: string, lat: number, lng: number) => void;
}

export function AddressMapPicker({
  initialLatitude,
  initialLongitude,
  onSelect,
}: AddressMapPickerProps) {
  const [coord, setCoord] = useState({
    latitude: initialLatitude ?? LAHORE_CENTER.latitude,
    longitude: initialLongitude ?? LAHORE_CENTER.longitude,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (initialLatitude != null && initialLongitude != null) {
      setCoord({ latitude: initialLatitude, longitude: initialLongitude });
    }
  }, [initialLatitude, initialLongitude]);

  const runGeocode = useCallback(
    (lat: number, lng: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setGeocoding(true);
        const result = await reverseGeocode(lat, lng);
        setGeocoding(false);
        if (result) {
          onSelect(result.addressLine, result.city, result.lat, result.lng);
        }
      }, DEBOUNCE_MS);
    },
    [onSelect]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const onMarkerDragEnd = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setCoord({ latitude, longitude });
      runGeocode(latitude, longitude);
    },
    [runGeocode]
  );

  const onMapPress = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setCoord({ latitude, longitude });
      runGeocode(latitude, longitude);
    },
    [runGeocode]
  );

  return (
    <View style={styles.wrap}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: coord.latitude,
          longitude: coord.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        onPress={onMapPress}
        showsUserLocation={false}
        toolbarEnabled={false}
      >
        <Marker coordinate={coord} draggable onDragEnd={onMarkerDragEnd} />
      </MapView>
      {geocoding && (
        <View style={styles.overlay}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      )}
      <Text style={styles.hint}>Tap map or drag pin to set delivery location</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 220,
    borderRadius: tokens.radiusCard,
    overflow: 'hidden',
    backgroundColor: tokens.slate200,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  hint: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    textAlign: 'center',
    fontSize: 11,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
