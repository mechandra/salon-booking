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

## Notes

- Your web backend must be running first.
- This mobile wrapper simply loads the existing web UI inside a WebView.
