import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, activityLogsTable, adminsTable, devicesTable } from "@workspace/db";
import { logger } from "./logger";

const jwtSecret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET ?? "";
if (!jwtSecret) {
  throw new Error("JWT_SECRET or SESSION_SECRET must be set for DeviceGuard authentication");
}

type Claims = {
  id: string;
  username: string;
  exp: number;
};

export const PERMISSION_CATALOG = [
  "internet",
  "device_info",
  "notifications",
  "camera",
  "location",
  "storage",
  "contacts",
  "phone",
] as const;

export type DevicePermission = (typeof PERMISSION_CATALOG)[number];

export function parsePermissions(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((item): item is string => typeof item === "string"))]
      : [];
  } catch {
    return [];
  }
}

export function normalizePermissions(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const allowed = new Set<string>(PERMISSION_CATALOG);
  return [...new Set(values.filter((value): value is string => typeof value === "string" && allowed.has(value)))];
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [, salt, expected] = stored.split("$");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function signSession(claims: Omit<Claims, "exp">): string {
  const payload = { ...claims, exp: Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60 };
  const encodedHeader = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", jwtSecret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

type LicenseClaims = {
  device_id: string;
  app_id: string;
  permissions: string[];
  exp: number | null;
  iat: number;
};

export function signLicense(claims: Omit<LicenseClaims, "iat">): string {
  const payload = { ...claims, iat: Math.floor(Date.now() / 1000) };
  const encodedHeader = base64Url(JSON.stringify({ alg: "HS256", typ: "DGL" }));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", jwtSecret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

export function verifyLicense(token: string): LicenseClaims | null {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) return null;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expected = createHmac("sha256", jwtSecret).update(unsigned).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as LicenseClaims;
    if (!claims.device_id || !claims.app_id || !Array.isArray(claims.permissions) || !claims.iat) return null;
    if (claims.exp !== null && (!claims.exp || claims.exp < Math.floor(Date.now() / 1000))) return null;
    return claims;
  } catch {
    return null;
  }
}

export function verifySession(token: string): Claims | null {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) return null;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expected = createHmac("sha256", jwtSecret).update(unsigned).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Claims;
    if (!claims.id || !claims.username || !claims.exp || claims.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export async function initializeDeviceGuard(): Promise<void> {
  const existing = await db.select({ id: adminsTable.id }).from(adminsTable).limit(1);
  if (existing.length > 0) {
    return;
  }

  const password = process.env.DEVICEGUARD_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("DEVICEGUARD_ADMIN_PASSWORD must be set for first-time setup");
  }

  const username = process.env.DEVICEGUARD_ADMIN_USERNAME ?? "admin";
  await db.insert(adminsTable).values({
    id: randomUUID(),
    username,
    passwordHash: hashPassword(password),
  });
  logger.info({ username }, "DeviceGuard admin account created");
}

export async function authenticateAdmin(username: string, password: string) {
  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.username, username)).limit(1);
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    return null;
  }
  return admin;
}

export async function logDeviceActivity(
  deviceId: string | null,
  deviceName: string | null | undefined,
  action: string,
  ipAddress: string | null,
): Promise<void> {
  await db.insert(activityLogsTable).values({
    id: randomUUID(),
    deviceId,
    deviceName: deviceName ?? null,
    action,
    ipAddress,
  });
}

export function deviceSearchCondition(search: string | undefined) {
  if (!search) return undefined;
  const query = `%${search}%`;
  return or(
    ilike(devicesTable.appId, query),
    ilike(devicesTable.appName, query),
    ilike(devicesTable.packageName, query),
    ilike(devicesTable.deviceName, query),
    ilike(devicesTable.deviceId, query),
    ilike(devicesTable.ipAddress, query),
  );
}

export function countDevices(status?: string) {
  return db
    .select({ count: sql<number>`count(*)::int` })
    .from(devicesTable)
    .where(status ? eq(devicesTable.status, status as "PENDING") : undefined);
}

export { db, activityLogsTable, adminsTable, devicesTable, and, desc, eq, ilike, or };