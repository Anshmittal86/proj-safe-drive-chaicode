import { Accelerometer, Gyroscope, DeviceMotion, Magnetometer } from 'expo-sensors';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { DriveEvent, RoutePoint, DriveSession, StorageService } from './storage-service';
import { AIFeedbackService } from './ai-feedback';

export interface Thresholds {
  braking: number;      // m/s^2 (e.g. 3.0)
  acceleration: number; // m/s^2 (e.g. 2.5)
  turn: number;         // rad/s (e.g. 0.5)
  steer: number;        // rad/s^2 (e.g. 1.2)
  deviceMovement: number; // variance threshold
  phoneHandling: number; // angle diff in degrees (e.g. 15)
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  braking: 3.0,
  acceleration: 2.5,
  turn: 0.5,
  steer: 1.2,
  deviceMovement: 0.8,
  phoneHandling: 15.0,
};

export interface TelemetryData {
  accel: { x: number; y: number; z: number; magnitude: number };
  gyro: { x: number; y: number; z: number; magnitude: number };
  mag: { x: number; y: number; z: number; magnitude: number };
  userAccel: { x: number; y: number; z: number; magnitude: number; horizontal: number };
  rotationRate: { x: number; y: number; z: number };
}

export interface DriveCallbacks {
  onEventDetected: (event: DriveEvent) => void;
  onTelemetryUpdated: (data: TelemetryData) => void;
  onLocationUpdated: (point: RoutePoint) => void;
  onSessionEnded: (session: DriveSession) => void;
  onError: (error: string) => void;
}

class SensorServiceManager {
  private thresholds: Thresholds = { ...DEFAULT_THRESHOLDS };
  private isActive: boolean = false;
  private isSimulated: boolean = false;
  private startTime: number = 0;
  private score: number = 100;
  private duration: number = 0;
  private timeline: DriveEvent[] = [];
  private path: RoutePoint[] = [];
  private eventBreakdown: Record<DriveEvent['type'], number> = {
    harsh_brake: 0,
    harsh_accel: 0,
    sharp_turn: 0,
    aggressive_steer: 0,
    excessive_movement: 0,
    phone_handling: 0,
  };

  // Sensor Subscriptions
  private accelSub: any = null;
  private gyroSub: any = null;
  private dmSub: any = null;
  private magSub: any = null;
  private locSub: any = null;
  private timerInterval: any = null;
  private simInterval: any = null;

  // Calibration vector (gravity baseline)
  private calibGravity: { x: number; y: number; z: number } = { x: 0, y: 9.81, z: 0 };
  private isCalibrated: boolean = false;

  // Running telemetry buffers
  private latestAccel = { x: 0, y: 0, z: 0 };
  private latestGyro = { x: 0, y: 0, z: 0 };
  private latestMag = { x: 0, y: 0, z: 0 };
  private latestUserAccel = { x: 0, y: 0, z: 0 };
  private latestRotationRate = { x: 0, y: 0, z: 0 };
  private latestGravity = { x: 0, y: -9.81, z: 0 };

  // Filtering variables
  private gravityFilter = { x: 0, y: -9.81, z: 0 }; // LPF for gravity fallback
  private recentUserAccelMag: number[] = [];
  private recentYawRate: number[] = [];
  private recentGyroMag: number[] = [];

  // Debouncing windows to avoid double triggers
  private lastBrakeTime: number = 0;
  private lastAccelTime: number = 0;
  private lastTurnTime: number = 0;
  private lastSteerTime: number = 0;
  private lastMoveTime: number = 0;
  private lastPhoneTime: number = 0;
  private debounceWindowMs = 2500; // 2.5 seconds debounce

  private callbacks: DriveCallbacks | null = null;

  public setThresholds(custom: Partial<Thresholds>) {
    this.thresholds = { ...this.thresholds, ...custom };
  }

  public getThresholds(): Thresholds {
    return this.thresholds;
  }

  /**
   * Request sensor and location permissions
   */
  public async requestPermissions(): Promise<boolean> {
    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      // expo-sensors permissions are automatically granted on most systems,
      // but on iOS DeviceMotion requires permission sometimes
      if (Platform.OS === 'ios') {
        const { status: dmStatus } = await DeviceMotion.requestPermissionsAsync();
        return locStatus === 'granted' && dmStatus === 'granted';
      }
      return locStatus === 'granted';
    } catch (e) {
      console.warn('Permissions request failed', e);
      return false;
    }
  }

  /**
   * Calibrate gravity vector
   */
  public calibrate() {
    this.calibGravity = {
      x: this.latestGravity.x,
      y: this.latestGravity.y,
      z: this.latestGravity.z,
    };
    const mag = Math.sqrt(
      this.calibGravity.x ** 2 + this.calibGravity.y ** 2 + this.calibGravity.z ** 2
    );
    if (mag > 0) {
      this.calibGravity = {
        x: this.calibGravity.x / mag,
        y: this.calibGravity.y / mag,
        z: this.calibGravity.z / mag,
      };
    }
    this.isCalibrated = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  public getIsCalibrated(): boolean {
    return this.isCalibrated;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getIsSimulated(): boolean {
    return this.isSimulated;
  }

  /**
   * Starts a real driving session using device hardware
   */
  public async startDrive(callbacks: DriveCallbacks) {
    if (this.isActive) return;

    this.callbacks = callbacks;
    this.isActive = true;
    this.isSimulated = false;
    this.startTime = Date.now();
    this.score = 100;
    this.duration = 0;
    this.timeline = [];
    this.path = [];
    this.eventBreakdown = {
      harsh_brake: 0,
      harsh_accel: 0,
      sharp_turn: 0,
      aggressive_steer: 0,
      excessive_movement: 0,
      phone_handling: 0,
    };

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      callbacks.onError('Location and device motion permissions are required.');
      this.isActive = false;
      return;
    }

    // Set Sensor Update Intervals & Subscribe with availability checks
    const intervalMs = 100; // 10Hz
    try {
      const accelAvailable = await Accelerometer.isAvailableAsync();
      if (accelAvailable) {
        Accelerometer.setUpdateInterval(intervalMs);
        // Accelerometer Subscription
        this.accelSub = Accelerometer.addListener((data) => {
          // Data is in Gs. Convert to m/s^2 (1G = 9.81 m/s^2)
          this.latestAccel = {
            x: data.x * 9.81,
            y: data.y * 9.81,
            z: data.z * 9.81,
          };
          // Fallback LPF for gravity
          const alpha = 0.95;
          this.gravityFilter.x = alpha * this.gravityFilter.x + (1 - alpha) * this.latestAccel.x;
          this.gravityFilter.y = alpha * this.gravityFilter.y + (1 - alpha) * this.latestAccel.y;
          this.gravityFilter.z = alpha * this.gravityFilter.z + (1 - alpha) * this.latestAccel.z;
          this.processRawData();
        });
      }
    } catch (err) { console.warn('Accelerometer unavailable:', err); }

    try {
      const gyroAvailable = await Gyroscope.isAvailableAsync();
      if (gyroAvailable) {
        Gyroscope.setUpdateInterval(intervalMs);
        // Gyroscope Subscription
        this.gyroSub = Gyroscope.addListener((data) => {
          // Data in rad/s
          this.latestGyro = { x: data.x, y: data.y, z: data.z };
        });
      }
    } catch (err) { console.warn('Gyroscope unavailable:', err); }

    try {
      const magAvailable = await Magnetometer.isAvailableAsync();
      if (magAvailable) {
        Magnetometer.setUpdateInterval(intervalMs);
        // Magnetometer Subscription
        this.magSub = Magnetometer.addListener((data) => {
          // Data in microteslas
          this.latestMag = { x: data.x, y: data.y, z: data.z };
        });
      }
    } catch (err) { console.warn('Magnetometer unavailable:', err); }

    try {
      const dmAvailable = await DeviceMotion.isAvailableAsync();
      if (dmAvailable) {
        DeviceMotion.setUpdateInterval(intervalMs);
        // DeviceMotion Subscription (provides fused sensor data, gravity vector and user acceleration)
        this.dmSub = DeviceMotion.addListener((data: any) => {
          if (data.acceleration) {
            // user acceleration (gravity excluded) in m/s^2
            this.latestUserAccel = {
              x: data.acceleration.x,
              y: data.acceleration.y,
              z: data.acceleration.z,
            };
          }
          if (data.rotationRate) {
            // rotation rate in rad/s
            this.latestRotationRate = {
              x: data.rotationRate.alpha,
              y: data.rotationRate.beta,
              z: data.rotationRate.gamma,
            };
          }
          if (data.gravity) {
            // gravity vector
            this.latestGravity = {
              x: data.gravity.x,
              y: data.gravity.y,
              z: data.gravity.z,
            };
          }
        });
      }
    } catch (err) { console.warn('DeviceMotion unavailable:', err); }

    // GPS Tracking
    try {
      this.locSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 2000,
          distanceInterval: 10,
        },
        (loc) => {
          const speed = loc.coords.speed ?? 0;
          // Map to route point with dynamic safety color based on speed and local events
          let safetyColor = '#10B981'; // Green
          if (this.latestUserAccelMag() > this.thresholds.braking) {
            safetyColor = '#EF4444'; // Red
          } else if (this.latestUserAccelMag() > this.thresholds.braking * 0.7) {
            safetyColor = '#F59E0B'; // Orange
          }

          const point: RoutePoint = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            speed,
            timestamp: loc.timestamp,
            safetyColor,
          };
          this.path.push(point);
          callbacks.onLocationUpdated(point);
        }
      );
    } catch (err) {
      console.warn('GPS location tracking failed to start:', err);
    }

    // Session Timer
    this.timerInterval = setInterval(() => {
      this.duration++;
    }, 1000);
  }

  /**
   * End the current drive session
   */
  public async endDrive(): Promise<DriveSession | null> {
    if (!this.isActive) return null;

    // Clean up timers
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.simInterval) clearInterval(this.simInterval);

    // Clean up sensor subs
    try { if (this.accelSub) this.accelSub.remove(); } catch (_) {}
    try { if (this.gyroSub) this.gyroSub.remove(); } catch (_) {}
    try { if (this.magSub) this.magSub.remove(); } catch (_) {}
    try { if (this.dmSub) this.dmSub.remove(); } catch (_) {}
    try { if (this.locSub) this.locSub.remove(); } catch (_) {}

    this.accelSub = null;
    this.gyroSub = null;
    this.magSub = null;
    this.dmSub = null;
    this.locSub = null;
    this.timerInterval = null;
    this.simInterval = null;

    const endTime = Date.now();
    const finalScore = Math.max(0, this.score);

    let rating: DriveSession['rating'] = 'Elite';
    if (finalScore < 70) rating = 'Risky';
    else if (finalScore < 85) rating = 'Average';
    else if (finalScore < 95) rating = 'Safe';

    // Ensure path has at least a mock starting point if GPS was disabled or unavailable
    if (this.path.length === 0) {
      this.path = this.generateMockPath();
    }

    const session: DriveSession = {
      id: this.startTime.toString(),
      date: new Date().toISOString(),
      startTime: this.startTime,
      endTime,
      duration: this.duration,
      score: finalScore,
      rating,
      totalEvents: this.timeline.length,
      eventBreakdown: { ...this.eventBreakdown },
      timeline: [...this.timeline],
      path: [...this.path],
    };

    session.aiFeedback = AIFeedbackService.generateFeedback(session);

    // Save to storage
    await StorageService.saveDrive(session);

    this.isActive = false;
    this.isSimulated = false;

    if (this.callbacks) {
      this.callbacks.onSessionEnded(session);
    }

    return session;
  }

  /**
   * Process raw sensor reading (at 10Hz) to run event detection math
   */
  private processRawData() {
    if (!this.isActive || this.isSimulated) return;

    const now = Date.now();

    // Use DeviceMotion gravity if calibrated, otherwise LPF fallback gravity
    const gravityVec = this.latestGravity.x !== 0 ? this.latestGravity : this.gravityFilter;
    const accelVec = this.latestAccel;
    const gyroVec = this.latestGyro;

    // Normalizing gravity
    const gMag = Math.sqrt(gravityVec.x ** 2 + gravityVec.y ** 2 + gravityVec.z ** 2);
    const gUnit = gMag > 0 ? { x: gravityVec.x / gMag, y: gravityVec.y / gMag, z: gravityVec.z / gMag } : { x: 0, y: -1, z: 0 };

    // Separate user acceleration (from accelerometer)
    // userAccel = accel - gravity
    // Using DeviceMotion userAccel as primary, fallback to LPF subtraction
    const userAccel = this.latestUserAccel.x !== 0 
      ? this.latestUserAccel 
      : { x: accelVec.x - gravityVec.x, y: accelVec.y - gravityVec.y, z: accelVec.z - gravityVec.z };

    // Math projection: Project user acceleration vector onto gravity
    const userVertMag = userAccel.x * gUnit.x + userAccel.y * gUnit.y + userAccel.z * gUnit.z;
    const userVert = { x: userVertMag * gUnit.x, y: userVertMag * gUnit.y, z: userVertMag * gUnit.z };

    // Horizontal acceleration: userAccel - userVert
    const userHoriz = {
      x: userAccel.x - userVert.x,
      y: userAccel.y - userVert.y,
      z: userAccel.z - userVert.z,
    };
    const userHorizMag = Math.sqrt(userHoriz.x ** 2 + userHoriz.y ** 2 + userHoriz.z ** 2);

    // Yaw Rate (rotation around gravity axis)
    const yawRate = Math.abs(gyroVec.x * gUnit.x + gyroVec.y * gUnit.y + gyroVec.z * gUnit.z);

    // Maintain circular buffers for threshold calculations (last 10 samples, i.e., 1 second)
    this.bufferPush(this.recentUserAccelMag, userHorizMag, 10);
    this.bufferPush(this.recentYawRate, yawRate, 10);
    const gyroMag = Math.sqrt(gyroVec.x ** 2 + gyroVec.y ** 2 + gyroVec.z ** 2);
    this.bufferPush(this.recentGyroMag, gyroMag, 10);

    // Live telemetry telemetry update callback
    if (this.callbacks) {
      this.callbacks.onTelemetryUpdated({
        accel: { ...accelVec, magnitude: Math.sqrt(accelVec.x**2 + accelVec.y**2 + accelVec.z**2) },
        gyro: { ...gyroVec, magnitude: gyroMag },
        mag: { ...this.latestMag, magnitude: Math.sqrt(this.latestMag.x**2 + this.latestMag.y**2 + this.latestMag.z**2) },
        userAccel: { ...userAccel, magnitude: Math.sqrt(userAccel.x**2 + userAccel.y**2 + userAccel.z**2), horizontal: userHorizMag },
        rotationRate: { ...this.latestRotationRate },
      });
    }

    // 1. Harsh Braking & Acceleration Detection
    // For dashboard mounted portrait phone: Y axis points up, Z points out of screen.
    // If the phone is mounted, car decelerates $\rightarrow$ forward force pushes phone forward.
    // To make this robust, we look at userHorizMag.
    // If userHorizMag exceeds threshold and yaw rate is low (not a turn), check orientation component:
    if (userHorizMag > this.thresholds.braking && yawRate < 0.3) {
      // Differentiate acceleration vs braking.
      // Dashboard mounted standard portrait: deceleration is typically negative along Y or positive along Z.
      // For general cases, if Y acceleration is negative, we assume Braking, else Acceleration.
      // (This is calibrated by baseline orientation).
      const isBraking = userAccel.y < 0; 

      if (isBraking && now - this.lastBrakeTime > this.debounceWindowMs) {
        this.registerEvent('harsh_brake', 'Harsh Braking', userHorizMag, -5);
        this.lastBrakeTime = now;
      }
    } else if (userHorizMag > this.thresholds.acceleration && yawRate < 0.3) {
      const isAccel = userAccel.y >= 0;

      if (isAccel && now - this.lastAccelTime > this.debounceWindowMs) {
        this.registerEvent('harsh_accel', 'Harsh Acceleration', userHorizMag, -5);
        this.lastAccelTime = now;
      }
    }

    // 2. Sharp Turns Detection
    if (yawRate > this.thresholds.turn && now - this.lastTurnTime > this.debounceWindowMs) {
      this.registerEvent('sharp_turn', 'Sharp Turn', yawRate, -3);
      this.lastTurnTime = now;
    }

    // 3. Aggressive Steering / Swerving Detection
    // Detected by fast rate-of-change of yaw rate (angular acceleration)
    if (this.recentYawRate.length >= 2) {
      const deltaYaw = Math.abs(this.recentYawRate[this.recentYawRate.length - 1] - this.recentYawRate[this.recentYawRate.length - 2]);
      const angularAccel = deltaYaw / 0.1; // 100ms sample rate
      if (angularAccel > this.thresholds.steer && now - this.lastSteerTime > this.debounceWindowMs) {
        this.registerEvent('aggressive_steer', 'Aggressive Steering', angularAccel, -3);
        this.lastSteerTime = now;
      }
    }

    // 4. Excessive Device Movement Detection
    // Check if phone itself is moving (high gyroscope variance and accelerometer variance)
    if (this.recentGyroMag.length >= 10) {
      const gyroStdDev = this.calculateStdDev(this.recentGyroMag);
      const accelStdDev = this.calculateStdDev(this.recentUserAccelMag);
      
      if (gyroStdDev > this.thresholds.deviceMovement && accelStdDev > 2.0 && now - this.lastMoveTime > this.debounceWindowMs) {
        this.registerEvent('excessive_movement', 'Excessive Phone Vibration', gyroStdDev, -2);
        this.lastMoveTime = now;
      }
    }

    // 5. Phone Handling Detection
    // Picked up or manipulated. We compare current gravity vector unit with calibrated gravity.
    if (this.isCalibrated) {
      const dotProd = gUnit.x * this.calibGravity.x + gUnit.y * this.calibGravity.y + gUnit.z * this.calibGravity.z;
      // Clamp dot product due to float inaccuracies
      const clampedDot = Math.max(-1.0, Math.min(1.0, dotProd));
      const angleDeg = Math.acos(clampedDot) * (180 / Math.PI);

      // If angle changes by more than threshold (e.g. 15 degrees) and there is gyroscope movement
      if (angleDeg > this.thresholds.phoneHandling && gyroMag > 0.4 && now - this.lastPhoneTime > this.debounceWindowMs) {
        this.registerEvent('phone_handling', 'Distracted Phone Handling', angleDeg, -10);
        this.lastPhoneTime = now;
      }
    }
  }

  /**
   * Directly register an event
   */
  public registerEvent(
    type: DriveEvent['type'],
    label: string,
    magnitude: number,
    scoreImpact: number
  ) {
    const event: DriveEvent = {
      id: Math.random().toString(),
      type,
      label,
      timestamp: Date.now() - this.startTime,
      magnitude: parseFloat(magnitude.toFixed(2)),
      scoreImpact,
    };

    this.score = Math.max(0, this.score + scoreImpact);
    this.eventBreakdown[type]++;
    this.timeline.push(event);

    // Trigger haptics
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    if (this.callbacks) {
      this.callbacks.onEventDetected(event);
    }
  }

  /**
   * Helper to push to rolling buffer
   */
  private bufferPush(arr: number[], val: number, max: number) {
    arr.push(val);
    if (arr.length > max) {
      arr.shift();
    }
  }

  /**
   * Helper to calculate standard deviation
   */
  private calculateStdDev(arr: number[]): number {
    if (arr.length === 0) return 0;
    const avg = arr.reduce((sum, v) => sum + v, 0) / arr.length;
    const sqDiffSum = arr.reduce((sum, v) => sum + (v - avg) ** 2, 0);
    return Math.sqrt(sqDiffSum / arr.length);
  }

  private latestUserAccelMag(): number {
    return Math.sqrt(
      this.latestUserAccel.x ** 2 + this.latestUserAccel.y ** 2 + this.latestUserAccel.z ** 2
    );
  }

  /**
   * Generate an SVG path mapping when GPS location fails/disabled
   */
  private generateMockPath(): RoutePoint[] {
    const points: RoutePoint[] = [];
    const baseLat = 37.7749; // San Francisco
    const baseLng = -122.4194;
    const segments = 15;
    for (let i = 0; i < segments; i++) {
      // Create a nice winding path
      const ratio = i / (segments - 1);
      const angle = ratio * Math.PI * 1.5;
      const offsetLat = Math.sin(angle) * 0.005;
      const offsetLng = ratio * 0.01;
      points.push({
        latitude: baseLat + offsetLat,
        longitude: baseLng + offsetLng,
        speed: 12 + Math.sin(ratio * 10) * 4,
        timestamp: this.startTime + i * (this.duration / segments) * 1000,
        safetyColor: i === 4 || i === 8 ? '#EF4444' : '#10B981', // Highlight mocks
      });
    }
    return points;
  }

  // ==========================================
  // DRIVE SIMULATION SYSTEM (STRETCH GOAL / DEV TESTING)
  // ==========================================

  public startSimulation(profile: 'commute' | 'sport' | 'distracted', callbacks: DriveCallbacks) {
    if (this.isActive) return;

    this.callbacks = callbacks;
    this.isActive = true;
    this.isSimulated = true;
    this.startTime = Date.now();
    this.score = 100;
    this.duration = 0;
    this.timeline = [];
    this.path = [];
    this.eventBreakdown = {
      harsh_brake: 0,
      harsh_accel: 0,
      sharp_turn: 0,
      aggressive_steer: 0,
      excessive_movement: 0,
      phone_handling: 0,
    };

    // Simulated San Francisco start coordinates
    const baseLat = 37.7749;
    const baseLng = -122.4194;
    let lat = baseLat;
    let lng = baseLng;
    let speed = 0; // m/s
    let heading = 0; // radians

    const simEventTimings: { time: number; type: DriveEvent['type']; label: string; impact: number; mag: number }[] = [];

    if (profile === 'commute') {
      simEventTimings.push(
        { time: 5, type: 'harsh_accel', label: 'Harsh Acceleration', impact: -5, mag: 2.8 },
        { time: 15, type: 'harsh_brake', label: 'Harsh Braking', impact: -5, mag: 3.3 },
        { time: 24, type: 'sharp_turn', label: 'Sharp Turn', impact: -3, mag: 0.6 }
      );
    } else if (profile === 'sport') {
      simEventTimings.push(
        { time: 4, type: 'harsh_accel', label: 'Harsh Acceleration', impact: -5, mag: 3.8 },
        { time: 10, type: 'aggressive_steer', label: 'Aggressive Steering', impact: -3, mag: 1.5 },
        { time: 15, type: 'sharp_turn', label: 'Sharp Turn', impact: -3, mag: 0.8 },
        { time: 20, type: 'harsh_brake', label: 'Harsh Braking', impact: -5, mag: 4.5 },
        { time: 26, type: 'aggressive_steer', label: 'Aggressive Steering', impact: -3, mag: 1.8 }
      );
    } else if (profile === 'distracted') {
      simEventTimings.push(
        { time: 6, type: 'phone_handling', label: 'Distracted Phone Handling', impact: -10, mag: 25.0 },
        { time: 14, type: 'excessive_movement', label: 'Excessive Phone Vibration', impact: -2, mag: 1.2 },
        { time: 20, type: 'phone_handling', label: 'Distracted Phone Handling', impact: -10, mag: 32.0 },
        { time: 25, type: 'harsh_brake', label: 'Harsh Braking (Distracted)', impact: -5, mag: 3.6 }
      );
    }

    // Set simulator interval: runs every 500ms
    this.simInterval = setInterval(() => {
      this.duration += 0.5;

      // Update position along a simulated path
      speed = speed + (Math.random() - 0.4) * 2;
      speed = Math.max(2, Math.min(25, speed)); // Cap simulated speed

      // Add simple swerves/direction shifts
      heading += (Math.random() - 0.5) * 0.2;
      lat += (Math.cos(heading) * speed * 0.000005);
      lng += (Math.sin(heading) * speed * 0.000005);

      // Check for scheduled events
      const timeSec = Math.floor(this.duration);
      const scheduledEventIndex = simEventTimings.findIndex((e) => e.time === timeSec);

      let safetyColor = '#10B981'; // Green

      if (scheduledEventIndex !== -1) {
        const e = simEventTimings[scheduledEventIndex];
        simEventTimings.splice(scheduledEventIndex, 1); // Remove so it only triggers once
        this.registerEvent(e.type, e.label, e.mag, e.impact);
        safetyColor = e.impact <= -10 ? '#EF4444' : '#F59E0B'; // red or orange
      }

      const point: RoutePoint = {
        latitude: lat,
        longitude: lng,
        speed,
        timestamp: Date.now(),
        safetyColor,
      };
      this.path.push(point);
      callbacks.onLocationUpdated(point);

      // Generate fake telemetry waveform peaks based on events
      const rawFactor = scheduledEventIndex !== -1 ? 4.0 : 0.8;
      const fakeAccel = {
        x: (Math.random() - 0.5) * rawFactor * 3,
        y: (Math.random() - 0.5) * rawFactor * 3 - 0.2,
        z: (Math.random() - 0.5) * rawFactor * 3 - 9.8, // include gravity
      };
      const fakeGyro = {
        x: (Math.random() - 0.5) * rawFactor * 0.2,
        y: (Math.random() - 0.5) * rawFactor * 0.2,
        z: (Math.random() - 0.5) * rawFactor * 0.2,
      };

      callbacks.onTelemetryUpdated({
        accel: { ...fakeAccel, magnitude: Math.sqrt(fakeAccel.x**2 + fakeAccel.y**2 + fakeAccel.z**2) },
        gyro: { ...fakeGyro, magnitude: Math.sqrt(fakeGyro.x**2 + fakeGyro.y**2 + fakeGyro.z**2) },
        mag: { x: 20 + Math.random(), y: -40 + Math.random(), z: -10 + Math.random(), magnitude: 45 },
        userAccel: {
          x: fakeAccel.x,
          y: fakeAccel.y,
          z: fakeAccel.z + 9.8,
          magnitude: Math.sqrt(fakeAccel.x**2 + fakeAccel.y**2 + (fakeAccel.z+9.8)**2),
          horizontal: Math.sqrt(fakeAccel.x**2 + fakeAccel.y**2),
        },
        rotationRate: { x: fakeGyro.x, y: fakeGyro.y, z: fakeGyro.z },
      });

      // Auto end after 30 seconds
      if (this.duration >= 30) {
        this.endDrive();
      }
    }, 500);
  }
}

export const SensorService = new SensorServiceManager();
