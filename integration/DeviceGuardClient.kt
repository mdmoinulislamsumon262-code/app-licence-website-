package com.example.deviceguard

import android.content.Context
import android.os.Build
import android.provider.Settings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * Minimal client example. Add your HTTP/JSON library if preferred; this uses
 * Android's built-in HttpURLConnection so the integration has no secret.
 *
 * Never use an IMEI or a hardware serial here. The generated installation ID
 * is scoped to this app's private storage and is enough for licensing.
 */
class DeviceGuardClient(
    private val context: Context,
    private val baseUrl: String,
    private val appId: String,
    private val appName: String,
    private val packageName: String = context.packageName,
) {
    private val prefs = context.getSharedPreferences("deviceguard", Context.MODE_PRIVATE)
    private val installationId: String
        get() = prefs.getString("installation_id", null)
            ?: UUID.randomUUID().toString().also {
                prefs.edit().putString("installation_id", it).apply()
            }

    suspend fun handshake(requestedPermissions: List<String>): LicenseDecision =
        post("/api/device/handshake", JSONObject().apply {
            put("device_id", installationId)
            put("app_id", appId)
            put("app_name", appName)
            put("package_name", packageName)
            put("device_name", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("manufacturer", Build.MANUFACTURER)
            put("model", Build.MODEL)
            put("android_version", Build.VERSION.RELEASE)
            put("sdk_version", Build.VERSION.SDK_INT.toString())
            put("app_version", "2.1.0") // replace with BuildConfig.VERSION_NAME
            put("requested_permissions", JSONArray(requestedPermissions))
        }).also { decision ->
            if (decision.access) prefs.edit().putString("license_token", decision.licenseToken).apply()
        }

    suspend fun validate(): LicenseDecision {
        val token = prefs.getString("license_token", null)
            ?: return LicenseDecision(false, "pending", "No license has been issued yet.", emptyList(), null)
        return post("/api/device/validate", JSONObject().put("license_token", token))
    }

    private suspend fun post(path: String, body: JSONObject): LicenseDecision =
        withContext(Dispatchers.IO) {
            val connection = (URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
            }
            connection.outputStream.use { it.write(body.toString().toByteArray()) }
            val text = (if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream)
                .bufferedReader().use { it.readText() }
            val json = JSONObject(text)
            LicenseDecision(
                access = json.optBoolean("access"),
                status = json.optString("status"),
                message = json.optString("message"),
                grantedPermissions = json.optJSONArray("granted_permissions").toStringList(),
                licenseToken = json.optString("license_token").takeIf { it.isNotBlank() },
            )
        }
}

data class LicenseDecision(
    val access: Boolean,
    val status: String,
    val message: String,
    val grantedPermissions: List<String>,
    val licenseToken: String?,
)

private fun JSONArray?.toStringList(): List<String> =
    if (this == null) emptyList() else List(length()) { index -> optString(index) }