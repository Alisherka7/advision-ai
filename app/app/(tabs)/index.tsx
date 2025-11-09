import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from "react-native-vision-camera";
import { Worklets } from "react-native-worklets-core";
import { useFaceDetector, type Face } from "react-native-vision-camera-face-detector";

export default function FaceDetectionScreen() {
  const { hasPermission, requestPermission, status } = useCameraPermission();
  const device = useCameraDevice("front");
  const [isReady, setIsReady] = useState(false);
  const [hasFace, setHasFace] = useState(false);
  const hasAlertedRef = useRef(false);
  const faceDetectorOptions = useMemo(
    () => ({
      performanceMode: "accurate" as const,
      classificationMode: "all" as const,
      contourMode: "all" as const,
      trackingEnabled: true,
      cameraFacing: device?.position ?? "front",
    }),
    [device?.position]
  );
  const faceDetector = useFaceDetector(faceDetectorOptions);

  useEffect(() => {
    if (status) {
      console.log(
        "[FaceDetection] Camera permission status:",
        status
      );
    }
  }, [status]);

  const runOnFacesDetected = useMemo(
    () =>
      Worklets.createRunOnJS((faces: Face[]) => {
        console.log("[FaceDetection] Faces detected:", faces.length);
        if (faces.length > 0) {
          const [{ bounds }] = faces;
          console.log("[FaceDetection] Example face bounds:", bounds);
        }

        setHasFace((prev) => {
          const nextHasFace = faces.length > 0;
          if (nextHasFace !== prev && !nextHasFace) {
            hasAlertedRef.current = false;
          }
          return nextHasFace;
        });
      }),
    []
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      const faces = faceDetector.detectFaces(frame);
      runOnFacesDetected(faces);
    },
    [faceDetector, runOnFacesDetected]
  );

  useEffect(() => {
    return () => {
      faceDetector.stopListeners();
    };
  }, [faceDetector]);

  useEffect(() => {
    if (!device) {
      faceDetector.stopListeners();
    }
  }, [device, faceDetector]);

  useEffect(() => {
    if (hasFace && !hasAlertedRef.current) {
      hasAlertedRef.current = true;
      Alert.alert("Face detected", "We found a face in the camera view.", [
        {
          text: "OK",
          onPress: () => {
            hasAlertedRef.current = false;
          },
        },
      ]);
    }
  }, [hasFace]);

  if (hasPermission == null) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.message}>Checking camera permissions…</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.message}>
          We need camera access to detect faces.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant camera permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.message}>
          Looking for a compatible front camera…
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Preparing camera…</Text>
        </View>
      )}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        frameProcessor={frameProcessor}
        frameProcessorFps={5}
        onInitialized={() => {
          console.log("[FaceDetection] Camera ready");
          setIsReady(true);
        }}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>Point the camera towards a face</Text>
        <Text
          style={[
            styles.overlayStatus,
            hasFace ? styles.statusDetected : styles.statusSearching,
          ]}
        >
          {hasFace ? "Face detected!" : "Searching…"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0b0b0b",
  },
  message: {
    color: "#fff",
    textAlign: "center",
    marginTop: 16,
    fontSize: 16,
  },
  button: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#2563eb",
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 16,
  },
  overlay: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  overlayTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  overlayStatus: {
    fontSize: 24,
    fontWeight: "700",
  },
  statusDetected: {
    color: "#34d399",
  },
  statusSearching: {
    color: "#fbbf24",
  },
});
