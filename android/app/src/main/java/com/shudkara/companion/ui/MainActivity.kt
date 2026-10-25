package com.shudkara.companion.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import com.shudkara.companion.data.*
import com.shudkara.companion.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
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

        val initialTab = intent.getIntExtra("extra_tab", 0)

        setContent {
            ShudkaraTheme {
                MainScreen(
                    initialTab = initialTab,
                    prefs = prefs,
                    api = api,
                    queueManager = queueManager,
                    onOpenSettings = { }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    initialTab: Int,
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

    // Refresh pending count periodically
    LaunchedEffect(Unit) {
        pendingCount = queueManager.getQueue().size
    }

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
                            Text("Streak Proof", fontWeight = FontWeight.Bold, color = if (selectedTab == 0) Orange600 else Slate600)
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
                            Text("Timeline Moment", fontWeight = FontWeight.Bold, color = if (selectedTab == 1) Indigo600 else Slate600)
                        }
                    }
                )
            }

            // Tab Content View
            Box(modifier = Modifier.fillMaxSize()) {
                if (selectedTab == 0) {
                    StreakCaptureScreen(
                        api = api,
                        queueManager = queueManager,
                        onCheckInSuccess = {
                            pendingCount = queueManager.getQueue().size
                            Toast.makeText(context, "Check-in recorded!", Toast.LENGTH_SHORT).show()
                        }
                    )
                } else {
                    TimelineCaptureScreen(
                        api = api,
                        queueManager = queueManager,
                        onPostSuccess = {
                            pendingCount = queueManager.getQueue().size
                            Toast.makeText(context, "Timeline moment posted!", Toast.LENGTH_SHORT).show()
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
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 1: STREAK QUICK PHOTO PROOF CAPTURE
// ─────────────────────────────────────────────────────────────────────────────
@Composable
fun StreakCaptureScreen(
    api: ShudkaraApi,
    queueManager: OfflineQueueManager,
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

    // Camera launcher
    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap != null) {
            photoBitmap = bitmap
            coroutineScope.launch(Dispatchers.IO) {
                photoBase64 = compressBitmapToBase64(bitmap)
            }
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
                                    .clickable { cameraLauncher.launch(null) },
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
                                onClick = { cameraLauncher.launch(null) },
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

    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap != null) {
            photoBitmap = bitmap
            coroutineScope.launch(Dispatchers.IO) {
                photoBase64 = compressBitmapToBase64(bitmap)
            }
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
                                onClick = { cameraLauncher.launch(null) },
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
// SETTINGS & PAIRING DIALOG
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
    var testResult by remember { mutableStateOf<String?>(null) }
    var isTesting by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("Connection Settings", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Pair with your Shudkara Web Hub:", fontSize = 11.sp, color = Slate600)

                OutlinedTextField(
                    value = serverUrl,
                    onValueChange = { serverUrl = it },
                    label = { Text("Server URL", fontSize = 11.sp) },
                    placeholder = { Text("https://shudkara.com", fontSize = 11.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = sessionToken,
                    onValueChange = { sessionToken = it },
                    label = { Text("Session Token (X-Session-Token)", fontSize = 11.sp) },
                    placeholder = { Text("Paste token from Web App", fontSize = 11.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Button(
                    onClick = {
                        prefs.serverUrl = serverUrl
                        prefs.sessionToken = sessionToken
                        isTesting = true
                        testResult = null
                        coroutineScope.launch {
                            val res = api.testConnection()
                            isTesting = false
                            testResult = if (res.isSuccess) {
                                res.getOrNull()
                            } else {
                                "Error: ${res.exceptionOrNull()?.message}"
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Slate800)
                ) {
                    if (isTesting) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp))
                    } else {
                        Text("Save & Test Connection", fontSize = 12.sp)
                    }
                }

                if (testResult != null) {
                    Text(
                        text = testResult!!,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (testResult!!.startsWith("Connected")) Emerald600 else Color.Red
                    )
                }

                val queued = queueManager.getQueue().size
                if (queued > 0) {
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
        },
        confirmButton = {
            Button(
                onClick = {
                    prefs.serverUrl = serverUrl
                    prefs.sessionToken = sessionToken
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
