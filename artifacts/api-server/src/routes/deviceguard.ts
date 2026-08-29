import { createHash, randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type RequestHandler } from "express";
import {
  AdminLoginBody,
  AdminLoginResponse,
  ApproveAdminDeviceBody,
  ApproveAdminDeviceParams,
  ApproveAdminDeviceResponse,
  DeleteAdminDeviceParams,
  DeleteAdminDeviceResponse,
  DeviceHandshakeBody,
  DeviceHandshakeResponse,
  GetAdminStatsResponse,
  ListAdminDevicesQueryParams,
  ListAdminDevicesResponse,
  ListAdminLogsResponse,
  RejectAdminDeviceParams,
  RejectAdminDeviceResponse,
} from "@workspace/api-zod";
import {
  activityLogsTable,
  and,
  authenticateAdmin,
  countDevices,
  db,
  desc,
  deviceSearchCondition,
  devicesTable,
  eq,
  logDeviceActivity,
  normalizePermissions,
  parsePermissions,
  signLicense,
  signSession,
  verifySession,
  verifyLicense,
} from "../lib/deviceguard";

const router: IRouter = Router();

const requireAdmin: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: { message: "Unauthorized" } });
    return;
  }
  const session = verifySession(header.slice("Bearer ".length));
  if (!session) {
    res.status(401).json({ success: false, error: { message: "Session expired" } });
    return;
  }
  next();
};

function ipAddress(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "127.0.0.1";
}

function toDeviceResponse(device: typeof devicesTable.$inferSelect) {
  return {
    ...device,
    device_id: device.deviceId,
    expires_at: device.expiresAt?.toISOString() ?? null,
    registered_at: device.registeredAt.toISOString(),
    last_active_at: device.lastActiveAt.toISOString(),
    device_id_hash: device.deviceIdHash,
    app_id: device.appId,
    app_name: device.appName,
    package_name: device.packageName,
    device_name: device.deviceName,
    manufacturer: device.manufacturer,
    model: device.model,
    android_version: device.androidVersion,
    sdk_version: device.sdkVersion,
    app_version: device.appVersion,
    ip_address: device.ipAddress,
    requested_permissions: parsePermissions(device.requestedPermissions),
    granted_permissions: parsePermissions(device.grantedPermissions),
  };
}

function licenseResponse(device: typeof devicesTable.$inferSelect, message: string) {
  const grantedPermissions = parsePermissions(device.grantedPermissions);
  const requestedPermissions = parsePermissions(device.requestedPermissions);
  const missingPermissions = requestedPermissions.filter((permission) => !grantedPermissions.includes(permission));
  const isExpired = Boolean(device.expiresAt && new Date() > device.expiresAt);
  const canAccess = device.status === "APPROVED" && !isExpired;
  return {
    access: canAccess,
    status: canAccess ? "approved" : isExpired ? "expired" : device.status === "REJECTED" || device.status === "BANNED" ? "rejected" : "pending",
    message,
    device_id: device.deviceId,
    expires_at: device.expiresAt?.toISOString() ?? null,
    license_token: canAccess
      ? signLicense({
          device_id: device.deviceId,
          app_id: device.appId,
          permissions: grantedPermissions,
          exp: device.expiresAt ? Math.floor(device.expiresAt.getTime() / 1000) : null,
        })
      : null,
    granted_permissions: grantedPermissions,
    missing_permissions: missingPermissions,
  };
}

router.post("/device/handshake", async (req, res): Promise<void> => {
  const parsed = DeviceHandshakeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ access: false, status: "error", message: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const rawDeviceId = data.device_id.trim();
  const appId = data.app_id.trim();
  const requestedPermissions = normalizePermissions(data.requested_permissions);
  const clientIp = ipAddress(req);
  let [device] = await db.select().from(devicesTable).where(and(
    eq(devicesTable.deviceId, rawDeviceId),
    eq(devicesTable.appId, appId),
  )).limit(1);

  if (!device) {
    const deviceIdHash = createHash("sha256").update(`${appId}:${rawDeviceId}`).digest("hex");
    await db.insert(devicesTable).values({
      id: randomUUID(),
      deviceId: rawDeviceId,
      deviceIdHash,
      appId,
      appName: data.app_name ?? null,
      packageName: data.package_name ?? null,
      deviceName: data.device_name ?? "Android Device",
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      androidVersion: data.android_version ?? "N/A",
      sdkVersion: data.sdk_version ?? null,
      appVersion: data.app_version ?? "1.0.0",
      ipAddress: clientIp,
      requestedPermissions: JSON.stringify(requestedPermissions),
      grantedPermissions: "[]",
      status: "PENDING",
    }).returning();
    await logDeviceActivity(rawDeviceId, data.device_name, "NEW_APP_INSTALL_PENDING", clientIp);
    res.json(DeviceHandshakeResponse.parse({
      access: false,
      status: "pending",
      message: "আপনার ডিভাইসটি পেন্ডিং তালিকায় আছে। অ্যাডমিন অনুমোদন দিলে অ্যাপ চালু হবে।",
      device_id: rawDeviceId,
      granted_permissions: [],
      missing_permissions: requestedPermissions,
    }));
    return;
  }

  const existingRequested = parsePermissions(device.requestedPermissions);
  const allRequested = [...new Set([...existingRequested, ...requestedPermissions])];
  const grantedPermissions = parsePermissions(device.grantedPermissions);
  const newlyRequestedPermissions = requestedPermissions.filter((permission) => !existingRequested.includes(permission));
  const newPermissionsNeedReview = newlyRequestedPermissions.length > 0;
  [device] = await db.update(devicesTable).set({
    lastActiveAt: new Date(),
    ipAddress: clientIp,
    ...(data.app_name ? { appName: data.app_name } : {}),
    ...(data.package_name ? { packageName: data.package_name } : {}),
    ...(data.device_name ? { deviceName: data.device_name } : {}),
    ...(data.manufacturer ? { manufacturer: data.manufacturer } : {}),
    ...(data.model ? { model: data.model } : {}),
    ...(data.android_version ? { androidVersion: data.android_version } : {}),
    ...(data.sdk_version ? { sdkVersion: data.sdk_version } : {}),
    ...(data.app_version ? { appVersion: data.app_version } : {}),
    requestedPermissions: JSON.stringify(allRequested),
    ...(device.status === "APPROVED" && newPermissionsNeedReview ? { status: "PENDING" as const } : {}),
  }).where(and(
    eq(devicesTable.deviceId, rawDeviceId),
    eq(devicesTable.appId, appId),
  )).returning();

  if (device.status === "REJECTED" || device.status === "BANNED") {
    await logDeviceActivity(rawDeviceId, device.deviceName, "BLOCKED_ACCESS_ATTEMPT", clientIp);
    res.json(DeviceHandshakeResponse.parse({
      access: false,
      status: "rejected",
      message: "আপনার ডিভাইসের এক্সেস অ্যাডমিন দ্বারা ব্লক করা হয়েছে।",
      granted_permissions: parsePermissions(device.grantedPermissions),
      missing_permissions: [],
    }));
    return;
  }

  if (device.status === "PENDING") {
    if (newPermissionsNeedReview) {
      await logDeviceActivity(rawDeviceId, device.deviceName, "PERMISSION_REVIEW_PENDING", clientIp);
    }
    res.json(DeviceHandshakeResponse.parse({
      access: false,
      status: "pending",
      message: "অ্যাডমিন এখনও আপনার ডিভাইস অনুমোদন দেননি। অনুগ্রহ করে অপেক্ষা করুন।",
      granted_permissions: parsePermissions(device.grantedPermissions),
      missing_permissions: parsePermissions(device.requestedPermissions).filter((permission) => !parsePermissions(device.grantedPermissions).includes(permission)),
    }));
    return;
  }

  if (device.expiresAt && new Date() > device.expiresAt) {
    [device] = await db.update(devicesTable).set({ status: "EXPIRED" }).where(eq(devicesTable.deviceId, rawDeviceId)).returning();
    await logDeviceActivity(rawDeviceId, device.deviceName, "EXPIRED_SESSION", clientIp);
    res.json(DeviceHandshakeResponse.parse({
      access: false,
      status: "expired",
      message: "আপনার অ্যাপ ব্যবহারের মেয়াদ শেষ হয়ে গেছে।",
      granted_permissions: parsePermissions(device.grantedPermissions),
      missing_permissions: [],
    }));
    return;
  }

  await logDeviceActivity(rawDeviceId, device.deviceName, "APP_ACCESS_GRANTED", clientIp);
  res.json(DeviceHandshakeResponse.parse(licenseResponse(device, "এক্সেস অনুমোদিত হয়েছে।")));
});

router.post("/device/validate", async (req, res): Promise<void> => {
  const token = typeof req.body?.license_token === "string" ? req.body.license_token : "";
  const claims = verifyLicense(token);
  if (!claims) {
    res.status(200).json(DeviceHandshakeResponse.parse({
      access: false,
      status: "rejected",
      message: "লাইসেন্স টোকেনটি সঠিক নয় বা মেয়াদ শেষ হয়েছে।",
      license_token: null,
      granted_permissions: [],
      missing_permissions: [],
    }));
    return;
  }

  const [device] = await db.select().from(devicesTable).where(and(
    eq(devicesTable.deviceId, claims.device_id),
    eq(devicesTable.appId, claims.app_id),
  )).limit(1);
  if (!device) {
    res.json(DeviceHandshakeResponse.parse({
      access: false,
      status: "rejected",
      message: "লাইসেন্সের ডিভাইস রেজিস্ট্রেশন পাওয়া যায়নি।",
      license_token: null,
      granted_permissions: [],
      missing_permissions: [],
    }));
    return;
  }

  let freshDevice = device;
  if (device.status === "APPROVED" && device.expiresAt && new Date() > device.expiresAt) {
    freshDevice = (await db.update(devicesTable).set({ status: "EXPIRED" }).where(eq(devicesTable.id, device.id)).returning())[0] ?? device;
  }
  const response = licenseResponse(freshDevice, freshDevice.status === "APPROVED" ? "লাইসেন্স সক্রিয় আছে।" : "লাইসেন্সটি আর সক্রিয় নেই।");
  res.json(DeviceHandshakeResponse.parse(response));
});

router.post("/admin/auth/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { message: parsed.error.message } });
    return;
  }
  const admin = await authenticateAdmin(parsed.data.username, parsed.data.password);
  if (!admin) {
    res.status(401).json({ success: false, error: { message: "ভুল ইউজারনেম বা পাসওয়ার্ড" } });
    return;
  }
  res.json(AdminLoginResponse.parse({
    success: true,
    data: { token: signSession({ id: admin.id, username: admin.username }), username: admin.username },
  }));
});

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [total, pending, approved, rejected, banned] = await Promise.all([
    countDevices(),
    countDevices("PENDING"),
    countDevices("APPROVED"),
    countDevices("REJECTED"),
    countDevices("BANNED"),
  ]);
  res.json(GetAdminStatsResponse.parse({
    success: true,
    data: {
      total: total[0]?.count ?? 0,
      pending: pending[0]?.count ?? 0,
      approved: approved[0]?.count ?? 0,
      rejected: (rejected[0]?.count ?? 0) + (banned[0]?.count ?? 0),
    },
  }));
});

router.get("/admin/devices", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminDevicesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { message: parsed.error.message } });
    return;
  }
  const filters = [];
  if (parsed.data.status !== "ALL") filters.push(eq(devicesTable.status, parsed.data.status));
  const search = deviceSearchCondition(parsed.data.search);
  if (search) filters.push(search);
  const devices = await db.select().from(devicesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(devicesTable.registeredAt));
  res.json(ListAdminDevicesResponse.parse({
    success: true,
    data: { devices: devices.map(toDeviceResponse) },
  }));
});

router.post("/admin/devices/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const params = ApproveAdminDeviceParams.safeParse(req.params);
  const body = ApproveAdminDeviceBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ success: false, error: { message: "Invalid approval request" } });
    return;
  }
  const expiresAt = body.data.duration_days > 0
    ? new Date(Date.now() + body.data.duration_days * 86400000)
    : null;
  const [currentDevice] = await db.select().from(devicesTable).where(eq(devicesTable.id, params.data.id)).limit(1);
  if (!currentDevice) {
    res.status(404).json({ success: false, message: "Device not found" });
    return;
  }
  const requested = parsePermissions(currentDevice.requestedPermissions);
  const granted = normalizePermissions(body.data.granted_permissions).filter((permission) => requested.includes(permission));
  const [device] = await db.update(devicesTable).set({ status: "APPROVED", expiresAt, grantedPermissions: JSON.stringify(granted) })
    .where(eq(devicesTable.id, params.data.id)).returning();
  if (!device) {
    res.status(404).json({ success: false, message: "Device not found" });
    return;
  }
  await logDeviceActivity(device.deviceId, device.deviceName, `DEVICE_ACCESS_APPROVED_${granted.length}_PERMISSIONS`, ipAddress(req));
  res.json(ApproveAdminDeviceResponse.parse({ success: true, message: "ডিভাইসটি সফলভাবে অনুমোদন দেওয়া হয়েছে!" }));
});

router.post("/admin/devices/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const params = RejectAdminDeviceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: { message: params.error.message } });
    return;
  }
  const [device] = await db.update(devicesTable).set({ status: "REJECTED" })
    .where(eq(devicesTable.id, params.data.id)).returning();
  if (!device) {
    res.status(404).json({ success: false, message: "Device not found" });
    return;
  }
  await logDeviceActivity(device.deviceId, device.deviceName, "DEVICE_ACCESS_BLOCKED", ipAddress(req));
  res.json(RejectAdminDeviceResponse.parse({ success: true, message: "ডিভাইসটির এক্সেস বাতিল বা ব্লক করা হয়েছে।" }));
});

router.delete("/admin/devices/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteAdminDeviceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ success: false, error: { message: params.error.message } });
    return;
  }
  const [device] = await db.delete(devicesTable).where(eq(devicesTable.id, params.data.id)).returning();
  if (!device) {
    res.status(404).json({ success: false, message: "Device not found" });
    return;
  }
  res.json(DeleteAdminDeviceResponse.parse({ success: true, message: "ডিভাইস মুছে ফেলা হয়েছে।" }));
});

router.get("/admin/logs", requireAdmin, async (_req, res): Promise<void> => {
  const logs = await db.select().from(activityLogsTable).orderBy(desc(activityLogsTable.createdAt)).limit(50);
  res.json(ListAdminLogsResponse.parse({
    success: true,
    data: {
      logs: logs.map((log) => ({
        id: log.id,
        device_id: log.deviceId,
        device_name: log.deviceName,
        action: log.action,
        ip_address: log.ipAddress,
        created_at: log.createdAt.toISOString(),
      })),
    },
  }));
});

export default router;