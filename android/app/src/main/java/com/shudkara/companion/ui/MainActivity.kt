package com.shudkara.companion.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraControl
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.lifecycleScope
import com.shudkara.companion.data.*
import com.shudkara.companion.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {

    private lateinit var prefs: PreferencesManager
    private lateinit var api: ShudkaraApi
    private lateinit var queueManager: OfflineQueueManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = PreferencesManager(this)
        api = ShudkaraApi(this)
        queueManager = OfflineQueueManager(this)

        handleDeepLink(intent)

        val initialTab = intent.getIntExtra("extra_tab", 0)
        val initialFinanceMode = intent.getStringExtra("finance_mode")
        val initialFinanceAmount = intent.getDoubleExtra("finance_amount", 0.0)
        val initialFinanceDesc = intent.getStringExtra("finance_desc")
        val initialFinanceRotation = intent.getBooleanExtra("finance_is_rotation", false)

        setContent {
            ShudkaraTheme {
                MainScreen(
                    initialTab = initialTab,
                    initialFinanceMode = initialFinanceMode,
                    initialFinanceAmount = initialFinanceAmount,
                    initialFinanceDesc = initialFinanceDesc,
                    initialFinanceRotation = initialFinanceRotation,
                    prefs = prefs,
                    api = api,
                    queueManager = queueManager,
                    onOpenSettings = { }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme == "shudkara") {
            val token = uri.getQueryParameter("token")
            val server = uri.getQueryParameter("server")
            if (!token.isNullOrBlank()) {
                prefs.sessionToken = token
                if (!server.isNullOrBlank()) {
                    prefs.serverUrl = server
                }
                Toast.makeText(this, "Companion App Paired! (1-Year Session Active)", Toast.LENGTH_LONG).show()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    initialTab: Int,
    initialFinanceMode: String? = null,
    initialFinanceAmount: Double = 0.0,
    initialFinanceDesc: String? = null,
    initialFinanceRotation: Boolean = false,
    prefs: PreferencesManager,
    api: ShudkaraApi,
    queueManager: OfflineQueueManager,
    onOpenSettings: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var selectedTab by remember { mutableStateOf(initialTab) }
    var isSettingsOpen by remember { mutableStateOf(!prefs.isConfigured()) }
    var isSyncing by remember { mutableStateOf(false) }
    var pendingCount by remember { mutableStateOf(queueManager.getQueue().size) }
    var activeCameraCallback by remember { mutableStateOf<((Bitmap) -> Unit)?>(null) }

    // Refresh pending count periodically
    LaunchedEffect(Unit) {
        pendingCount = queueManager.getQueue().size
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(
                                text = "Shudkara Capture",
                                fontWeight = FontWeight.Black,
                                fontSize = 18.sp,
                                color = Slate900
                            )
                            Text(
                                text = "Fast logging & native entry",
                                fontSize = 11.sp,
                                color = Slate400
                            )
                        }
                    },
                    actions = {
                        if (pendingCount > 0) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = Amber50,
                                modifier = Modifier
                                    .clickable {
                                        coroutineScope.launch {
                                            isSyncing = true
                                            val (synced, failed) = queueManager.syncAll()
                                            pendingCount = queueManager.getQueue().size
                                            isSyncing = false
                                            Toast.makeText(context, "Synced $synced items ($failed failed)", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                    .padding(end = 8.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Sync,
                                        contentDescription = "Sync",
                                        tint = Amber600,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "$pendingCount queued",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Amber600
                                    )
                                }
                            }
                        }

                        IconButton(onClick = { isSettingsOpen = true }) {
                            Icon(
                                imageVector = Icons.Default.Settings,
                                contentDescription = "Settings",
                                tint = Slate600
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
                )
            }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .background(Slate50)
            ) {
                // Tab Selector
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color.White,
                    contentColor = Indigo600,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Whatshot, contentDescription = null, modifier = Modifier.size(16.dp), tint = if (selectedTab == 0) Orange600 else Slate400)
                                Spacer(Modifier.width(6.dp))
                                Text("Streaks", fontWeight = FontWeight.Bold, color = if (selectedTab == 0) Orange600 else Slate600)
                            }
                        }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(16.dp), tint = if (selectedTab == 1) Indigo600 else Slate400)
                                Spacer(Modifier.width(6.dp))
                                Text("Timeline", fontWeight = FontWeight.Bold, color = if (selectedTab == 1) Indigo600 else Slate600)
                            }
                        }
                    )
                    Tab(
                        selected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.AccountBalanceWallet, contentDescription = null, modifier = Modifier.size(16.dp), tint = if (selectedTab == 2) Emerald600 else Slate400)
                                Spacer(Modifier.width(6.dp))
                                Text("Finance", fontWeight = FontWeight.Bold, color = if (selectedTab == 2) Emerald600 else Slate600)
                            }
                        }
                    )
                }

                // Tab Content View
                Box(modifier = Modifier.fillMaxSize()) {
                    when (selectedTab) {
                        0 -> StreakCaptureScreen(
                            api = api,
                            queueManager = queueManager,
                            onRequestCamera = { cb -> activeCameraCallback = cb },
                            onCheckInSuccess = {
                                pendingCount = queueManager.getQueue().size
                                Toast.makeText(context, "Check-in recorded!", Toast.LENGTH_SHORT).show()
                            }
                        )
                        1 -> TimelineCaptureScreen(
                            api = api,
                            queueManager = queueManager,
                            onRequestCamera = { cb -> activeCameraCallback = cb },
                            onPostSuccess = {
                                pendingCount = queueManager.getQueue().size
                                Toast.makeText(context, "Timeline moment posted!", Toast.LENGTH_SHORT).show()
                            }
                        )
                        2 -> FinanceCaptureScreen(
                            api = api,
                            queueManager = queueManager,
                            initialMode = initialFinanceMode,
                            initialAmount = initialFinanceAmount,
                            initialDesc = initialFinanceDesc,
                            initialRotation = initialFinanceRotation,
                            onSuccess = {
                                pendingCount = queueManager.getQueue().size
                            }
                        )
                    }
                }
            }
        }

        if (isSettingsOpen) {
            SettingsDialog(
                prefs = prefs,
                api = api,
                queueManager = queueManager,
                onDismiss = { isSettingsOpen = false },
                onSync = {
                    pendingCount = queueManager.getQueue().size
                }
            )
        }

        if (activeCameraCallback != null) {
            FullScreenCameraView(
                onPhotoCaptured = { bitmap ->
                    val cb = activeCameraCallback
                    activeCameraCallback = null
                    cb?.invoke(bitmap)
                },
                onClose = {
                    activeCameraCallback = null
                }
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 1: STREAK QUICK PHOTO PROOF CAPTURE
// ─────────────────────────────────────────────────────────────────────────────
@Composable
fun StreakCaptureScreen(
    api: ShudkaraApi,
    queueManager: OfflineQueueManager,
    onRequestCamera: ((Bitmap) -> Unit) -> Unit,
    onCheckInSuccess: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var streaks by remember { mutableStateOf<List<StreakItem>>(emptyList()) }
    var selectedStreakId by remember { mutableStateOf("") }
    var isLeaveDay by remember { mutableStateOf(false) }
    var notesText by remember { mutableStateOf("") }
    var photoBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var photoBase64 by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }
    var isLoadingStreaks by remember { mutableStateOf(true) }

    val todayStr = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()) }

    // Camera permission and launcher
    val cameraPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            onRequestCamera { bitmap ->
                photoBitmap = bitmap
                coroutineScope.launch(Dispatchers.IO) {
                    photoBase64 = compressBitmapToBase64(bitmap)
                }
            }
        } else {
            Toast.makeText(context, "Camera permission is required to capture photo proof", Toast.LENGTH_SHORT).show()
        }
    }

    val launchCamera = {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            onRequestCamera { bitmap ->
                photoBitmap = bitmap
                coroutineScope.launch(Dispatchers.IO) {
                    photoBase64 = compressBitmapToBase64(bitmap)
                }
            }
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    // Gallery launcher
    val galleryLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri != null) {
            coroutineScope.launch(Dispatchers.IO) {
                try {
                    val stream = context.contentResolver.openInputStream(uri)
                    val bitmap = BitmapFactory.decodeStream(stream)
                    photoBitmap = bitmap
                    photoBase64 = compressBitmapToBase64(bitmap)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    // Load active streaks
    LaunchedEffect(Unit) {
        isLoadingStreaks = true
        val res = api.fetchStreaks()
        if (res.isSuccess) {
            val list = res.getOrDefault(emptyList())
            streaks = list
            if (list.isNotEmpty()) {
                selectedStreakId = list[0].id
            }
        }
        isLoadingStreaks = false
    }

    val selectedStreak = streaks.find { it.id == selectedStreakId }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            // Streak Card Picker
            Text("Select Active Streak", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Slate600)
            if (isLoadingStreaks) {
                Box(Modifier.fillMaxWidth().height(80.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Orange600)
                }
            } else if (streaks.isEmpty()) {
                Surface(
                    color = Color.White,
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp)
                ) {
                    Text(
                        "No streaks found. Please configure server or create a streak on Shudkara Hub.",
                        modifier = Modifier.padding(16.dp),
                        fontSize = 12.sp,
                        color = Slate400
                    )
                }
            } else {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 6.dp)
                ) {
                    items(streaks) { streak ->
                        val isSelected = streak.id == selectedStreakId
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = if (isSelected) Orange50 else Color.White,
                            border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) Orange600 else Slate200),
                            modifier = Modifier
                                .clickable { selectedStreakId = streak.id }
                                .width(170.dp)
                        ) {
                            Column(Modifier.padding(12.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(streak.category.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = Slate400)
                                    Text("🔥 ${streak.currentStreak}d", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Orange600)
                                }
                                Spacer(Modifier.height(4.dp))
                                Text(streak.title, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1, color = Slate900)
                                Text("Target: ${streak.targetTime}", fontSize = 11.sp, color = Slate600)
                            }
                        }
                    }
                }
            }
        }

        // Mode switch: Photo Check-In vs Rest Day Freeze
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Slate200)
                    .padding(3.dp)
            ) {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = if (!isLeaveDay) Color.White else Color.Transparent,
                    modifier = Modifier
                        .weight(1f)
                        .clickable { isLeaveDay = false }
                ) {
                    Text(
                        text = "Camera Photo Proof",
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = if (!isLeaveDay) Slate900 else Slate600,
                        modifier = Modifier.padding(vertical = 8.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }

                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = if (isLeaveDay) Color.White else Color.Transparent,
                    modifier = Modifier
                        .weight(1f)
                        .clickable { isLeaveDay = true }
                ) {
                    Text(
                        text = "Freeze / Rest Day",
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = if (isLeaveDay) Indigo600 else Slate600,
                        modifier = Modifier.padding(vertical = 8.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }
        }

        if (!isLeaveDay) {
            // Photo capture / preview
            item {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color.White,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        if (photoBitmap != null) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(200.dp)
                                    .clip(RoundedCornerShape(12.dp))
                            ) {
                                Image(
                                    bitmap = photoBitmap!!.asImageBitmap(),
                                    contentDescription = "Captured proof",
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = androidx.compose.ui.layout.ContentScale.Crop
                                )
                                IconButton(
                                    onClick = {
                                        photoBitmap = null
                                        photoBase64 = null
                                    },
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .padding(8.dp)
                                        .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(50))
                                ) {
                                    Icon(Icons.Default.Close, contentDescription = "Remove", tint = Color.White, modifier = Modifier.size(16.dp))
                                }
                            }
                        } else {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(130.dp)
                                    .border(1.dp, Slate200, RoundedCornerShape(12.dp))
                                    .clickable { launchCamera() },
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Icon(Icons.Default.PhotoCamera, contentDescription = null, tint = Orange600, modifier = Modifier.size(32.dp))
                                Spacer(Modifier.height(6.dp))
                                Text("Tap to take Daily Photo Proof", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Slate900)
                                Text("Or choose from gallery below", fontSize = 10.sp, color = Slate400)
                            }
                        }

                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { launchCamera() },
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Camera", fontSize = 12.sp)
                            }

                            OutlinedButton(
                                onClick = { galleryLauncher.launch("image/*") },
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Default.PhotoLibrary, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Gallery", fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }

        // Optional Notes
        item {
            OutlinedTextField(
                value = notesText,
                onValueChange = { notesText = it },
                label = { Text("Reflection / Notes (Optional)", fontSize = 12.sp) },
                placeholder = { Text("How was your session today?", fontSize = 12.sp) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                minLines = 2,
                maxLines = 4
            )
        }

        // Action Submit Button
        item {
            Button(
                onClick = {
                    if (selectedStreakId.isBlank()) {
                        Toast.makeText(context, "Please select a streak challenge.", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    if (!isLeaveDay && photoBase64 == null) {
                        Toast.makeText(context, "Please snap a photo proof first.", Toast.LENGTH_SHORT).show()
                        return@Button
                    }

                    isSubmitting = true
                    val streakTitle = selectedStreak?.title ?: "Streak"
                    val payload = StreakCheckInPayload(
                        date = todayStr,
                        photos = if (photoBase64 != null) listOf("data:image/jpeg;base64,$photoBase64") else emptyList(),
                        title = null,
                        notes = notesText.ifBlank { null },
                        isLeaveDay = isLeaveDay
                    )

                    coroutineScope.launch {
                        val res = api.submitStreakCheckIn(selectedStreakId, payload)
                        if (res.isSuccess) {
                            onCheckInSuccess()
                            photoBitmap = null
                            photoBase64 = null
                            notesText = ""
                        } else {
                            // Offline fallback queueing
                            queueManager.enqueueStreakCheckIn(selectedStreakId, payload, streakTitle)
                            Toast.makeText(context, "Saved offline. Queued for server sync.", Toast.LENGTH_LONG).show()
                            onCheckInSuccess()
                            photoBitmap = null
                            photoBase64 = null
                            notesText = ""
                        }
                        isSubmitting = false
                    }
                },
                enabled = !isSubmitting,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Orange600)
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                } else {
                    Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = if (isLeaveDay) "Activate Streak Freeze for Today" else "Confirm Check-In Today",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 2: TIMELINE MOMENT QUICK CAPTURE
// ─────────────────────────────────────────────────────────────────────────────
@Composable
fun TimelineCaptureScreen(
    api: ShudkaraApi,
    queueManager: OfflineQueueManager,
    onRequestCamera: ((Bitmap) -> Unit) -> Unit,
    onPostSuccess: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var title by remember { mutableStateOf("") }
    var contentText by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Life") }
    var tagsInput by remember { mutableStateOf("") }
    var photoBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var photoBase64 by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    val categories = listOf("Life", "General", "Thoughts", "Work", "Fitness", "Coding", "Creative")

    val cameraPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            onRequestCamera { bitmap ->
                photoBitmap = bitmap
                coroutineScope.launch(Dispatchers.IO) {
                    photoBase64 = compressBitmapToBase64(bitmap)
                }
            }
        } else {
            Toast.makeText(context, "Camera permission is required to take photo", Toast.LENGTH_SHORT).show()
        }
    }

    val launchCamera = {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            onRequestCamera { bitmap ->
                photoBitmap = bitmap
                coroutineScope.launch(Dispatchers.IO) {
                    photoBase64 = compressBitmapToBase64(bitmap)
                }
            }
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    val galleryLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri != null) {
            coroutineScope.launch(Dispatchers.IO) {
                try {
                    val stream = context.contentResolver.openInputStream(uri)
                    val bitmap = BitmapFactory.decodeStream(stream)
                    photoBitmap = bitmap
                    photoBase64 = compressBitmapToBase64(bitmap)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Moment Title (Optional)", fontSize = 12.sp) },
                placeholder = { Text("e.g. Evening walk in park", fontSize = 12.sp) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                singleLine = true
            )
        }

        item {
            OutlinedTextField(
                value = contentText,
                onValueChange = { contentText = it },
                label = { Text("Moment Description / Reflection *", fontSize = 12.sp) },
                placeholder = { Text("What happened? Any thoughts or observations...", fontSize = 12.sp) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                minLines = 4,
                maxLines = 8
            )
        }

        // Category Selection Chips
        item {
            Text("Category", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Slate600)
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.padding(top = 4.dp)
            ) {
                items(categories) { cat ->
                    val isSelected = cat == category
                    FilterChip(
                        selected = isSelected,
                        onClick = { category = cat },
                        label = { Text(cat, fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Indigo50,
                            selectedLabelColor = Indigo600
                        )
                    )
                }
            }
        }

        // Photo Attachment Box
        item {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color.White,
                border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    if (photoBitmap != null) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                                .clip(RoundedCornerShape(12.dp))
                        ) {
                            Image(
                                bitmap = photoBitmap!!.asImageBitmap(),
                                contentDescription = "Attached moment image",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = androidx.compose.ui.layout.ContentScale.Crop
                            )
                            IconButton(
                                onClick = {
                                    photoBitmap = null
                                    photoBase64 = null
                                },
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(8.dp)
                                    .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(50))
                            ) {
                                Icon(Icons.Default.Close, contentDescription = "Remove", tint = Color.White, modifier = Modifier.size(16.dp))
                            }
                        }
                    } else {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            OutlinedButton(
                                onClick = { launchCamera() },
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Take Photo", fontSize = 12.sp)
                            }

                            OutlinedButton(
                                onClick = { galleryLauncher.launch("image/*") },
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.PhotoLibrary, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("From Gallery", fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }

        // Tags Input
        item {
            OutlinedTextField(
                value = tagsInput,
                onValueChange = { tagsInput = it },
                label = { Text("Tags (comma separated)", fontSize = 12.sp) },
                placeholder = { Text("sunset, coffee, code", fontSize = 12.sp) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                singleLine = true
            )
        }

        // Submit Button
        item {
            Button(
                onClick = {
                    if (contentText.isBlank()) {
                        Toast.makeText(context, "Please write some description for this moment.", Toast.LENGTH_SHORT).show()
                        return@Button
                    }

                    isSubmitting = true
                    val tagsList = tagsInput.split(",").map { it.trim().lowercase() }.filter { it.isNotBlank() }
                    val mediaList = mutableListOf<TimelineMediaItem>()
                    if (photoBase64 != null) {
                        mediaList.add(
                            TimelineMediaItem(
                                name = "moment_${System.currentTimeMillis()}.jpg",
                                type = "image/jpeg",
                                base64 = photoBase64!!
                            )
                        )
                    }

                    val payload = TimelineMomentPayload(
                        title = title.trim(),
                        content = contentText.trim(),
                        category = category,
                        tags = tagsList,
                        timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date()),
                        mediaFiles = mediaList
                    )

                    coroutineScope.launch {
                        val res = api.submitTimelineMoment(payload)
                        if (res.isSuccess) {
                            onPostSuccess()
                            title = ""
                            contentText = ""
                            tagsInput = ""
                            photoBitmap = null
                            photoBase64 = null
                        } else {
                            // Queue offline
                            queueManager.enqueueTimelineMoment(payload)
                            Toast.makeText(context, "Saved offline. Queued for server sync.", Toast.LENGTH_LONG).show()
                            onPostSuccess()
                            title = ""
                            contentText = ""
                            tagsInput = ""
                            photoBitmap = null
                            photoBase64 = null
                        }
                        isSubmitting = false
                    }
                },
                enabled = !isSubmitting,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Indigo600)
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                } else {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Post Moment", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCE QUICK CAPTURE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
@Composable
fun FinanceCaptureScreen(
    api: ShudkaraApi,
    queueManager: OfflineQueueManager,
    initialMode: String? = null,
    initialAmount: Double = 0.0,
    initialDesc: String? = null,
    initialRotation: Boolean = false,
    onSuccess: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var mode by remember { mutableStateOf(initialMode ?: "expense") } // "expense", "lend", "borrow", "rotation"
    var amountText by remember { mutableStateOf(if (initialAmount > 0.0) initialAmount.toString() else "") }
    var description by remember { mutableStateOf(initialDesc ?: "") }
    var category by remember { mutableStateOf("Food & Dining") }
    var selectedSetId by remember { mutableStateOf<String?>(null) }
    var paymentMethod by remember { mutableStateOf("Bank / Card") }
    var isRotation by remember { mutableStateOf(initialRotation || mode == "rotation") }
    var rotationNote by remember { mutableStateOf("") }

    val todayDateStr = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()) }
    var expenseDate by remember { mutableStateOf(todayDateStr) }

    // Lend/Borrow fields
    var personName by remember { mutableStateOf("") }
    var contact by remember { mutableStateOf("") }
    var expectedReturnDate by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    var isSubmitting by remember { mutableStateOf(false) }
    var expenseSets by remember { mutableStateOf<List<FinanceExpenseSet>>(emptyList()) }

    var hasSmsPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        )
    }

    val smsPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasSmsPermission = granted
        if (granted) {
            Toast.makeText(context, "SMS Auto-Tracking enabled!", Toast.LENGTH_SHORT).show()
        }
    }

    // Load active expense sets
    LaunchedEffect(Unit) {
        val res = api.fetchExpenseSets()
        if (res.isSuccess) {
            expenseSets = res.getOrNull() ?: emptyList()
        }
    }

    val categories = listOf(
        "Food & Dining", "Transport & Fuel", "Groceries", "Entertainment & Outing",
        "Shopping", "Health & Medical", "Bills & Utilities", "Work & Tools", "Miscellaneous"
    )

    val paymentMethods = listOf("Bank / Card", "Cash", "eSewa", "Khalti", "Other")

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // SMS Auto-Tracking Permission Card (if not granted)
        if (!hasSmsPermission) {
            item {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Indigo50,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Indigo600.copy(alpha = 0.2f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Auto-SMS Bank Tracking", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Indigo600)
                            Text("Detects bank debit/credit SMS and prompts instant logging.", fontSize = 10.sp, color = Slate600)
                        }
                        Button(
                            onClick = { smsPermissionLauncher.launch(Manifest.permission.RECEIVE_SMS) },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Indigo600),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text("Enable", fontSize = 11.sp)
                        }
                    }
                }
            }
        }

        // Mode Selector (Segmented Row)
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Slate200, RoundedCornerShape(10.dp))
                    .padding(3.dp)
            ) {
                listOf(
                    "expense" to "Expense",
                    "lend" to "Lend",
                    "borrow" to "Borrow",
                    "rotation" to "Rotation"
                ).forEach { (mKey, mLabel) ->
                    val isSel = mode == mKey
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isSel) Color.White else Color.Transparent)
                            .clickable {
                                mode = mKey
                                isRotation = (mKey == "rotation")
                            }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = mLabel,
                            fontSize = 12.sp,
                            fontWeight = if (isSel) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSel) Emerald600 else Slate600
                        )
                    }
                }
            }
        }

        // Big Amount Input
        item {
            OutlinedTextField(
                value = amountText,
                onValueChange = { amountText = it },
                label = { Text("Amount (Rs. / NPR)", fontSize = 12.sp) },
                placeholder = { Text("0.00", fontSize = 14.sp) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold)
            )
        }

        // Mode-Specific Fields
        when (mode) {
            "expense", "rotation" -> {
                item {
                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        label = { Text("Description / Merchant", fontSize = 11.sp) },
                        placeholder = { Text("e.g. Lunch at Cafe, Fuel, Groceries", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    Text("Category:", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = Slate700)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 4.dp)) {
                        items(categories) { cat ->
                            val isSel = category == cat
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (isSel) Emerald50 else Slate100,
                                border = if (isSel) androidx.compose.foundation.BorderStroke(1.dp, Emerald600) else null,
                                modifier = Modifier.clickable { category = cat }
                            ) {
                                Text(
                                    text = cat,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSel) Emerald600 else Slate700,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }
                }

                if (expenseSets.isNotEmpty()) {
                    item {
                        Text("Link to Expense Set / Trip Bucket:", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = Slate700)
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 4.dp)) {
                            item {
                                val isNone = selectedSetId == null
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = if (isNone) Indigo50 else Slate100,
                                    border = if (isNone) androidx.compose.foundation.BorderStroke(1.dp, Indigo600) else null,
                                    modifier = Modifier.clickable { selectedSetId = null }
                                ) {
                                    Text("None (Standalone)", fontSize = 11.sp, fontWeight = if (isNone) FontWeight.Bold else FontWeight.Normal, color = if (isNone) Indigo600 else Slate700, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
                                }
                            }
                            items(expenseSets) { s ->
                                val isSel = selectedSetId == s.id
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = if (isSel) Indigo50 else Slate100,
                                    border = if (isSel) androidx.compose.foundation.BorderStroke(1.dp, Indigo600) else null,
                                    modifier = Modifier.clickable { selectedSetId = s.id }
                                ) {
                                    Text(s.name, fontSize = 11.sp, fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal, color = if (isSel) Indigo600 else Slate700, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
                                }
                            }
                        }
                    }
                }

                item {
                    Text("Payment Method:", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = Slate700)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 4.dp)) {
                        items(paymentMethods) { pm ->
                            val isSel = paymentMethod == pm
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (isSel) Slate900 else Slate100,
                                modifier = Modifier.clickable { paymentMethod = pm }
                            ) {
                                Text(pm, fontSize = 11.sp, fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal, color = if (isSel) Color.White else Slate700, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
                            }
                        }
                    }
                }

                item {
                    Column(modifier = Modifier.fillMaxWidth().padding(top = 2.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (category == "Transport & Fuel") "Date of Travel / Transportation" else "Transaction Date",
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = Slate700
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = if (expenseDate == todayDateStr) Emerald50 else Slate100,
                                    border = if (expenseDate == todayDateStr) androidx.compose.foundation.BorderStroke(1.dp, Emerald600) else null,
                                    modifier = Modifier.clickable { expenseDate = todayDateStr }
                                ) {
                                    Text(
                                        "Today",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (expenseDate == todayDateStr) Emerald600 else Slate700,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = Slate100,
                                    modifier = Modifier.clickable {
                                        val cal = Calendar.getInstance()
                                        cal.add(Calendar.DAY_OF_YEAR, -1)
                                        expenseDate = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(cal.time)
                                    }
                                ) {
                                    Text(
                                        "Yesterday",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Slate700,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }
                        }
                        OutlinedTextField(
                            value = expenseDate,
                            onValueChange = { expenseDate = it },
                            label = { Text("Date (YYYY-MM-DD)", fontSize = 11.sp) },
                            placeholder = { Text(todayDateStr, fontSize = 11.sp) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }

                if (mode == "rotation") {
                    item {
                        OutlinedTextField(
                            value = rotationNote,
                            onValueChange = { rotationNote = it },
                            label = { Text("Rotation Note (e.g. Took cash, sent bank transfer)", fontSize = 11.sp) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
            "lend", "borrow" -> {
                item {
                    OutlinedTextField(
                        value = personName,
                        onValueChange = { personName = it },
                        label = { Text(if (mode == "lend") "Borrower Name (Who took?)" else "Lender Name (Who gave?)", fontSize = 11.sp) },
                        placeholder = { Text("Person's name", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    OutlinedTextField(
                        value = contact,
                        onValueChange = { contact = it },
                        label = { Text("Contact (Phone / Email)", fontSize = 11.sp) },
                        placeholder = { Text("Optional phone number", fontSize = 11.sp) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    OutlinedTextField(
                        value = expectedReturnDate,
                        onValueChange = { expectedReturnDate = it },
                        label = { Text("Expected Return Date (YYYY-MM-DD)", fontSize = 11.sp) },
                        placeholder = { Text("e.g. 2026-10-30", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = Slate100,
                        modifier = Modifier.fillMaxWidth().clickable { isRotation = !isRotation }
                    ) {
                        Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = isRotation, onCheckedChange = { isRotation = it })
                            Spacer(Modifier.width(6.dp))
                            Text("Temporary rotation (few hours to 1 day)", fontSize = 11.sp, color = Slate800)
                        }
                    }
                }

                item {
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Notes / Purpose", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        // Save Button
        item {
            Button(
                onClick = {
                    val amt = amountText.toDoubleOrNull() ?: 0.0
                    if (amt <= 0.0) {
                        Toast.makeText(context, "Enter a valid positive amount", Toast.LENGTH_SHORT).show()
                        return@Button
                    }

                    isSubmitting = true
                    coroutineScope.launch {
                        when (mode) {
                            "expense", "rotation" -> {
                                val res = api.submitExpense(
                                    amount = amt,
                                    description = description.ifBlank { if (mode == "rotation") "Cash Exchange" else "Expense" },
                                    category = category,
                                    expenseSetId = selectedSetId,
                                    paymentMethod = paymentMethod,
                                    isRotation = isRotation,
                                    rotationNote = rotationNote.ifBlank { null },
                                    date = expenseDate.ifBlank { todayDateStr }
                                )
                                isSubmitting = false
                                if (res.isSuccess) {
                                    Toast.makeText(context, "Expense saved!", Toast.LENGTH_SHORT).show()
                                    amountText = ""
                                    description = ""
                                    expenseDate = todayDateStr
                                    onSuccess()
                                } else {
                                    // Fallback to offline queue
                                    queueManager.enqueueExpense(
                                        amount = amt,
                                        description = description.ifBlank { "Expense" },
                                        category = category,
                                        expenseSetId = selectedSetId,
                                        paymentMethod = paymentMethod,
                                        isRotation = isRotation,
                                        rotationNote = rotationNote.ifBlank { null },
                                        date = expenseDate.ifBlank { todayDateStr }
                                    )
                                    Toast.makeText(context, "Saved to offline outbox!", Toast.LENGTH_SHORT).show()
                                    amountText = ""
                                    description = ""
                                    expenseDate = todayDateStr
                                    onSuccess()
                                }
                            }
                            "lend" -> {
                                if (personName.isBlank()) {
                                    isSubmitting = false
                                    Toast.makeText(context, "Please enter borrower name", Toast.LENGTH_SHORT).show()
                                    return@launch
                                }
                                val res = api.submitLend(
                                    personName = personName,
                                    contact = contact,
                                    amount = amt,
                                    expectedReturnDate = expectedReturnDate,
                                    isRotation = isRotation,
                                    notes = notes
                                )
                                isSubmitting = false
                                if (res.isSuccess) {
                                    Toast.makeText(context, "Lend recorded!", Toast.LENGTH_SHORT).show()
                                    amountText = ""
                                    personName = ""
                                    onSuccess()
                                } else {
                                    queueManager.enqueueLend(personName, contact, amt, expectedReturnDate, isRotation, notes)
                                    Toast.makeText(context, "Saved to offline outbox!", Toast.LENGTH_SHORT).show()
                                    amountText = ""
                                    personName = ""
                                    onSuccess()
                                }
                            }
                            "borrow" -> {
                                if (personName.isBlank()) {
                                    isSubmitting = false
                                    Toast.makeText(context, "Please enter lender name", Toast.LENGTH_SHORT).show()
                                    return@launch
                                }
                                val res = api.submitBorrow(
                                    personName = personName,
                                    contact = contact,
                                    amount = amt,
                                    expectedReturnDate = expectedReturnDate,
                                    isRotation = isRotation,
                                    notes = notes
                                )
                                isSubmitting = false
                                if (res.isSuccess) {
                                    Toast.makeText(context, "Borrow recorded!", Toast.LENGTH_SHORT).show()
                                    amountText = ""
                                    personName = ""
                                    onSuccess()
                                } else {
                                    queueManager.enqueueBorrow(personName, contact, amt, expectedReturnDate, isRotation, notes)
                                    Toast.makeText(context, "Saved to offline outbox!", Toast.LENGTH_SHORT).show()
                                    amountText = ""
                                    personName = ""
                                    onSuccess()
                                }
                            }
                        }
                    }
                },
                enabled = !isSubmitting,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(18.dp))
                } else {
                    Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Save & Log Entry", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS & AUTHENTICATION DIALOG (1-Year Sessions, Email OTP, TOTP & 1-Tap)
// ─────────────────────────────────────────────────────────────────────────────
@Composable
fun SettingsDialog(
    prefs: PreferencesManager,
    api: ShudkaraApi,
    queueManager: OfflineQueueManager,
    onDismiss: () -> Unit,
    onSync: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var serverUrl by remember { mutableStateOf(prefs.serverUrl) }
    var sessionToken by remember { mutableStateOf(prefs.sessionToken) }
    var authMode by remember { mutableStateOf(0) } // 0: Email OTP, 1: Authenticator (TOTP), 2: Manual Token
    var otpCode by remember { mutableStateOf("") }
    var totpCode by remember { mutableStateOf("") }
    var manualToken by remember { mutableStateOf(prefs.sessionToken) }

    var isSendingOtp by remember { mutableStateOf(false) }
    var isVerifying by remember { mutableStateOf(false) }
    var isTesting by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var isError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Security, contentDescription = null, tint = Indigo600, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(8.dp))
                Text("Account & Connection", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        },
        text = {
            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    // Server URL Field
                    OutlinedTextField(
                        value = serverUrl,
                        onValueChange = {
                            serverUrl = it
                            prefs.serverUrl = it
                        },
                        label = { Text("Server Hub URL", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                item {
                    // Current Session Status Card
                    if (sessionToken.isNotBlank()) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Emerald50,
                            border = androidx.compose.foundation.BorderStroke(1.dp, Emerald500.copy(alpha = 0.4f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Emerald600, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text("Authenticated (1-Year Session Active)", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Emerald600)
                                }
                                Text("Sliding renewal automatically extends validity when you log moments or check streaks.", fontSize = 10.sp, color = Slate600)

                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                                    Button(
                                        onClick = {
                                            isTesting = true
                                            statusMessage = null
                                            coroutineScope.launch {
                                                val res = api.testConnection()
                                                isTesting = false
                                                isError = res.isFailure
                                                statusMessage = if (res.isSuccess) res.getOrNull() else "Error: ${res.exceptionOrNull()?.message}"
                                            }
                                        },
                                        shape = RoundedCornerShape(8.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = Slate800),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        if (isTesting) {
                                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(14.dp))
                                        } else {
                                            Text("Test", fontSize = 11.sp)
                                        }
                                    }

                                    OutlinedButton(
                                        onClick = {
                                            prefs.sessionToken = ""
                                            sessionToken = ""
                                            statusMessage = "Logged out successfully"
                                            isError = false
                                        },
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("Log Out", fontSize = 11.sp, color = Color.Red)
                                    }
                                }
                            }
                        }
                    } else {
                        // Not Authenticated -> Show 1-step Login options
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Slate50,
                            border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text("Log in once for 1-year access:", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Slate900)

                                // Tab Selector
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Slate200, RoundedCornerShape(8.dp))
                                        .padding(2.dp)
                                ) {
                                    val tabs = listOf("Email OTP", "Authenticator", "Token")
                                    tabs.forEachIndexed { idx, label ->
                                        val isSel = authMode == idx
                                        Box(
                                            modifier = Modifier
                                                .weight(1f)
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(if (isSel) Color.White else Color.Transparent)
                                                .clickable { authMode = idx; statusMessage = null }
                                                .padding(vertical = 6.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = label,
                                                fontSize = 11.sp,
                                                fontWeight = if (isSel) FontWeight.Bold else FontWeight.Medium,
                                                color = if (isSel) Indigo600 else Slate600
                                            )
                                        }
                                    }
                                }

                                when (authMode) {
                                    0 -> { // Email OTP
                                        Text("Sends a 6-digit one-time code to owner email:", fontSize = 11.sp, color = Slate600)
                                        Button(
                                            onClick = {
                                                isSendingOtp = true
                                                statusMessage = null
                                                coroutineScope.launch {
                                                    val res = api.sendEmailOtp()
                                                    isSendingOtp = false
                                                    isError = res.isFailure
                                                    statusMessage = if (res.isSuccess) res.getOrNull() else "Error: ${res.exceptionOrNull()?.message}"
                                                }
                                            },
                                            enabled = !isSendingOtp,
                                            modifier = Modifier.fillMaxWidth(),
                                            shape = RoundedCornerShape(8.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = Indigo600)
                                        ) {
                                            if (isSendingOtp) {
                                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(14.dp))
                                            } else {
                                                Text("Send Code to Email", fontSize = 12.sp)
                                            }
                                        }

                                        OutlinedTextField(
                                            value = otpCode,
                                            onValueChange = { if (it.length <= 6) otpCode = it },
                                            label = { Text("Enter 6-digit Code", fontSize = 11.sp) },
                                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                            singleLine = true,
                                            modifier = Modifier.fillMaxWidth()
                                        )

                                        Button(
                                            onClick = {
                                                if (otpCode.length == 6) {
                                                    isVerifying = true
                                                    statusMessage = null
                                                    coroutineScope.launch {
                                                        val res = api.verifyEmailOtp(otpCode)
                                                        isVerifying = false
                                                        if (res.isSuccess) {
                                                            sessionToken = res.getOrNull() ?: ""
                                                            statusMessage = "Authenticated successfully for 1 Year!"
                                                            isError = false
                                                        } else {
                                                            isError = true
                                                            statusMessage = "Error: ${res.exceptionOrNull()?.message}"
                                                        }
                                                    }
                                                }
                                            },
                                            enabled = !isVerifying && otpCode.length == 6,
                                            modifier = Modifier.fillMaxWidth(),
                                            shape = RoundedCornerShape(8.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = Emerald600)
                                        ) {
                                            if (isVerifying) {
                                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(14.dp))
                                            } else {
                                                Text("Verify & Sign In (1-Year Session)", fontSize = 12.sp)
                                            }
                                        }
                                    }
                                    1 -> { // Authenticator TOTP
                                        Text("Enter code from Google Authenticator:", fontSize = 11.sp, color = Slate600)
                                        OutlinedTextField(
                                            value = totpCode,
                                            onValueChange = { if (it.length <= 6) totpCode = it },
                                            label = { Text("6-digit TOTP Code", fontSize = 11.sp) },
                                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                            singleLine = true,
                                            modifier = Modifier.fillMaxWidth()
                                        )

                                        Button(
                                            onClick = {
                                                if (totpCode.length == 6) {
                                                    isVerifying = true
                                                    statusMessage = null
                                                    coroutineScope.launch {
                                                        val res = api.verifyTotp(totpCode)
                                                        isVerifying = false
                                                        if (res.isSuccess) {
                                                            sessionToken = res.getOrNull() ?: ""
                                                            statusMessage = "Authenticated successfully for 1 Year!"
                                                            isError = false
                                                        } else {
                                                            isError = true
                                                            statusMessage = "Error: ${res.exceptionOrNull()?.message}"
                                                        }
                                                    }
                                                }
                                            },
                                            enabled = !isVerifying && totpCode.length == 6,
                                            modifier = Modifier.fillMaxWidth(),
                                            shape = RoundedCornerShape(8.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = Indigo600)
                                        ) {
                                            if (isVerifying) {
                                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(14.dp))
                                            } else {
                                                Text("Verify TOTP Code", fontSize = 12.sp)
                                            }
                                        }
                                    }
                                    2 -> { // Manual Token
                                        OutlinedTextField(
                                            value = manualToken,
                                            onValueChange = { manualToken = it },
                                            label = { Text("Session Token", fontSize = 11.sp) },
                                            singleLine = true,
                                            modifier = Modifier.fillMaxWidth()
                                        )
                                        Button(
                                            onClick = {
                                                prefs.sessionToken = manualToken
                                                sessionToken = manualToken
                                                statusMessage = "Token saved."
                                                isError = false
                                            },
                                            modifier = Modifier.fillMaxWidth(),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text("Save Token", fontSize = 12.sp)
                                        }
                                    }
                                }

                                Text(
                                    text = "1-Tap Tip: If you're logged into Shudkara in your mobile browser, tap 'Pair Mobile App' on the Dashboard to link in 1 tap.",
                                    fontSize = 10.sp,
                                    color = Slate500
                                )
                            }
                        }
                    }
                }

                if (statusMessage != null) {
                    item {
                        Text(
                            text = statusMessage!!,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isError) Color.Red else Emerald600
                        )
                    }
                }

                val queued = queueManager.getQueue().size
                if (queued > 0) {
                    item {
                        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                        Text("Offline Outbox: $queued items pending", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Button(
                            onClick = {
                                coroutineScope.launch {
                                    val (synced, failed) = queueManager.syncAll()
                                    onSync()
                                    Toast.makeText(context, "Synced $synced items ($failed failed)", Toast.LENGTH_SHORT).show()
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Sync Outbox Now ($queued)", fontSize = 12.sp)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    prefs.serverUrl = serverUrl
                    if (sessionToken.isNotBlank()) {
                        prefs.sessionToken = sessionToken
                    }
                    onDismiss()
                }
            ) {
                Text("Done")
            }
        }
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// BITMAP COMPRESSION HELPER (Outputs Base64 JPEG < 200KB)
// ─────────────────────────────────────────────────────────────────────────────
suspend fun compressBitmapToBase64(original: Bitmap): String = withContext(Dispatchers.IO) {
    val maxDimension = 1280
    val width = original.width
    val height = original.height

    val scaledBitmap = if (width > maxDimension || height > maxDimension) {
        val ratio = width.toFloat() / height.toFloat()
        val targetW = if (ratio > 1) maxDimension else (maxDimension * ratio).toInt()
        val targetH = if (ratio > 1) (maxDimension / ratio).toInt() else maxDimension
        Bitmap.createScaledBitmap(original, targetW, targetH, true)
    } else {
        original
    }

    val stream = ByteArrayOutputStream()
    scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 75, stream)
    val bytes = stream.toByteArray()
    Base64.encodeToString(bytes, Base64.NO_WRAP)
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL-SCREEN CAMERAX IN-APP VIEWFINDER
// ─────────────────────────────────────────────────────────────────────────────
@Composable
fun FullScreenCameraView(
    onPhotoCaptured: (Bitmap) -> Unit,
    onClose: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var lensFacing by remember { mutableIntStateOf(CameraSelector.LENS_FACING_BACK) }
    var flashMode by remember { mutableIntStateOf(ImageCapture.FLASH_MODE_OFF) }
    var isCapturing by remember { mutableStateOf(false) }
    var showFlashOverlay by remember { mutableStateOf(false) }

    var previewView by remember { mutableStateOf<PreviewView?>(null) }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    var cameraControl by remember { mutableStateOf<CameraControl?>(null) }
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }

    // Tap to focus position
    var focusPoint by remember { mutableStateOf<Offset?>(null) }

    // In-camera gallery picker alternative
    val galleryLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri != null) {
            try {
                val stream = context.contentResolver.openInputStream(uri)
                val bmp = BitmapFactory.decodeStream(stream)
                stream?.close()
                if (bmp != null) {
                    onPhotoCaptured(bmp)
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Failed to load image: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // Bind CameraX lifecycle
    LaunchedEffect(lensFacing, lifecycleOwner, previewView) {
        val pv = previewView ?: return@LaunchedEffect
        val providerFuture = ProcessCameraProvider.getInstance(context)
        val provider = withContext(Dispatchers.IO) {
            providerFuture.get()
        }
        cameraProvider = provider

        try {
            provider.unbindAll()

            val selector = CameraSelector.Builder()
                .requireLensFacing(lensFacing)
                .build()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(pv.surfaceProvider)
            }

            val capture = ImageCapture.Builder()
                .setFlashMode(flashMode)
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()

            val camera = provider.bindToLifecycle(lifecycleOwner, selector, preview, capture)
            imageCapture = capture
            cameraControl = camera.cameraControl
        } catch (e: Exception) {
            Toast.makeText(context, "Camera initialization failed: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    // Flash mode update
    LaunchedEffect(flashMode) {
        imageCapture?.flashMode = flashMode
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        // Fullscreen Live Preview
        AndroidView(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures { offset ->
                        focusPoint = offset
                        val pv = previewView ?: return@detectTapGestures
                        val factory = pv.meteringPointFactory
                        val point = factory.createPoint(offset.x, offset.y)
                        val action = FocusMeteringAction.Builder(point, FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE)
                            .setAutoCancelDuration(2, java.util.concurrent.TimeUnit.SECONDS)
                            .build()
                        cameraControl?.startFocusAndMetering(action)
                    }
                },
            factory = { ctx ->
                PreviewView(ctx).apply {
                    scaleType = PreviewView.ScaleType.FILL_CENTER
                    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                    previewView = this
                }
            },
            update = { pv ->
                if (previewView == null) {
                    previewView = pv
                }
            }
        )

        // Tap to focus reticle indicator
        focusPoint?.let { pt ->
            Box(
                modifier = Modifier
                    .offset { IntOffset(pt.x.toInt() - 32, pt.y.toInt() - 32) }
                    .size(64.dp)
                    .border(1.5.dp, Color(0xFFFBBF24), RoundedCornerShape(8.dp))
            )
            LaunchedEffect(pt) {
                delay(1200)
                focusPoint = null
            }
        }

        // Shutter Flash Effect
        if (showFlashOverlay) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.White.copy(alpha = 0.85f))
            )
            LaunchedEffect(Unit) {
                delay(60)
                showFlashOverlay = false
            }
        }

        // FLOATING TOP BAR
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 48.dp, start = 20.dp, end = 20.dp)
                .align(Alignment.TopCenter),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Close / Exit Camera
            IconButton(
                onClick = onClose,
                modifier = Modifier
                    .size(44.dp)
                    .background(Color.Black.copy(alpha = 0.5f), CircleShape)
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Close Camera",
                    tint = Color.White
                )
            }

            // Flash Mode Toggle Pill
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = Color.Black.copy(alpha = 0.5f),
                modifier = Modifier.clickable {
                    flashMode = when (flashMode) {
                        ImageCapture.FLASH_MODE_OFF -> ImageCapture.FLASH_MODE_AUTO
                        ImageCapture.FLASH_MODE_AUTO -> ImageCapture.FLASH_MODE_ON
                        else -> ImageCapture.FLASH_MODE_OFF
                    }
                }
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    val (icon, label) = when (flashMode) {
                        ImageCapture.FLASH_MODE_ON -> Icons.Default.FlashOn to "ON"
                        ImageCapture.FLASH_MODE_AUTO -> Icons.Default.FlashAuto to "AUTO"
                        else -> Icons.Default.FlashOff to "OFF"
                    }
                    Icon(
                        imageVector = icon,
                        contentDescription = "Flash Mode",
                        tint = if (flashMode == ImageCapture.FLASH_MODE_OFF) Color.White.copy(alpha = 0.8f) else Color(0xFFFBBF24),
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = label,
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Quick Lens Switch on Top Right
            IconButton(
                onClick = {
                    lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
                        CameraSelector.LENS_FACING_FRONT
                    } else {
                        CameraSelector.LENS_FACING_BACK
                    }
                },
                modifier = Modifier
                    .size(44.dp)
                    .background(Color.Black.copy(alpha = 0.5f), CircleShape)
            ) {
                Icon(
                    imageVector = Icons.Default.Cameraswitch,
                    contentDescription = "Switch Camera",
                    tint = Color.White
                )
            }
        }

        // FLOATING BOTTOM CONTROLS
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 44.dp, start = 28.dp, end = 28.dp)
                .align(Alignment.BottomCenter)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // 1. Gallery Shortcut Button (Left)
                IconButton(
                    onClick = { galleryLauncher.launch("image/*") },
                    modifier = Modifier
                        .size(52.dp)
                        .background(Color.Black.copy(alpha = 0.5f), CircleShape)
                        .border(1.5.dp, Color.White.copy(alpha = 0.4f), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.PhotoLibrary,
                        contentDescription = "Pick from Gallery",
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                }

                // 2. Real Camera Shutter Button (Center)
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .border(4.dp, Color.White, CircleShape)
                        .padding(5.dp),
                    contentAlignment = Alignment.Center
                ) {
                    val scale by animateFloatAsState(
                        targetValue = if (isCapturing) 0.85f else 1f,
                        label = "shutterScale"
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .scale(scale)
                            .background(if (isCapturing) Color.LightGray else Color.White, CircleShape)
                            .clickable(enabled = !isCapturing && imageCapture != null) {
                                val capture = imageCapture ?: return@clickable
                                isCapturing = true
                                showFlashOverlay = true

                                capture.takePicture(
                                    ContextCompat.getMainExecutor(context),
                                    object : ImageCapture.OnImageCapturedCallback() {
                                        override fun onCaptureSuccess(image: ImageProxy) {
                                            try {
                                                val rawBitmap = image.toBitmap()
                                                val rotation = image.imageInfo.rotationDegrees
                                                val isFront = (lensFacing == CameraSelector.LENS_FACING_FRONT)
                                                val rotatedBitmap = if (rotation != 0 || isFront) {
                                                    val matrix = Matrix().apply {
                                                        if (isFront) postScale(-1f, 1f)
                                                        if (rotation != 0) postRotate(rotation.toFloat())
                                                    }
                                                    Bitmap.createBitmap(
                                                        rawBitmap, 0, 0,
                                                        rawBitmap.width, rawBitmap.height,
                                                        matrix, true
                                                    )
                                                } else {
                                                    rawBitmap
                                                }
                                                onPhotoCaptured(rotatedBitmap)
                                            } catch (e: Exception) {
                                                Toast.makeText(context, "Error processing photo: ${e.message}", Toast.LENGTH_SHORT).show()
                                            } finally {
                                                image.close()
                                                isCapturing = false
                                            }
                                        }

                                        override fun onError(exception: ImageCaptureException) {
                                            isCapturing = false
                                            Toast.makeText(context, "Photo capture failed: ${exception.message}", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                )
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        if (isCapturing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(28.dp),
                                color = Color.DarkGray,
                                strokeWidth = 3.dp
                            )
                        }
                    }
                }

                // 3. Flip Camera Switch (Right)
                IconButton(
                    onClick = {
                        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
                            CameraSelector.LENS_FACING_FRONT
                        } else {
                            CameraSelector.LENS_FACING_BACK
                        }
                    },
                    modifier = Modifier
                        .size(52.dp)
                        .background(Color.Black.copy(alpha = 0.5f), CircleShape)
                        .border(1.5.dp, Color.White.copy(alpha = 0.4f), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.FlipCameraAndroid,
                        contentDescription = "Switch Camera",
                        tint = Color.White,
                        modifier = Modifier.size(26.dp)
                    )
                }
            }
        }
    }
}
