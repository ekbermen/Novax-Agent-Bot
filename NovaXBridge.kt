package com.novax.agent

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.JavascriptInterface
import androidx.core.app.NotificationCompat
import org.json.JSONObject

/**
 * NovaXBridge — the real native bridge injected into the WebView as
 * `window.NovaXBridge`.
 *
 * Every method returns a JSON string with a `status` field so the web
 * layer's bridge.js can parse it uniformly. Methods that aren't fully wired
 * up yet (takePhoto, shareScreen, sendFile) honestly report `unavailable`
 * instead of pretending to succeed — wire them up to a real Activity-result
 * flow before flipping them to `success`.
 */
class NovaXBridge(private val context: Context) {

    private fun result(status: String, message: String, data: JSONObject? = null): String {
        val obj = JSONObject()
        obj.put("status", status)
        obj.put("message", message)
        if (data != null) obj.put("data", data)
        return obj.toString()
    }

    /** Launches another installed app by package name. Real implementation. */
    @JavascriptInterface
    fun openApp(packageName: String?): String {
        if (packageName.isNullOrBlank()) {
            return result("failure", "No package name provided.")
        }
        val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
        return if (launchIntent != null) {
            context.startActivity(launchIntent)
            result("success", "Launched $packageName.")
        } else {
            result("unavailable", "No installed app found for package \"$packageName\".")
        }
    }

    /**
     * Android does not allow one app to force-close another (no equivalent
     * of the old task-killer APIs for third-party apps). This honestly
     * reports that limitation rather than pretending to close anything.
     */
    @JavascriptInterface
    fun closeApp(packageName: String?): String {
        return result(
            "unavailable",
            "Android does not permit an app to close other apps. This action is not available."
        )
    }

    /**
     * Not implemented: capturing a photo requires an Activity-result launcher
     * (ActivityResultContracts.TakePicture) wired into MainActivity, plus a
     * FileProvider for the output Uri. Report unavailable rather than fake it.
     */
    @JavascriptInterface
    fun takePhoto(): String {
        return result("unavailable", "Camera capture is not wired up yet in this build.")
    }

    /**
     * Not implemented: screen sharing requires MediaProjection + a running
     * foreground service of type mediaProjection, plus user consent via
     * MediaProjectionManager.createScreenCaptureIntent(). Report unavailable.
     */
    @JavascriptInterface
    fun shareScreen(): String {
        return result("unavailable", "Screen sharing is not wired up yet in this build.")
    }

    /**
     * Not implemented: sending a file requires a concrete destination
     * (share sheet target, specific app, or upload endpoint). Report
     * unavailable until that destination is defined.
     */
    @JavascriptInterface
    fun sendFile(path: String?): String {
        return result("unavailable", "File sending is not wired up yet in this build.")
    }

    /** Shows a real system notification via NotificationManager. */
    @JavascriptInterface
    fun showNotification(title: String?, body: String?): String {
        val channelId = "novax_agent_channel"
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId, "NovaX Agent", NotificationManager.IMPORTANCE_DEFAULT
            )
            manager.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(context, channelId)
            .setContentTitle(title ?: "NovaX")
            .setContentText(body ?: "")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .build()

        return try {
            manager.notify(System.currentTimeMillis().toInt(), notification)
            result("success", "Notification shown.")
        } catch (e: SecurityException) {
            result("unavailable", "Notification permission was not granted.")
        }
    }

    /** Returns real device info — no fabricated values. */
    @JavascriptInterface
    fun getDeviceInfo(): String {
        val data = JSONObject()
        data.put("manufacturer", Build.MANUFACTURER)
        data.put("model", Build.MODEL)
        data.put("androidVersion", Build.VERSION.RELEASE)
        data.put("sdkInt", Build.VERSION.SDK_INT)
        data.put("appPackage", context.packageName)
        return result("success", "Device info collected.", data)
    }
}
