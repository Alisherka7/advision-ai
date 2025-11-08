import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  ScrollView,
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
import { runOnJS } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import { scanFaces, type Face } from "vision-camera-face-detector";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

const SESSION_THRESHOLD_MS = 3000;
const EMBEDDINGS_STORAGE_KEY = "face-embeddings-v1";
const MATCH_THRESHOLD = 0.82;
const EMBEDDING_VECTOR_LENGTH = 128;

type StoredEmbedding = {
  id: string;
  vector: number[];
  createdAt: string;
  lastSeenAt: string;
  visits: number;
};

const cosineSimilarity = (a: number[], b: number[]) => {
  if (a.length !== b.length) {
    throw new Error("Vectors must be the same length for cosine similarity");
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const createDeterministicEmbedding = (source: string) => {
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 2147483647;
  }
  const vector: number[] = [];
  for (let i = 0; i < EMBEDDING_VECTOR_LENGTH; i += 1) {
    hash = (hash * 1664525 + 1013904223) % 4294967296;
    vector.push((hash / 4294967296) * 2 - 1);
  }
  return vector;
};

export default function FaceDetectionScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");
  const cameraRef = useRef<Camera>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [isCameraInitialized, setIsCameraInitialized] = useState(false);
  const [hasFace, setHasFace] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Searching…");
  const [logs, setLogs] = useState<string[]>([]);
  const [lastDetectionDuration, setLastDetectionDuration] = useState<
    string | null
  >(null);
  const permissionRequestedRef = useRef(false);
  const detectionStartRef = useRef<number | null>(null);
  const lastFaceBoundsRef = useRef<Face["bounds"] | null>(null);
  const isProcessingEmbeddingRef = useRef(false);
  const embeddingsRef = useRef<StoredEmbedding[]>([]);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => setIsScreenFocused(false);
    }, [])
  );

  useEffect(() => {
    console.log(
      "[FaceDetection] Camera permission status:",
      hasPermission ? "granted" : "not granted"
    );
    setLogs((current) => [
      `[${new Date().toLocaleTimeString()}] Permission: ${
        hasPermission ? "granted" : "not granted"
      }`,
      ...current,
    ]);
  }, [hasPermission]);

  useEffect(() => {
    if (!hasPermission && !permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const pushLog = useCallback((message: string) => {
    setLogs((current) => {
      const entry = `[${new Date().toLocaleTimeString()}] ${message}`;
      return [entry, ...current].slice(0, 6);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadEmbeddings = async () => {
      try {
        const raw = await AsyncStorage.getItem(EMBEDDINGS_STORAGE_KEY);
        if (raw) {
          const parsed: StoredEmbedding[] = JSON.parse(raw);
          if (isMounted) {
            embeddingsRef.current = parsed;
            pushLog(
              `Loaded ${parsed.length} stored embedding${
                parsed.length === 1 ? "" : "s"
              }`
            );
          }
        } else if (isMounted) {
          pushLog("No stored embeddings yet");
        }
      } catch (error) {
        console.warn("[FaceDetection] Failed to load embeddings", error);
        if (isMounted) {
          pushLog("Error loading embeddings (see console)");
        }
      }
    };

    loadEmbeddings().catch((error) => {
      console.warn("[FaceDetection] loadEmbeddings error", error);
    });

    return () => {
      isMounted = false;
    };
  }, [pushLog]);

  const persistEmbeddings = useCallback(async () => {
    try {
      await AsyncStorage.setItem(
        EMBEDDINGS_STORAGE_KEY,
        JSON.stringify(embeddingsRef.current)
      );
    } catch (error) {
      console.warn("[FaceDetection] persistEmbeddings error", error);
      pushLog("Failed to save embeddings (see console)");
    }
  }, [pushLog]);

  const matchEmbedding = useCallback(
    async (embedding: number[]) => {
      const stored = embeddingsRef.current;
      let bestSimilarity = -Infinity;
      let bestIndex = -1;

      stored.forEach((entry, index) => {
        if (entry.vector.length === embedding.length) {
          const similarity = cosineSimilarity(entry.vector, embedding);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestIndex = index;
          }
        }
      });

      if (bestIndex >= 0 && bestSimilarity >= MATCH_THRESHOLD) {
        const match = stored[bestIndex];
        match.lastSeenAt = new Date().toISOString();
        match.visits += 1;
        await persistEmbeddings();
        return {
          id: match.id,
          similarity: bestSimilarity,
          isNew: false,
          total: stored.length,
        };
      }

      const now = new Date().toISOString();
      const newEntry: StoredEmbedding = {
        id: `user-${Date.now()}`,
        vector: embedding,
        createdAt: now,
        lastSeenAt: now,
        visits: 1,
      };
      embeddingsRef.current = [...stored, newEntry];
      await persistEmbeddings();
      return {
        id: newEntry.id,
        similarity: null,
        isNew: true,
        total: embeddingsRef.current.length,
      };
    },
    [persistEmbeddings]
  );

  const processEmbedding = useCallback(
    async (
      photoPath: string,
      durationMs: number,
      faceBounds: Face["bounds"] | null
    ) => {
      const fileUri = photoPath.startsWith("file://")
        ? photoPath
        : `file://${photoPath}`;
      try {
        pushLog("Processing embedding job…");
        const source = JSON.stringify({
          path: photoPath.slice(-60),
          bounds: faceBounds,
          durationMs: Math.round(durationMs),
        });
        const embedding = createDeterministicEmbedding(source);
        const result = await matchEmbedding(embedding);
        if (result.isNew) {
          pushLog(
            `Stored new user (${result.id}). Total profiles: ${result.total}`
          );
        } else {
          const score = result.similarity
            ? result.similarity.toFixed(3)
            : "n/a";
          pushLog(
            `Matched existing user (${result.id}) with similarity ${score}`
          );
        }
      } catch (error) {
        console.warn("[FaceDetection] processEmbedding error", error);
        pushLog("Embedding processing failed (see console)");
      } finally {
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
          pushLog("Cleaned temporary capture");
        } catch (cleanupError) {
          console.warn("[FaceDetection] cleanup error", cleanupError);
        }
        isProcessingEmbeddingRef.current = false;
      }
    },
    [matchEmbedding, pushLog]
  );

  const queueEmbeddingProcessing = useCallback(
    async (
      photoPath: string,
      durationMs: number,
      faceBounds: Face["bounds"] | null
    ) => {
      pushLog("Queued embedding processing");
      InteractionManager.runAfterInteractions(() => {
        processEmbedding(photoPath, durationMs, faceBounds).catch((error) => {
          console.warn("[FaceDetection] embed queue error", error);
          pushLog("Embedding queue run failed (see console)");
        });
      });
    },
    [processEmbedding, pushLog]
  );

  const captureAndProcessEmbedding = useCallback(
    async (durationMs: number, faceBounds: Face["bounds"] | null) => {
      if (isProcessingEmbeddingRef.current) {
        pushLog("Embedding already running, skipping capture");
        return;
      }
      if (!cameraRef.current) {
        pushLog("Capture skipped: camera not ready");
        return;
      }

      isProcessingEmbeddingRef.current = true;
      try {
        pushLog(
          `Capturing frame after ${(durationMs / 1000).toFixed(1)}s session`
        );
        const photo = await cameraRef.current.takePhoto({
          flash: "off",
          enableShutterSound: false,
        });
        if (!photo?.path) {
          pushLog("Capture returned no file path");
          isProcessingEmbeddingRef.current = false;
          return;
        }
        await queueEmbeddingProcessing(photo.path, durationMs, faceBounds);
      } catch (error) {
        console.warn("[FaceDetection] capture error", error);
        pushLog("Capture failed (see console)");
        isProcessingEmbeddingRef.current = false;
      }
    },
    [queueEmbeddingProcessing, pushLog]
  );

  const handleFaces = useCallback(
    (faces: Face[]) => {
      const detected = faces.length > 0;
      setHasFace(detected);

      if (detected) {
        setStatusMessage("Face detected!");
        lastFaceBoundsRef.current = faces[0].bounds ?? null;
        if (detectionStartRef.current == null) {
          detectionStartRef.current = Date.now();
          setLastDetectionDuration(null);
          pushLog(`Face entered (${faces.length})`);
        }
        return;
      }

      setStatusMessage("Searching…");

      if (detectionStartRef.current != null) {
        const durationMs = Date.now() - detectionStartRef.current;
        const seconds = (durationMs / 1000).toFixed(1);
        setLastDetectionDuration(`${seconds}s`);
        if (durationMs >= SESSION_THRESHOLD_MS) {
          pushLog(`Face kept for ${seconds}s, capturing frame`);
          void captureAndProcessEmbedding(
            durationMs,
            lastFaceBoundsRef.current
          );
        } else {
          pushLog(
            `Discarded short session (${seconds}s < ${
              SESSION_THRESHOLD_MS / 1000
            }s)`
          );
        }
        detectionStartRef.current = null;
        lastFaceBoundsRef.current = null;
      }
    },
    [captureAndProcessEmbedding, pushLog]
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      const detectedFaces = scanFaces(frame);
      runOnJS(handleFaces)(detectedFaces);
    },
    [handleFaces]
  );

  const isCameraActive = useMemo(() => {
    return Boolean(hasPermission && device && isScreenFocused);
  }, [device, hasPermission, isScreenFocused]);

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

  if (device == null) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.message}>Loading camera…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isCameraInitialized && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Preparing camera…</Text>
        </View>
      )}
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isCameraActive}
        photo
        onInitialized={() => {
          console.log("[FaceDetection] VisionCamera initialized");
          pushLog("Camera ready");
          setStatusMessage("Searching…");
          setIsCameraInitialized(true);
        }}
        frameProcessor={frameProcessor}
      />
      <View style={styles.logPanel}>
        <Text style={styles.logTitle}>Live Logs</Text>
        <ScrollView
          style={styles.logScroll}
          contentContainerStyle={styles.logContent}
        >
          {logs.length === 0 ? (
            <Text style={styles.logEmpty}>Waiting for events…</Text>
          ) : (
            logs.map((log, index) => (
              <Text style={styles.logEntry} key={index}>
                {log}
              </Text>
            ))
          )}
        </ScrollView>
      </View>
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>Point the camera towards a face</Text>
        <Text
          style={[
            styles.overlayStatus,
            hasFace ? styles.statusDetected : styles.statusSearching,
          ]}
        >
          {statusMessage}
        </Text>
        {lastDetectionDuration && (
          <Text style={styles.overlayDuration}>
            Last detection: {lastDetectionDuration}
          </Text>
        )}
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
  overlayDuration: {
    marginTop: 8,
    color: "#93c5fd",
    fontSize: 16,
    fontWeight: "500",
  },
  statusDetected: {
    color: "#34d399",
  },
  statusSearching: {
    color: "#fbbf24",
  },
  logPanel: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    maxHeight: 160,
    backgroundColor: "rgba(17, 24, 39, 0.85)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.35)",
  },
  logTitle: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  logScroll: {
    maxHeight: 110,
  },
  logContent: {
    gap: 4,
  },
  logEntry: {
    color: "#e5e7eb",
    fontSize: 12,
  },
  logEmpty: {
    color: "#9ca3af",
    fontSize: 12,
    fontStyle: "italic",
  },
});
