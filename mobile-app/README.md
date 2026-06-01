# Salon Booking Mobile Wrapper

This Expo app wraps your existing salon booking web app inside a mobile WebView.

## Setup

1. Install dependencies:
   ```bash
   cd mobile-app
   npm install
   ```

2. Start the web backend from the main project folder:
   ```bash
   cd ../
   npm start
   ```

3. Start the mobile app:
   ```bash
   cd mobile-app
   npx expo start
   ```

4. In Expo:
   - Use **Run on iOS simulator** if you are on macOS.
   - Use **Run on your device** with the Expo Go app if you want to test on a real iPhone.

## Using the app

- Enter the URL of the web app:
  - `http://localhost:3000` for simulator
  - `http://<your-computer-ip>:3000` for a real device on the same Wi-Fi
- Tap **Open Salon App**.

## Building a standalone iOS app

To create your own iPhone app instead of using Expo Go:

1. Install dependencies:
   ```bash
   cd mobile-app
   npm install
   ```
2. Install EAS CLI if needed:
   ```bash
   npm install -g eas-cli
   ```
3. Log in to Expo:
   ```bash
   eas login
   ```
4. Configure native build settings:
   - `app.json` already includes `ios.bundleIdentifier`.
5. Build for iOS:
   ```bash
   cd mobile-app
   eas build -p ios --profile production
   ```

This will create a standalone `.ipa`/TestFlight build with your own app icon and bundle ID.

## Notes

- You will need an Apple developer account to distribute a real app or upload to TestFlight.
- If you want just local testing on a connected iPhone, Xcode free provisioning may work, but Expo EAS build is the recommended path for a standalone app.
- Your web backend must still be running to use the salon booking experience inside the app.
