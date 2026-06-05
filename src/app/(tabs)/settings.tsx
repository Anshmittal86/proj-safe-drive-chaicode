import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Accelerometer, Gyroscope, Magnetometer, DeviceMotion } from 'expo-sensors';
import { useTheme } from '../../hooks/use-theme';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { TelemetryChart } from '../../components/telemetry-chart';
import { SensorService, DEFAULT_THRESHOLDS, Thresholds } from '../../services/sensor-service';
import { Spacing } from '../../constants/theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();

  // Threshold state
  const [thresholds, setThresholdsState] = useState<Thresholds>(SensorService.getThresholds());

  // Calibration status
  const [calibrated, setCalibrated] = useState(SensorService.getIsCalibrated());

  // Telemetry buffer state for the live chart
  const [telemetryPoints, setTelemetryPoints] = useState<{ x: number; y: number; z: number }[]>([]);
  const [rawSensorData, setRawSensorData] = useState({
    accel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
    mag: { x: 0, y: 0, z: 0 },
  });

  // Simulator profile
  const [simProfile, setSimProfile] = useState<'commute' | 'sport' | 'distracted'>('commute');

  // Sensors subscription when settings page is open
  useEffect(() => {
    let accelSub: any = null;
    let gyroSub: any = null;
    let magSub: any = null;
    let isMounted = true;

    const pointsBuffer: { x: number; y: number; z: number }[] = [];

    const startSensors = async () => {
      try {
        const intervalMs = 150;

        const accelAvailable = await Accelerometer.isAvailableAsync();
        if (accelAvailable && isMounted) {
          Accelerometer.setUpdateInterval(intervalMs);
          accelSub = Accelerometer.addListener((data) => {
            if (!isMounted) return;
            const x = data.x * 9.81;
            const y = data.y * 9.81;
            const z = data.z * 9.81;
            setRawSensorData((prev) => ({ ...prev, accel: { x, y, z } }));
            pointsBuffer.push({ x, y, z });
            if (pointsBuffer.length > 40) pointsBuffer.shift();
            setTelemetryPoints([...pointsBuffer]);
          });
        }

        const gyroAvailable = await Gyroscope.isAvailableAsync();
        if (gyroAvailable && isMounted) {
          Gyroscope.setUpdateInterval(intervalMs);
          gyroSub = Gyroscope.addListener((data) => {
            if (!isMounted) return;
            setRawSensorData((prev) => ({
              ...prev,
              gyro: { x: data.x, y: data.y, z: data.z },
            }));
          });
        }

        const magAvailable = await Magnetometer.isAvailableAsync();
        if (magAvailable && isMounted) {
          Magnetometer.setUpdateInterval(intervalMs);
          magSub = Magnetometer.addListener((data) => {
            if (!isMounted) return;
            setRawSensorData((prev) => ({
              ...prev,
              mag: { x: data.x, y: data.y, z: data.z },
            }));
          });
        }
      } catch (err) {
        console.warn('Sensor initialization failed on Settings screen:', err);
      }
    };

    startSensors();

    return () => {
      isMounted = false;
      try { accelSub?.remove(); } catch (_) {}
      try { gyroSub?.remove(); } catch (_) {}
      try { magSub?.remove(); } catch (_) {}
    };
  }, []);

  const handleCalibrate = () => {
    SensorService.calibrate();
    setCalibrated(true);
  };

  const updateThreshold = (key: keyof Thresholds, change: number) => {
    const val = parseFloat((thresholds[key] + change).toFixed(2));
    if (val < 0.1) return;
    const updated = { ...thresholds, [key]: val };
    setThresholdsState(updated);
    SensorService.setThresholds(updated);
  };

  const startSim = () => {
    // Navigate to dashboard tab
    router.replace('/(tabs)');
    // Small delay to let navigation complete before starting simulation
    setTimeout(() => {
      // Trigger simulation start via EventChannel or direct ref check
      // Our index dashboard screen will register callbacks and start the simulation
      // We will pass the profile via a global setting or direct call
      // For simple sync, we can store it in a static class parameter or service state
      (SensorService as any).simStartRequestedProfile = simProfile;
    }, 200);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.container, { paddingBottom: Spacing.seven }]}
      style={{ backgroundColor: theme.background }}
    >
      {/* Telemetry Visualizer Section */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Live Sensor Telemetry
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionDesc}>
          Raw accelerometer vectors (m/s²) scrolling in real-time. Move your device to see spikes.
        </ThemedText>

        <TelemetryChart title="Live Accelerometer" points={telemetryPoints} />

        <ThemedView type="backgroundElement" style={styles.telemetryCard}>
          <View style={styles.telemetryRow}>
            <ThemedText type="smallBold">Accelerometer (m/s²)</ThemedText>
            <ThemedText type="code" style={styles.valueText}>
              X: {rawSensorData.accel.x.toFixed(2)}  Y: {rawSensorData.accel.y.toFixed(2)}  Z: {rawSensorData.accel.z.toFixed(2)}
            </ThemedText>
          </View>
          <View style={styles.telemetryRow}>
            <ThemedText type="smallBold">Gyroscope (rad/s)</ThemedText>
            <ThemedText type="code" style={styles.valueText}>
              X: {rawSensorData.gyro.x.toFixed(2)}  Y: {rawSensorData.gyro.y.toFixed(2)}  Z: {rawSensorData.gyro.z.toFixed(2)}
            </ThemedText>
          </View>
          <View style={styles.telemetryRow}>
            <ThemedText type="smallBold">Magnetometer (μT)</ThemedText>
            <ThemedText type="code" style={styles.valueText}>
              X: {rawSensorData.mag.x.toFixed(0)}  Y: {rawSensorData.mag.y.toFixed(0)}  Z: {rawSensorData.mag.z.toFixed(0)}
            </ThemedText>
          </View>
        </ThemedView>
      </View>

      {/* Device Calibration Section */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Gravity Calibration
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionDesc}>
          Establishes phone alignment inside the vehicle to accurately distinguish turns from braking.
        </ThemedText>

        <Pressable
          onPress={handleCalibrate}
          style={[styles.button, { backgroundColor: theme.primary }]}
        >
          <ThemedText style={styles.buttonText}>
            {calibrated ? 'Recalibrate Orientation' : 'Calibrate Current Position'}
          </ThemedText>
        </Pressable>

        {calibrated && (
          <ThemedText type="small" style={[styles.calibStatus, { color: theme.success }]}>
            ✓ Device Calibrated. Pitch/Roll baseline locked.
          </ThemedText>
        )}
      </View>

      {/* Threshold Configurations Section */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Event Detection Thresholds
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionDesc}>
          Adjust sensitivities below. Higher values require more aggressive maneuvers to trigger.
        </ThemedText>

        {/* Harsh Brake */}
        <ThemedView type="backgroundElement" style={styles.thresholdControlCard}>
          <View>
            <ThemedText type="bold">Harsh Braking</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Deceleration (g-force threshold)
            </ThemedText>
          </View>
          <View style={styles.adjusterRow}>
            <Pressable onPress={() => updateThreshold('braking', -0.2)} style={[styles.adjBtn, { borderColor: theme.border }]}>
              <ThemedText style={styles.adjText}>-</ThemedText>
            </Pressable>
            <ThemedText type="code" style={styles.adjValue}>
              {(thresholds.braking / 9.81).toFixed(2)}g
            </ThemedText>
            <Pressable onPress={() => updateThreshold('braking', 0.2)} style={[styles.adjBtn, { borderColor: theme.border }]}>
              <ThemedText style={styles.adjText}>+</ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        {/* Harsh Acceleration */}
        <ThemedView type="backgroundElement" style={styles.thresholdControlCard}>
          <View>
            <ThemedText type="bold">Harsh Acceleration</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Acceleration (g-force threshold)
            </ThemedText>
          </View>
          <View style={styles.adjusterRow}>
            <Pressable onPress={() => updateThreshold('acceleration', -0.2)} style={[styles.adjBtn, { borderColor: theme.border }]}>
              <ThemedText style={styles.adjText}>-</ThemedText>
            </Pressable>
            <ThemedText type="code" style={styles.adjValue}>
              {(thresholds.acceleration / 9.81).toFixed(2)}g
            </ThemedText>
            <Pressable onPress={() => updateThreshold('acceleration', 0.2)} style={[styles.adjBtn, { borderColor: theme.border }]}>
              <ThemedText style={styles.adjText}>+</ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        {/* Sharp Turn */}
        <ThemedView type="backgroundElement" style={styles.thresholdControlCard}>
          <View>
            <ThemedText type="bold">Sharp Turns</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Yaw Rate (rad/s threshold)
            </ThemedText>
          </View>
          <View style={styles.adjusterRow}>
            <Pressable onPress={() => updateThreshold('turn', -0.05)} style={[styles.adjBtn, { borderColor: theme.border }]}>
              <ThemedText style={styles.adjText}>-</ThemedText>
            </Pressable>
            <ThemedText type="code" style={styles.adjValue}>
              {thresholds.turn} rad/s
            </ThemedText>
            <Pressable onPress={() => updateThreshold('turn', 0.05)} style={[styles.adjBtn, { borderColor: theme.border }]}>
              <ThemedText style={styles.adjText}>+</ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        {/* Phone Handling */}
        <ThemedView type="backgroundElement" style={styles.thresholdControlCard}>
          <View>
            <ThemedText type="bold">Phone Distraction</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Orientation Tilt (deg threshold)
            </ThemedText>
          </View>
          <View style={styles.adjusterRow}>
            <Pressable onPress={() => updateThreshold('phoneHandling', -1.0)} style={[styles.adjBtn, { borderColor: theme.border }]}>
              <ThemedText style={styles.adjText}>-</ThemedText>
            </Pressable>
            <ThemedText type="code" style={styles.adjValue}>
              {thresholds.phoneHandling}°
            </ThemedText>
            <Pressable onPress={() => updateThreshold('phoneHandling', 1.0)} style={[styles.adjBtn, { borderColor: theme.border }]}>
              <ThemedText style={styles.adjText}>+</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>

      {/* Simulator Control Section */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Driving Simulator Profiles
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionDesc}>
          Simulate standard driving trips to review event triggers, live score dials, and summaries in the simulator.
        </ThemedText>

        <View style={styles.profileRow}>
          <Pressable
            onPress={() => setSimProfile('commute')}
            style={[
              styles.profileBtn,
              {
                borderColor: theme.border,
                backgroundColor: simProfile === 'commute' ? theme.backgroundSelected : 'transparent',
              },
            ]}
          >
            <ThemedText style={styles.profileBtnText}>Safe Commute</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Minor alerts (-13)</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setSimProfile('sport')}
            style={[
              styles.profileBtn,
              {
                borderColor: theme.border,
                backgroundColor: simProfile === 'sport' ? theme.backgroundSelected : 'transparent',
              },
            ]}
          >
            <ThemedText style={styles.profileBtnText}>Sport Mode</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Aggressive driving (-19)</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setSimProfile('distracted')}
            style={[
              styles.profileBtn,
              {
                borderColor: theme.border,
                backgroundColor: simProfile === 'distracted' ? theme.backgroundSelected : 'transparent',
              },
            ]}
          >
            <ThemedText style={styles.profileBtnText}>Distracted</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Phone Handling (-27)</ThemedText>
          </Pressable>
        </View>

        <Pressable
          onPress={startSim}
          style={[styles.simButton, { backgroundColor: theme.accent }]}
        >
          <ThemedText style={styles.simButtonText}>Launch Simulated Trip (30s)</ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.five,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontWeight: '800',
    fontSize: 20,
  },
  sectionDesc: {
    lineHeight: 18,
    marginBottom: 4,
  },
  telemetryCard: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: 8,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 10,
    fontWeight: '700',
  },
  button: {
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calibStatus: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 13,
  },
  thresholdControlCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 12,
    marginVertical: 4,
  },
  adjusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adjBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjText: {
    fontSize: 18,
    fontWeight: '600',
  },
  adjValue: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 55,
    textAlign: 'center',
  },
  profileRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  profileBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  profileBtnText: {
    fontWeight: '700',
    fontSize: 12,
  },
  simButton: {
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  simButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
