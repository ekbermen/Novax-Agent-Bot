package com.novax.agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * NovaXForegroundService — a real Android foreground service.
 *
 * Purpose: keep NovaX's voice session alive (and visibly so, via the
 * required persistent notification) when the app is moved to the
 * background mid-listen or mid-response, instead of the OS silently
 * suspending it. This does not run hidden background work — Android
 * requires the notification to stay visible for the lifetime of the
 * service, which is the correct, honest way to do this.
 *
 * Start it (e.g. from MainActivity.startAgentForegroundService()) when a
 * listening/response session begins, and stop it once the session ends.
 */
class NovaXForegroundService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundWithNotification()
        return START_STICKY
    }

    private fun startForegroundWithNotification() {
        val channelId = "novax_foreground_channel"
        val manager = getSystemService(NotificationManager::class.java)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "NovaX Agent Session",
                NotificationManager.IMPORTANCE_LOW
            )
            channel.description = "Shows while NovaX is actively listening or responding."
            manager.createNotificationChannel(channel)
        }

        val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("NovaX is active")
            .setContentText("Your voice session is running in the background.")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    companion object {
        private const val NOTIFICATION_ID = 42
    }
}
