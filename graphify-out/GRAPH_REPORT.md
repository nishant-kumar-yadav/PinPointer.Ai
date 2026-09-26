# Graph Report - Pinpointer  (2026-09-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 629 nodes · 1157 edges · 34 communities (24 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `00e03b17`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Database.ts
- react
- download-models.js
- NativeAudioModule
- StorageModule.java
- package.json
- NativeAudioModule
- react-native-screens-mock.js
- MainApplication.kt
- SherpaOnnxModule
- dependencies
- App.tsx
- AppDelegate
- devDependencies
- PinpointerScreen.tsx
- compilerOptions
- NativePdfModule
- gallery.tsx
- DocumentClassifier.ts
- DocumentVaultScreen.tsx
- HindiTranslit.ts
- MainActivity.kt
- NativeAudioPackage.kt
- gradlew
- RunAnywhereStarter-Bridging-Header.h
- PinpointerScreen
- custom.d.ts

## God Nodes (most connected - your core abstractions)
1. `AppLogger` - 33 edges
2. `NativeAudioModule` - 28 edges
3. `react` - 24 edges
4. `react-native` - 24 edges
5. `NativeAudioModule` - 20 edges
6. `analyzeImage()` - 16 edges
7. `performFullGallerySync()` - 15 edges
8. `compilerOptions` - 14 edges
9. `SherpaOnnxModule` - 13 edges
10. `indexDocument()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `GalleryScreen()` --references--> `react`  [EXTRACTED]
  src/screens/gallery.tsx → package.json
- `clearRecentPhotos()` --references--> `AppLogger`  [EXTRACTED]
  src/utils/RecentPhotos.ts → src/utils/AppLogger.ts
- `DocumentVaultScreen()` --calls--> `getAllDocuments()`  [EXTRACTED]
  src/screens/DocumentVaultScreen.tsx → src/Database.ts
- `App()` --calls--> `setupDatabase()`  [EXTRACTED]
  src/App.tsx → src/Database.ts
- `PinpointerProvider()` --calls--> `usePinpointer()`  [EXTRACTED]
  src/hooks/PinpointerContext.tsx → src/hooks/usePinpointer.ts

## Import Cycles
- None detected.

## Communities (34 total, 10 thin omitted)

### Community 0 - "Database.ts"
Cohesion: 0.08
Nodes (61): @react-native-async-storage/async-storage, react-native-image-resizer, @react-native-ml-kit/image-labeling, @react-native-ml-kit/text-recognition, beginTransaction(), clearIndex(), commitTransaction(), expandWithSynonyms() (+53 more)

### Community 1 - "react"
Cohesion: 0.06
Nodes (49): react, react-native, @react-native-clipboard/clipboard, react-native-fs, react-native-image-picker, react-native-linear-gradient, AudioVisualizer(), AudioVisualizerProps (+41 more)

### Community 2 - "download-models.js"
Cohesion: 0.05
Nodes (39): downloadFile(), ensureDir(), { execSync }, extractArchive(), fs, http, https, main() (+31 more)

### Community 3 - "NativeAudioModule"
Cohesion: 0.08
Nodes (22): activitycompat, AudioRecord, Promise, ReactContextBaseJavaModule, NativeAudioModule, audioformat, AudioTrack, base64 (+14 more)

### Community 4 - "StorageModule.java"
Cohesion: 0.07
Nodes (25): Override, OCRModule, Override, StorageModule, assetfiledescriptor, assetmanager, bufferedinputstream, bufferedoutputstream (+17 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (35): description, engines, node, main, name, scripts, android, ios (+27 more)

### Community 6 - "NativeAudioModule"
Cohesion: 0.11
Nodes (17): AVAudioEngine, AVAudioPlayer, AVAudioRecorder, AVFoundation, AVSpeechSynthesizer, AVSpeechSynthesizerDelegate, AVSpeechUtterance, Bool (+9 more)

### Community 7 - "react-native-screens-mock.js"
Cohesion: 0.06
Nodes (23): AnimatedScreenView, FullWindowOverlay, GHContext, InnerScreen, NativeScreen, NativeScreenComponent, NativeScreenContainer, NativeScreenContainerComponent (+15 more)

### Community 8 - "MainApplication.kt"
Cohesion: 0.11
Nodes (24): MainApplication, Override, OCRPackage, Override, StoragePackage, Application, arraylist, arrays (+16 more)

### Community 9 - "SherpaOnnxModule"
Cohesion: 0.15
Nodes (11): AudioRecord, Promise, ReactContextBaseJavaModule, SherpaOnnxModule, NativeModule, ReactApplicationContext, ReactPackage, ViewManager (+3 more)

### Community 10 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, react-native, @react-native-async-storage/async-storage, @react-native-camera-roll/camera-roll, @react-native-clipboard/clipboard, react-native-document-picker, react-native-file-viewer, react-native-fs (+13 more)

### Community 11 - "App.tsx"
Cohesion: 0.13
Nodes (15): displayName, name, react-native-gesture-handler, App(), Stack, closeDatabase(), PinpointerContextType, PinpointerCtx (+7 more)

### Community 12 - "AppDelegate"
Cohesion: 0.14
Nodes (14): AppDelegate, -applicationdidFinishLaunchingWithOptions, -bundleURL, -sourceURLForBridge, RunAnywhereStarterTests, -findSubviewInViewmatching, -testRendersWelcomeScreen, RCTAppDelegate (+6 more)

### Community 13 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, @babel/core, @babel/preset-env, @babel/runtime, eslint, patch-package, prettier, @react-native/babel-preset (+9 more)

### Community 14 - "PinpointerScreen.tsx"
Cohesion: 0.18
Nodes (12): src_components_index_featurecard, src_components_index_filtercategory, src_components_index_modeldownloadsheet, src_components_index_searchfilterchips, src_components_index_searchhistorypanel, src_components_index_syncprogresscard, usePinpointerShared(), RootStackParamList (+4 more)

### Community 15 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, isolatedModules, jsx, lib, module (+7 more)

### Community 16 - "NativePdfModule"
Cohesion: 0.20
Nodes (8): Promise, ReactContextBaseJavaModule, NativePdfModule, NativeModule, ReactApplicationContext, ReactPackage, ViewManager, NativePdfPackage

### Community 17 - "gallery.tsx"
Cohesion: 0.19
Nodes (11): react, react-native-svg, @react-navigation/native, FilterType, GalleryScreen(), styles, { width }, addRecentPhoto() (+3 more)

### Community 18 - "DocumentClassifier.ts"
Cohesion: 0.18
Nodes (12): ClassificationResult, ClassificationRule, classifyDocument(), CONTENT_STRUCTURE_KEYWORDS, EXAM_BOARD_KEYWORDS, extractIdentifier(), extractSmartTitle(), FILENAME_PATTERNS (+4 more)

### Community 19 - "DocumentVaultScreen.tsx"
Cohesion: 0.27
Nodes (9): @react-navigation/stack, DocumentRecord, CATEGORY_COLORS, CategoryGroup, DocumentVaultScreen(), groupDocumentsByCategory(), Props, styles (+1 more)

### Community 20 - "HindiTranslit.ts"
Cohesion: 0.28
Nodes (8): ALL_CHARS, CONSONANTS, enrichHindi(), HINDI_DICT, lookupEnglish(), MATRAS, transliterate(), VOWELS

### Community 21 - "MainActivity.kt"
Cohesion: 0.32
Nodes (5): MainActivity, defaultreactactivitydelegate, fabricenabled, ReactActivity, ReactActivityDelegate

### Community 22 - "NativeAudioPackage.kt"
Cohesion: 0.43
Nodes (5): NativeModule, ReactApplicationContext, ReactPackage, ViewManager, NativeAudioPackage

### Community 23 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

## Knowledge Gaps
- **192 isolated node(s):** `LogEntry`, `PdfMetadata`, `PdfProcessingStatus`, `DetectionType`, `VisionResult` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 296 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react-native` connect `react` to `Database.ts`, `package.json`, `react-native-screens-mock.js`, `App.tsx`, `PinpointerScreen.tsx`, `gallery.tsx`, `DocumentVaultScreen.tsx`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `Database.ts`, `package.json`, `react-native-screens-mock.js`, `App.tsx`, `PinpointerScreen.tsx`, `gallery.tsx`, `DocumentVaultScreen.tsx`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `@react-native/metro-config` connect `download-models.js` to `package.json`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **What connects `LogEntry`, `PdfMetadata`, `PdfProcessingStatus` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Database.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07825507825507826 - nodes in this community are weakly interconnected._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.0553116769095698 - nodes in this community are weakly interconnected._
- **Should `download-models.js` be split into smaller, more focused modules?**
  _Cohesion score 0.053156146179401995 - nodes in this community are weakly interconnected._