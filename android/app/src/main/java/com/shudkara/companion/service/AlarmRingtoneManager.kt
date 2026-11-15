package com.shudkara.companion.service

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

object AlarmRingtoneManager {

    private const val TAG = "AlarmRingtoneManager"
    private var mediaPlayer: MediaPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var isPlaying = false

    /**
     * Starts continuous alarm sound and vibration immediately in background.
     * Uses USAGE_ALARM to ensure high priority and bypass silent mode where allowed.
     */
    @Synchronized
    fun startAlarmSound(context: Context, reminderId: String) {
        if (isPlaying) {
            Log.d(TAG, "Alarm sound is already playing")
            return
        }

        try {
            // 1. Acquire temporary 60-second WakeLock
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            if (wakeLock == null || wakeLock?.isHeld == false) {
                wakeLock = powerManager?.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "shudkara:AlarmSoundWakeLock"
                )?.apply {
                    setReferenceCounted(false)
                    acquire(60 * 1000L) // Safe max timeout of 60 seconds
                }
            }

            // 2. Resolve alarm audio URI
            val alarmUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            // 3. Initialize MediaPlayer with USAGE_ALARM
            mediaPlayer?.release()
            mediaPlayer = MediaPlayer().apply {
                setDataSource(context, alarmUri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                setOnPreparedListener { mp ->
                    mp.start()
                    this@AlarmRingtoneManager.isPlaying = true
                    Log.d(TAG, "Started looping alarm sound for $reminderId")
                }
                setOnErrorListener { _, what, extra ->
                    Log.e(TAG, "MediaPlayer error: what=$what, extra=$extra")
                    stopAlarmSound(context)
                    false
                }
                prepareAsync()
            }

            // 4. Start aggressive alarm vibration pattern (0ms wait, 800ms vibe, 300ms rest, 800ms vibe)
            triggerVibration(context)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start alarm audio", e)
            isPlaying = false
        }
    }

    /**
     * Stops the looping alarm sound, vibration, and releases wake lock.
     */
    @Synchronized
    fun stopAlarmSound(context: Context) {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer?.isPlaying == true) {
                    mediaPlayer?.stop()
                }
                mediaPlayer?.release()
                mediaPlayer = null
            }
            stopVibration(context)

            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
            wakeLock = null
            isPlaying = false
            Log.d(TAG, "Alarm sound and vibration stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping alarm audio", e)
        }
    }

    fun isRinging(): Boolean = isPlaying

    private fun triggerVibration(context: Context) {
        try {
            val pattern = longArrayOf(0, 800, 300, 800, 300, 800, 1000)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0)) // 0 = repeat
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(pattern, 0)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to trigger vibration", e)
        }
    }

    private fun stopVibration(context: Context) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.cancel()
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                vibrator?.cancel()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to cancel vibration", e)
        }
    }
}
