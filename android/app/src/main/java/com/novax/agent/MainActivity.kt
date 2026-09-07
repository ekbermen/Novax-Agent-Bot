package com.novax.agent

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * MainActivity — hosts the NovaX web app in a WebView and exposes the
 * native bridge (NovaXBridge) to it via addJavascriptInterface.
 *
 * The web app itself lives under app/src/main/assets/web (copy the /web
 * folder from this project's root into that assets directory as a build
 * step, or point loadUrl at a hosted URL instead — either works).
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        configureWebView()
        requestRuntimePermissions()

        webView.addJavascriptInterface(NovaXBridge(this), "NovaXBridge")
        webView.webViewClient = WebViewClient()

        // Local assets build: file:///android_asset/web/index.html
        // Hosted build: replace with your deployed URL, e.g. https://your-domain/index.html
        webView.loadUrl("file:///android_asset/web/index.html")
    }

    private fun configureWebView() {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true // required for IndexedDB
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false // allow TTS playback without a tap
        settings.allowFileAccess = true
        settings.setSupportZoom(false)
    }

    /**
     * Requests microphone + notification permissions up front. If denied,
     * the web app's Permission Center will correctly show "unavailable" /
     * "denied" states — nothing is faked on the JS side.
     */
    private fun requestRuntimePermissions() {
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.RECORD_AUDIO)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), REQUEST_CODE_PERMISSIONS)
        }
    }

    /** Starts the foreground service so an active voice session survives backgrounding. */
    fun startAgentForegroundService() {
        val intent = Intent(this, NovaXForegroundService::class.java)
        ContextCompat.startForegroundService(this, intent)
    }

    fun stopAgentForegroundService() {
        stopService(Intent(this, NovaXForegroundService::class.java))
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_CODE_PERMISSIONS = 1001
    }
}
