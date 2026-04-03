import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import maplibregl, { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import { FilesetResolver, ObjectDetector, ObjectDetectorResult } from '@mediapipe/tasks-vision';

type GeoPoint = { lat: number; lng: number; accuracy?: number | null; heading?: number | null };
type DetectionView = {
  id: string;
  label: string;
  score: number;
  bbox: { x: number; y: number; w: number; h: number };
  lat: number;
  lng: number;
  radius: number;
  timestamp: number;
};
type InputSource = 'camera' | 'upload';
type TelemetryEvent = { id: string; label: string; ts: number; payload: unknown };

const LOCAL_MODEL_PATH = '/models/defense-object-detector.tflite';
const CDN_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite';
const LOCAL_WASM_BASE = '/mediapipe';
const CDN_WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.13/wasm';
const MODEL_PATHS = [CDN_MODEL_PATH, LOCAL_MODEL_PATH];
const WASM_BASES = [CDN_WASM_BASE, LOCAL_WASM_BASE];
const MAP_STYLE = 'https://demotiles.maplibre.org/style.json'; // replace with offline/secure tiles when available
const MAP_UPDATE_INTERVAL_MS = 750;
const DEFAULT_FOV_DEG = 68;
const RUNNING_MODE: 'IMAGE' | 'VIDEO' = 'VIDEO';
const TELEMETRY_SAMPLE_MS = 1200;
const DETECTION_LINE_COLOR = '#ff2b2b';
const DETECTION_LINE_LENGTH_METERS = 160;
const DEMO_FALLBACK_LOCATION: GeoPoint = { lat: 38.8895, lng: -77.0353, accuracy: 35 };
const FORCE_ONLINE_ASSETS = true;

@Component({
  selector: 'app-airgap-vision',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './airgap-vision.html',
  styleUrl: './airgap-vision.css',
})
export class AirgapVision implements AfterViewInit, OnDestroy {
  private detector: ObjectDetector | null = null;
  private stream: MediaStream | null = null;
  private map: MapLibreMap | null = null;
  private selfMarker: Marker | null = null;
  private detectionMarkers = new Map<string, Marker>();
  private mapSourcesReady = false;
  private watchId: number | null = null;
  private animationHandle: number | null = null;
  private lastMapUpdate = 0;
  private lastTelemetryPush = 0;
  private currentVideoUrl: string | null = null;
  private fallbackLocation: GeoPoint | null = null;

  private heading: number | null = null;

  readonly mapThrottleMs = MAP_UPDATE_INTERVAL_MS;

  status = signal('Idle — camera and model not started');
  running = signal(false);
  orientationGranted = signal(false);
  headingRequired = signal(false);
  cameraFov = signal(DEFAULT_FOV_DEG);
  mapReady = signal(false);
  visionReady = signal(false);
  modelOrigin = signal<'local' | 'cdn' | 'unknown'>('unknown');
  wasmOrigin = signal<'local' | 'cdn' | 'unknown'>('unknown');
  modelPath = signal<string | null>(null);
  wasmPath = signal<string | null>(null);

  inputSource = signal<InputSource>('camera');
  uploadedVideoName = signal<string | null>(null);
  telemetry = signal<TelemetryEvent[]>([]);

  deviceLocation = signal<GeoPoint | null>(null);
  detections = signal<DetectionView[]>([]);

  @ViewChild('videoEl', { static: true }) videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('overlay', { static: true }) overlay!: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  constructor(private router: Router) {}

  async ngAfterViewInit() {
    this.setupMap();
    this.initGeoWatch();
  }

  ngOnDestroy() {
    this.stop();
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    window.removeEventListener('deviceorientation', this.handleOrientation, true);
  }

  goBack() {
    this.router.navigate(['/results']);
  }

  async start() {
    try {
      if (this.headingRequired() && !this.orientationGranted()) {
        await this.requestHeading();
        if (!this.orientationGranted()) {
          this.status.set('Heading permission denied; cannot start while heading is required.');
          return;
        }
      }

      await this.ensureDetector();
      await this.startMediaPipeline();
      if (!this.deviceLocation() && !this.fallbackLocation) {
        this.enableFallbackLocation('Using demo coordinates until GPS is available.');
      }
      this.running.set(true);
      const source = this.inputSource() === 'camera' ? 'live camera' : 'uploaded video';
      this.status.set(`Running — ${source} + geotagged detections`);
      this.detectLoop();
    } catch (err: any) {
      console.error(err);
      this.status.set(`Failed to start: ${err?.message ?? err}`);
      this.stop();
    }
  }

  stop(opts?: { keepDetector?: boolean }) {
    this.running.set(false);
    if (this.animationHandle) {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
    this.releaseMedia();
    if (this.detector && !opts?.keepDetector) {
      this.detector.close();
      this.detector = null;
      this.visionReady.set(false);
    }
    this.status.set('Stopped — media and detector released');
  }

  async requestHeading() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && 'requestPermission' in DeviceOrientationEvent) {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        this.orientationGranted.set(res === 'granted');
        if (res !== 'granted') {
          this.status.set('Orientation permission denied');
          return;
        }
      } else {
        this.orientationGranted.set(true);
      }
      window.addEventListener('deviceorientation', this.handleOrientation, true);
      this.status.set('Heading granted — live orientation active');
    } catch (err: any) {
      console.error(err);
      this.status.set(`Heading permission failed: ${err?.message ?? err}`);
    }
  }

  private handleOrientation = (event: DeviceOrientationEvent) => {
    if (event.alpha != null) {
      // alpha is rotation around z-axis; convert to compass heading
      const heading = (360 - event.alpha) % 360;
      this.heading = heading;
    }
  };

  private async ensureDetector() {
    if (this.detector) return;

    const wasmBase = FORCE_ONLINE_ASSETS ? CDN_WASM_BASE : await this.pickFirstAvailableWasmBase(WASM_BASES);
    const modelAssetPath = FORCE_ONLINE_ASSETS ? CDN_MODEL_PATH : await this.pickFirstAvailable(MODEL_PATHS);

    const fileset = await FilesetResolver.forVisionTasks(wasmBase);
    this.detector = await ObjectDetector.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath,
      },
      runningMode: RUNNING_MODE,
      maxResults: 5,
      scoreThreshold: 0.35,
    });
    this.visionReady.set(true);
    this.modelPath.set(modelAssetPath);
    this.wasmPath.set(wasmBase);
    this.modelOrigin.set(modelAssetPath.startsWith('/models') ? 'local' : 'cdn');
    this.wasmOrigin.set(wasmBase.startsWith('/mediapipe') ? 'local' : 'cdn');
    this.pushTelemetry('model-loaded', {
      modelAssetPath,
      wasmBase,
      modelOrigin: this.modelOrigin(),
      wasmOrigin: this.wasmOrigin(),
    });
    this.status.set(
      `Model ready (${this.modelOrigin()}), WASM (${this.wasmOrigin()}) — pipeline primed for ${this.inputSource()}`
    );
  }

  private async startMediaPipeline() {
    if (this.inputSource() === 'upload') {
      if (!this.currentVideoUrl) {
        throw new Error('No uploaded video selected. Choose a file first.');
      }
      this.releaseMedia();
      const video = this.videoEl.nativeElement;
      video.srcObject = null;
      video.src = this.currentVideoUrl;
      video.loop = true;
      await video.play();
      await this.syncOverlayToVideo();
      this.pushTelemetry('video-upload-started', { name: this.uploadedVideoName() });
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      this.stream = stream;
      const video = this.videoEl.nativeElement;
      video.srcObject = stream;
      await video.play();
      await this.syncOverlayToVideo();
      this.pushTelemetry('camera-started', { width: video.videoWidth, height: video.videoHeight });
    }
  }

  private async syncOverlayToVideo() {
    const video = this.videoEl.nativeElement;
    await new Promise<void>(resolve => {
      if (video.readyState >= 1) return resolve();
      video.onloadedmetadata = () => resolve();
    });

    const canvas = this.overlay.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  private detectLoop = async () => {
    if (!this.running()) return;
    const video = this.videoEl.nativeElement;
    if (this.detector && video.readyState >= 2) {
      const result = this.detector.detectForVideo(video, performance.now());
      this.handleDetections(result);
    }
    this.animationHandle = requestAnimationFrame(this.detectLoop);
  };

  private handleDetections(result: ObjectDetectorResult) {
    const video = this.videoEl.nativeElement;
    const canvas = this.overlay.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const device = this.getActiveLocation();
    if (this.fallbackLocation) {
      this.status.set('Using demo geolocation fallback for mapping');
    } else if (!this.deviceLocation()) {
      this.status.set('Waiting for device geolocation lock…');
    }

    const mapped: DetectionView[] = [];
    for (const d of result.detections) {
      const bbox = d.boundingBox;
      if (!bbox) continue;

      const centerX = (bbox.originX + bbox.width / 2) / video.videoWidth;
      const centerY = (bbox.originY + bbox.height / 2) / video.videoHeight;
      const radius = device?.accuracy ?? 25;
      const geo = this.estimateGeoFromFrame(centerX, centerY, radius);

      // Draw bounding boxes
      ctx.strokeStyle = '#00e0ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(bbox.originX, bbox.originY, bbox.width, bbox.height);

      const topLabel = d.categories[0];
      const label = topLabel?.categoryName ?? 'Unknown';
      const score = topLabel?.score ?? 0;
      const stableId = `${label}-${Math.round(centerX * 1000)}-${Math.round(centerY * 1000)}-${Math.round(
        score * 100
      )}`;

      ctx.fillStyle = 'rgba(0, 224, 255, 0.2)';
      ctx.fillRect(bbox.originX, bbox.originY - 24, bbox.width, 24);
      ctx.fillStyle = '#001017';
      ctx.font = '14px monospace';
      ctx.fillText(`${label} ${(score * 100).toFixed(1)}%`, bbox.originX + 6, bbox.originY - 6);

      mapped.push({
        id: stableId,
        label,
        score,
        bbox: {
          x: bbox.originX / video.videoWidth,
          y: bbox.originY / video.videoHeight,
          w: bbox.width / video.videoWidth,
          h: bbox.height / video.videoHeight,
        },
        lat: geo.lat,
        lng: geo.lng,
        radius,
        timestamp: Date.now(),
      });
    }

    this.detections.set(mapped);
    this.updateMapMarkers(mapped);
    this.maybePushDetectionTelemetry(mapped);
  }

  private estimateGeoFromFrame(nx: number, ny: number, baseRadiusMeters: number) {
    const device = this.getActiveLocation();
    if (!device) return { lat: 0, lng: 0 };

    const headingDeg = this.heading ?? 0;
    const fov = this.cameraFov();

    const horizontalOffsetDeg = (nx - 0.5) * fov;
    const bearing = (headingDeg + horizontalOffsetDeg + 360) % 360;

    // Push objects further away as they near the center; keep demo-safe distance
    const distance = baseRadiusMeters + (1 - Math.abs(nx - 0.5)) * 80 + ny * 40;

    return this.destinationPoint(device.lat, device.lng, distance, bearing);
  }

  private destinationPoint(lat: number, lng: number, distanceMeters: number, bearingDeg: number) {
    const R = 6378137;
    const bearing = (bearingDeg * Math.PI) / 180;
    const dByR = distanceMeters / R;
    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;

    const newLat = Math.asin(
      Math.sin(latRad) * Math.cos(dByR) + Math.cos(latRad) * Math.sin(dByR) * Math.cos(bearing)
    );
    const newLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(dByR) * Math.cos(latRad),
        Math.cos(dByR) - Math.sin(latRad) * Math.sin(newLat)
      );

    return { lat: (newLat * 180) / Math.PI, lng: (newLng * 180) / Math.PI };
  }

  private setupMap() {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: MAP_STYLE,
      center: [0, 0],
      zoom: 2,
      attributionControl: false,
    });
    this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
    this.map.on('load', () => {
      this.mapReady.set(true);
      this.status.set('Map ready — waiting for location and detector');
      this.ensureDetectionLayers();
      this.syncSelfMarker();
    });
  }

  private syncSelfMarker() {
    if (!this.map) return;
    const device = this.getActiveLocation();
    if (!device) return;
    const lngLat = [device.lng, device.lat] as [number, number];
    if (!this.selfMarker) {
      this.selfMarker = new maplibregl.Marker({ color: '#00e0ff' }).setLngLat(lngLat).addTo(this.map);
    } else {
      this.selfMarker.setLngLat(lngLat);
    }
    this.map.flyTo({ center: lngLat, zoom: 15, essential: true });
  }

  private updateMapMarkers(detections: DetectionView[]) {
    if (!this.map || !this.mapReady()) return;
    const now = Date.now();
    if (now - this.lastMapUpdate < MAP_UPDATE_INTERVAL_MS) return;
    this.lastMapUpdate = now;

    const activeIds = new Set<string>();
    detections.forEach(det => {
      activeIds.add(det.id);
      const existing = this.detectionMarkers.get(det.id);
      if (existing) {
        existing.setLngLat([det.lng, det.lat]);
      } else {
        const marker = new maplibregl.Marker({ color: '#ff3860' })
          .setLngLat([det.lng, det.lat])
          .setPopup(
            new maplibregl.Popup({ closeButton: false, closeOnMove: false }).setHTML(
              `<strong>${det.label}</strong><br/>${(det.score * 100).toFixed(1)}%<br/>lat ${det.lat.toFixed(
                5
              )}, lng ${det.lng.toFixed(5)}`
            )
          )
          .addTo(this.map!);
        this.detectionMarkers.set(det.id, marker);
      }
    });

    // Cleanup stale markers
    for (const [id, marker] of this.detectionMarkers.entries()) {
      if (!activeIds.has(id)) {
        marker.remove();
        this.detectionMarkers.delete(id);
      }
    }

    this.updateDetectionLayers(detections);
  }

  private initGeoWatch() {
    if (!('geolocation' in navigator)) {
      this.enableFallbackLocation('Geolocation not available on this device. Using demo coordinates.');
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      pos => {
        this.deviceLocation.set({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        });
        this.fallbackLocation = null;
        if (this.running()) {
          const source = this.inputSource() === 'camera' ? 'live camera' : 'uploaded video';
          this.status.set(`Running — ${source} + geotagged detections`);
        }
        this.syncSelfMarker();
      },
      err => {
        console.error(err);
        this.enableFallbackLocation(`Geolocation error: ${err.message}. Using demo coordinates.`);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
    );
  }

  toggleHeadingRequirement() {
    this.headingRequired.update(v => !v);
  }

  setFov(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isNaN(value)) {
      this.cameraFov.set(value);
    }
  }

  setInputSource(source: InputSource) {
    if (source === this.inputSource()) return;
    this.inputSource.set(source);
    this.stop({ keepDetector: true });
    this.status.set(source === 'camera' ? 'Switched to live camera' : 'Ready for uploaded video input');
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.currentVideoUrl) {
      URL.revokeObjectURL(this.currentVideoUrl);
    }

    this.currentVideoUrl = URL.createObjectURL(file);
    this.uploadedVideoName.set(file.name);
    this.inputSource.set('upload');
    this.stop({ keepDetector: true });
    this.status.set(`Loaded video ${file.name} — press Start to run offline inference`);
    this.pushTelemetry('video-selected', { name: file.name, size: file.size, type: file.type });
  }

  private releaseMedia() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    const video = this.videoEl?.nativeElement;
    if (video) {
      video.pause();
      if (video.srcObject) {
        video.srcObject = null;
      }
      if (this.inputSource() === 'upload') {
        video.removeAttribute('src');
      }
    }
  }

  private pushTelemetry(label: string, payload: unknown) {
    this.telemetry.update(events => {
      const next: TelemetryEvent[] = [...events, { id: `${Date.now()}-${events.length}`, label, ts: Date.now(), payload }];
      if (next.length > 30) next.shift();
      return next;
    });
  }

  private maybePushDetectionTelemetry(mapped: DetectionView[]) {
    const now = Date.now();
    if (now - this.lastTelemetryPush < TELEMETRY_SAMPLE_MS) return;
    this.lastTelemetryPush = now;
    this.pushTelemetry('detections', {
      count: mapped.length,
      sample: mapped.slice(0, 3),
      deviceLocation: this.deviceLocation(),
      source: this.inputSource(),
    });
  }

  private async pickFirstAvailable(options: string[]) {
    for (const candidate of options) {
      if (await this.resourceExists(candidate)) {
        return candidate;
      }
    }
    // Last fallback even if not reachable to allow error to surface
    return options[options.length - 1];
  }

  private async pickFirstAvailableWasmBase(options: string[]) {
    for (const base of options) {
      if (await this.wasmBaseExists(base)) {
        return base;
      }
    }
    // Last fallback even if not reachable to allow error to surface
    return options[options.length - 1];
  }

  private async wasmBaseExists(base: string) {
    const probes = [
      `${base}/vision_wasm_internal.wasm`,
      `${base}/vision_wasm_nosimd_internal.wasm`,
      `${base}/vision_wasm_internal.js`,
      `${base}/vision_wasm_nosimd_internal.js`,
    ];
    for (const probe of probes) {
      if (await this.resourceExists(probe)) return true;
    }
    return false;
  }

  private async resourceExists(url: string) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  }

  private getActiveLocation() {
    return this.deviceLocation() ?? this.fallbackLocation;
  }

  private enableFallbackLocation(reason: string) {
    if (this.fallbackLocation) return;
    this.fallbackLocation = { ...DEMO_FALLBACK_LOCATION };
    this.deviceLocation.set(this.fallbackLocation);
    this.status.set(reason);
    this.pushTelemetry('geo-fallback', { reason, location: this.fallbackLocation });
    this.syncSelfMarker();
  }

  private ensureDetectionLayers() {
    if (!this.map || this.mapSourcesReady) return;
    this.map.addSource('detection-lines', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    this.map.addSource('detection-labels', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    this.map.addLayer({
      id: 'detection-lines',
      type: 'line',
      source: 'detection-lines',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 2,
        'line-opacity': 0.85,
      },
    });
    this.map.addLayer({
      id: 'detection-labels',
      type: 'symbol',
      source: 'detection-labels',
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 12,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': DETECTION_LINE_COLOR,
        'text-halo-color': '#180000',
        'text-halo-width': 1,
      },
    });
    this.mapSourcesReady = true;
  }

  private updateDetectionLayers(detections: DetectionView[]) {
    if (!this.map || !this.mapSourcesReady) return;
    const lineFeatures: GeoJSON.Feature[] = [];
    const labelFeatures: GeoJSON.Feature[] = [];

    detections.forEach(det => {
      const span = Math.max(DETECTION_LINE_LENGTH_METERS, det.radius * 1.2);
      const offsets = this.metersToLatLngOffset(det.lat, span);

      lineFeatures.push(
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [det.lng - offsets.lng, det.lat],
              [det.lng + offsets.lng, det.lat],
            ],
          },
          properties: { color: DETECTION_LINE_COLOR },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [det.lng, det.lat - offsets.lat],
              [det.lng, det.lat + offsets.lat],
            ],
          },
          properties: { color: DETECTION_LINE_COLOR },
        }
      );

      labelFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [det.lng, det.lat] },
        properties: { label: `${det.label} ${det.lat.toFixed(5)}, ${det.lng.toFixed(5)}` },
      });
    });

    const lineSource = this.map.getSource('detection-lines') as GeoJSONSource;
    const labelSource = this.map.getSource('detection-labels') as GeoJSONSource;
    lineSource.setData({ type: 'FeatureCollection', features: lineFeatures });
    labelSource.setData({ type: 'FeatureCollection', features: labelFeatures });
  }

  private metersToLatLngOffset(lat: number, meters: number) {
    const metersPerDegLat = 111320;
    const metersPerDegLng = Math.max(111320 * Math.cos((lat * Math.PI) / 180), 1e-6);
    return {
      lat: meters / metersPerDegLat,
      lng: meters / metersPerDegLng,
    };
  }
}
