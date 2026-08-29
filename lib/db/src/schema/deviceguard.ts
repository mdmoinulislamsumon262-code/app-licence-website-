import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deviceStatusEnum = pgEnum("device_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "BANNED",
  "EXPIRED",
]);

export const adminsTable = pgTable("admins", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  usernameUnique: uniqueIndex("admins_username_unique").on(table.username),
}));

export const devicesTable = pgTable("devices", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  deviceIdHash: text("device_id_hash").notNull(),
  appId: text("app_id").notNull().default("default"),
  appName: text("app_name"),
  packageName: text("package_name"),
  deviceName: text("device_name"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  androidVersion: text("android_version"),
  sdkVersion: text("sdk_version"),
  appVersion: text("app_version"),
  ipAddress: text("ip_address"),
  requestedPermissions: text("requested_permissions").notNull().default("[]"),
  grantedPermissions: text("granted_permissions").notNull().default("[]"),
  status: deviceStatusEnum("status").notNull().default("PENDING"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  notes: text("notes"),
  registeredAt: timestamp("registered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  deviceIdUnique: uniqueIndex("devices_device_id_unique").on(table.deviceId, table.appId),
  deviceIdHashUnique: uniqueIndex("devices_device_id_hash_unique").on(table.deviceIdHash),
  deviceIdIndex: index("devices_device_id_idx").on(table.deviceId),
  appIdIndex: index("devices_app_id_idx").on(table.appId),
  statusIndex: index("devices_status_idx").on(table.status),
}));

export const activityLogsTable = pgTable("activity_logs", {
  id: text("id").primaryKey(),
  deviceId: text("device_id"),
  deviceName: text("device_name"),
  action: text("action").notNull(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  createdAtIndex: index("activity_logs_created_at_idx").on(table.createdAt),
}));

export const insertAdminSchema = createInsertSchema(adminsTable).omit({
  createdAt: true,
});
export const insertDeviceSchema = createInsertSchema(devicesTable).omit({
  registeredAt: true,
  lastActiveAt: true,
});
export const insertActivityLogSchema = createInsertSchema(activityLogsTable).omit({
  createdAt: true,
});

export type Admin = typeof adminsTable.$inferSelect;
export type Device = typeof devicesTable.$inferSelect;
export type ActivityLog = typeof activityLogsTable.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;