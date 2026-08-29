# DeviceGuard License System

DeviceGuard is a Render-ready license and permission control system for Android applications.

## Deploy on Render

1. Upload the contents of this repository to GitHub.
2. In Render, choose **New → Blueprint** and select the GitHub repository.
3. Render will use `render.yaml` to create the web service and PostgreSQL database.
4. Enter `DEVICEGUARD_ADMIN_USERNAME` and `DEVICEGUARD_ADMIN_PASSWORD` when Render asks for them.
5. Open the deployed URL and sign in to the admin dashboard.

The Android client example is in `integration/DeviceGuardClient.kt`. Full deployment and API instructions are in `README_RENDER.md`.

Do not upload `.env` or real credentials to GitHub. Only `.env.example` belongs in the repository.