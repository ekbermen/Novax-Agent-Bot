name: Build NovaX APK

on:
  push:
    branches: [ main ]
  workflow_dispatch: {}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Set up Android SDK
        uses: android-actions/setup-android@v3

      - name: Copy web app into Android assets
        run: |
          mkdir -p android/app/src/main/assets/web
          cp -r web/* android/app/src/main/assets/web/

      - name: Set up Gradle
        uses: gradle/actions/setup-gradle@v4

      - name: Build debug APK
        working-directory: android
        run: gradle assembleDebug --no-daemon

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: novax-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
