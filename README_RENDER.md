# DeviceGuard — Render deployment

DeviceGuard is now a small, production-oriented license control plane for Android apps:

- `POST /api/device/handshake` registers an installation and returns a pending decision.
- The dashboard shows app identity, package name, device metadata, IP, activity, requested permissions, and license state.
- An administrator approves a device for a number of days and chooses exactly which requested permissions are granted.
- An approved handshake returns a signed `license_token` plus `granted_permissions`.
- `POST /api/device/validate` re-checks that signed token before the app enables protected features.
- Blocking a device, expiry, or a newly requested permission immediately prevents access on the next check.

## Deploy

1. Push this folder to a GitHub repository.
2. In Render, choose **New → Blueprint** and select the repository.
3. Render reads `render.yaml`, creates the PostgreSQL database, and asks for the admin ID and password.
4. Keep those values in Render Environment Variables only. They are never stored in the source code.
5. Open the deployed URL. The dashboard is served by the same web service as the API.

The first server start creates the admin account from `DEVICEGUARD_ADMIN_USERNAME` and `DEVICEGUARD_ADMIN_PASSWORD`. The password is immediately hashed with scrypt. If the account already exists, changing the environment variable does not change its password; update the database record or use a fresh database.

## Put the URL in an Android app

Use the deployed URL as `DEVICEGUARD_BASE_URL` and send an installation-scoped UUID. Do not send an IMEI, phone number, contacts, or other sensitive identifier. A complete Kotlin example is in `integration/DeviceGuardClient.kt`.

At app startup:

1. Call `handshake()` with the app ID, package name, app version, device details, and the permissions the app wants.
2. If `access` is false, keep protected features disabled and show the returned Bengali message.
3. If `access` is true, save the returned `license_token` securely and call `validate()` on every app start or before sensitive features.
4. Check `granted_permissions` before using each protected feature. A license is scoped to one app ID and one installation.

## API example

```json
POST /api/device/handshake
{
  "device_id": "installation-uuid",
  "app_id": "my-app-production",
  "app_name": "My App",
  "package_name": "com.example.myapp",
  "device_name": "Pixel 8",
  "manufacturer": "Google",
  "model": "Pixel 8",
  "android_version": "14",
  "sdk_version": "34",
  "app_version": "2.1.0",
  "requested_permissions": ["internet", "notifications", "camera"]
}
```

The server deliberately does not accept an admin password from the app. The app only receives a signed license decision; dashboard actions require the separate admin session.