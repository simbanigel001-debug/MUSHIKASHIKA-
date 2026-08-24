import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Camera, useCameraDevices, useFrameProcessor } from 'react-native-vision-camera';
import { RNCamera } from 'react-native-camera'; // Cross-platform camera fallback

interface RankMarshalScannerProps {
  marshalId: string;
  rankId: string;
  onClearanceSuccess: (clearanceData: any) => void;
}

export const RankMarshalScanner: React.FC<RankMarshalScannerProps> = ({
  marshalId,
  rankId,
  onClearanceSuccess,
}) => {
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);
  const [actualHeadcount, setActualHeadcount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleBarCodeRead = (event: { data: string }) => {
    if (!scannedPayload) {
      setScannedPayload(event.data);
    }
  };

  const submitDepartureClearance = async () => {
    if (!scannedPayload || !actualHeadcount) {
      Alert.alert('Error', 'Please scan conductor QR and enter verified headcount.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('https://api.fleet.co.zw/v1/marshal/clearance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrPayload: scannedPayload,
          marshalId,
          rankId,
          verifiedHeadcount: parseInt(actualHeadcount, 10),
          clearedAt: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert('Departure Cleared', `Vehicle ${data.vehicleReg} cleared with ${actualHeadcount} passengers.`);
        onClearanceSuccess(data);
        resetForm();
      } else {
        Alert.alert('Clearance Rejected', data.error || 'Failed to verify rank departure token.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Unable to reach dispatch server. Check connectivity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setScannedPayload(null);
    setActualHeadcount('');
  };

  return (
    <View style={styles.container}>
      {!scannedPayload ? (
        <View style={styles.cameraContainer}>
          <RNCamera
            style={styles.preview}
            onBarCodeRead={handleBarCodeRead}
            captureAudio={false}
          >
            <View style={styles.overlay}>
              <View style={styles.scanTarget} />
              <Text style={styles.scanText}>Align Conductor Departure QR Code</Text>
            </View>
          </RNCamera>
        </View>
      ) : (
        <View style={styles.verificationContainer}>
          <Text style={styles.title}>Verify Departure Headcount</Text>
          <Text style={styles.subtitle}>QR Token Verified</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Marshal Physical Passenger Count:</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={actualHeadcount}
              onChangeText={setActualHeadcount}
              placeholder="e.g. 15"
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={submitDepartureClearance}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>{isSubmitting ? 'Clearing...' : 'Approve Departure'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
            <Text style={styles.cancelText}>Rescan QR Code</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraContainer: { flex: 1 },
  preview: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanTarget: { width: 250, height: 250, borderWidth: 2, borderColor: '#00FF66', backgroundColor: 'transparent' },
  scanText: { color: '#FFF', marginTop: 20, fontSize: 16, fontWeight: 'bold' },
  verificationContainer: { flex: 1, padding: 24, backgroundColor: '#111827', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#10B981', marginBottom: 24 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 14, color: '#9CA3AF', marginBottom: 8 },
  input: { backgroundColor: '#1F2937', color: '#FFF', padding: 16, borderRadius: 8, fontSize: 24, fontWeight: 'bold' },
  button: { backgroundColor: '#10B981', padding: 18, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#047857' },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  cancelButton: { marginTop: 16, alignItems: 'center' },
  cancelText: { color: '#EF4444', fontSize: 14 },
});
