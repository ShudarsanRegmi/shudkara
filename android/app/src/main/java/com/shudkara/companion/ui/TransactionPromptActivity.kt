package com.shudkara.companion.ui

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shudkara.companion.data.*
import com.shudkara.companion.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class TransactionPromptActivity : ComponentActivity() {

    private lateinit var api: ShudkaraApi
    private lateinit var queueManager: OfflineQueueManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        api = ShudkaraApi(this)
        queueManager = OfflineQueueManager(this)

        val amount = intent.getDoubleExtra("tx_amount", 0.0)
        val type = intent.getStringExtra("tx_type") ?: "DEBIT"
        val date = intent.getStringExtra("tx_date") ?: ""
        val account = intent.getStringExtra("tx_account") ?: ""
        val counterparty = intent.getStringExtra("tx_counterparty") ?: ""
        val upiRef = intent.getStringExtra("tx_upi_ref") ?: ""
        val bank = intent.getStringExtra("tx_bank") ?: "Bank"
        val rawBody = intent.getStringExtra("tx_raw") ?: ""

        setContent {
            ShudkaraTheme {
                FloatingPromptContent(
                    amount = amount,
                    type = type,
                    date = date,
                    account = account,
                    counterparty = counterparty,
                    upiRef = upiRef,
                    bank = bank,
                    rawBody = rawBody,
                    api = api,
                    queueManager = queueManager,
                    onDismiss = { finish() }
                )
            }
        }
    }
}

@Composable
fun FloatingPromptContent(
    amount: Double,
    type: String,
    date: String,
    account: String,
    counterparty: String,
    upiRef: String,
    bank: String,
    rawBody: String,
    api: ShudkaraApi,
    queueManager: OfflineQueueManager,
    onDismiss: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var amountText by remember { mutableStateOf(if (amount > 0) amount.toString() else "") }
    var description by remember { mutableStateOf(if (counterparty.isNotBlank()) "UPI to A/c $counterparty" else "Bank Transaction") }
    var category by remember { mutableStateOf("Food & Dining") }
    var expenseDate by remember { mutableStateOf(date) }
    var selectedSetId by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    // Split & People states
    var isSplit by remember { mutableStateOf(false) }
    var splitType by remember { mutableStateOf("equal") } // "equal" (50/50), "full_them" (100% them), "custom"
    var people by remember { mutableStateOf<List<FinancePerson>>(emptyList()) }
    var selectedPersonName by remember { mutableStateOf<String?>(null) }
    var customTheirShare by remember { mutableStateOf("") }
    var newPersonName by remember { mutableStateOf("") }
    var showAddPersonDialog by remember { mutableStateOf(false) }

    // Expense sets
    var expenseSets by remember { mutableStateOf<List<FinanceExpenseSet>>(emptyList()) }

    // Load initial sets and people
    LaunchedEffect(Unit) {
        val sRes = api.fetchExpenseSets()
        if (sRes.isSuccess) expenseSets = sRes.getOrDefault(emptyList())

        val pRes = api.fetchPeople()
        if (pRes.isSuccess) {
            val list = pRes.getOrDefault(emptyList())
            people = list
            val defaultP = list.find { it.isDefault }
            if (defaultP != null) selectedPersonName = defaultP.name
        }
    }

    val totalAmt = amountText.toDoubleOrNull() ?: 0.0
    val theirShare = when (splitType) {
        "equal" -> if (totalAmt > 0) (totalAmt / 2.0) else 0.0
        "full_them" -> totalAmt
        "custom" -> customTheirShare.toDoubleOrNull() ?: 0.0
        else -> 0.0
    }
    val myShare = maxOf(0.0, totalAmt - theirShare)

    val categories = listOf("Food & Dining", "Transport & Fuel", "Groceries", "Outing / Trip", "Shopping", "Bills & Utilities", "Work & Tools", "Miscellaneous")

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.55f))
            .clickable { onDismiss() },
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .padding(vertical = 24.dp)
                .clickable(enabled = false) {}, // prevent dismissing when tapping inside
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Header: Bank info & close button
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = if (type == "DEBIT") Red50 else Emerald50
                            ) {
                                Text(
                                    text = type,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (type == "DEBIT") Color(0xFFDC2626) else Emerald600,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                            Spacer(Modifier.width(8.dp))
                            Text(bank, fontWeight = FontWeight.Black, fontSize = 14.sp, color = Slate900)
                        }
                        Text(
                            text = if (account.isNotBlank()) "A/c $account • $date" else date,
                            fontSize = 11.sp,
                            color = Slate500
                        )
                    }

                    IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = Slate400)
                    }
                }

                // Big Amount Input
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it },
                    label = { Text("Amount (Rs. / INR)", fontSize = 11.sp) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Black, color = Slate900)
                )

                // Description
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description / What was this for?", fontSize = 11.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Category Selector
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Category", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Slate700)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
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

                // Expense Set Bucket (if available)
                if (expenseSets.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Trip Bucket / Expense Set", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Slate700)
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            item {
                                val isNone = selectedSetId == null
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = if (isNone) Indigo50 else Slate100,
                                    border = if (isNone) androidx.compose.foundation.BorderStroke(1.dp, Indigo600) else null,
                                    modifier = Modifier.clickable { selectedSetId = null }
                                ) {
                                    Text("Standalone", fontSize = 11.sp, fontWeight = if (isNone) FontWeight.Bold else FontWeight.Normal, color = if (isNone) Indigo600 else Slate700, modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp))
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
                                    Text(s.name, fontSize = 11.sp, fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal, color = if (isSel) Indigo600 else Slate700, modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp))
                                }
                            }
                        }
                    }
                }

                // ─────────────────────────────────────────────────────────────
                // SPLIT / WHO IS THIS FOR?
                // ─────────────────────────────────────────────────────────────
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Slate50,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Who is this expense for?", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Slate900)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(if (isSplit) "Split / With Friends" else "Only Me", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (isSplit) Indigo600 else Slate600)
                                Switch(
                                    checked = isSplit,
                                    onCheckedChange = { isSplit = it },
                                    modifier = Modifier.scale(0.8f)
                                )
                            }
                        }

                        if (isSplit) {
                            // Person Chips
                            Text("Select Friend / Companion:", fontSize = 11.sp, color = Slate600)
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                items(people) { p ->
                                    val isSel = selectedPersonName == p.name
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = if (isSel) Indigo50 else Color.White,
                                        border = androidx.compose.foundation.BorderStroke(1.dp, if (isSel) Indigo600 else Slate300),
                                        modifier = Modifier.clickable { selectedPersonName = p.name }
                                    ) {
                                        Row(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Text(p.name, fontSize = 11.sp, fontWeight = if (isSel) FontWeight.Bold else FontWeight.Medium, color = if (isSel) Indigo600 else Slate700)
                                            if (p.isDefault) {
                                                Spacer(Modifier.width(4.dp))
                                                Text("(default)", fontSize = 9.sp, color = Indigo600)
                                            }
                                        }
                                    }
                                }
                                item {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = Slate100,
                                        modifier = Modifier.clickable { showAddPersonDialog = true }
                                    ) {
                                        Text("+ Add Person", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Indigo600, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
                                    }
                                }
                            }

                            // Split Mode (Equal 50/50, 100% Them, Custom)
                            Row(modifier = Modifier.fillMaxWidth().background(Slate200, RoundedCornerShape(8.dp)).padding(2.dp)) {
                                listOf(
                                    "equal" to "Equal 50/50",
                                    "full_them" to "100% for Them",
                                    "custom" to "Custom"
                                ).forEach { (k, label) ->
                                    val sel = splitType == k
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .background(if (sel) Color.White else Color.Transparent, RoundedCornerShape(6.dp))
                                            .clickable { splitType = k }
                                            .padding(vertical = 6.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(label, fontSize = 10.sp, fontWeight = if (sel) FontWeight.Bold else FontWeight.Medium, color = if (sel) Indigo600 else Slate600)
                                    }
                                }
                            }

                            if (splitType == "custom") {
                                OutlinedTextField(
                                    value = customTheirShare,
                                    onValueChange = { customTheirShare = it },
                                    label = { Text("${selectedPersonName ?: "Their"} share amount", fontSize = 10.sp) },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }

                            // Ledger Calculation Preview
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = Indigo50,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(8.dp)) {
                                    Text(
                                        text = "My Personal Expense: Rs. %.2f".format(myShare),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        color = Slate900
                                    )
                                    Text(
                                        text = "${selectedPersonName ?: "Companion"} owes you: Rs. %.2f (recorded in ledger)".format(theirShare),
                                        fontSize = 11.sp,
                                        color = Indigo600,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }
                }

                // ─────────────────────────────────────────────────────────────
                // BOTTOM ACTION BAR
                // ─────────────────────────────────────────────────────────────
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Rotated / Pass button (0 expense recorded, marks rotated)
                    OutlinedButton(
                        onClick = {
                            isSubmitting = true
                            coroutineScope.launch {
                                if (upiRef.isNotBlank()) {
                                    api.ignoreBacklog(upiRef)
                                }
                                Toast.makeText(context, "Marked as rotated/ignored", Toast.LENGTH_SHORT).show()
                                isSubmitting = false
                                onDismiss()
                            }
                        },
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(vertical = 10.dp)
                    ) {
                        Text("Rotated (Pass)", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Slate600)
                    }

                    // Defer button (leaves in backlog)
                    OutlinedButton(
                        onClick = {
                            Toast.makeText(context, "Deferred to backlog inbox", Toast.LENGTH_SHORT).show()
                            onDismiss()
                        },
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(vertical = 10.dp)
                    ) {
                        Text("Defer", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Indigo600)
                    }

                    // Confirm & Log button
                    Button(
                        onClick = {
                            if (totalAmt <= 0) {
                                Toast.makeText(context, "Enter a valid amount", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            isSubmitting = true
                            coroutineScope.launch {
                                val personName = if (isSplit) selectedPersonName else null
                                val splitAmt = if (isSplit) theirShare else null

                                val res = api.submitExpense(
                                    amount = myShare,
                                    description = description.ifBlank { "Expense" },
                                    category = category,
                                    expenseSetId = selectedSetId,
                                    paymentMethod = "Bank / Card",
                                    isRotation = false,
                                    rotationNote = null,
                                    date = expenseDate,
                                    splitPersonName = personName,
                                    splitAmount = splitAmt
                                )

                                if (upiRef.isNotBlank()) {
                                    val reconcilePayload = JSONObject().apply {
                                        put("myAmount", myShare)
                                        put("theirAmount", theirShare)
                                        put("splitPersonName", personName ?: JSONObject.NULL)
                                        put("description", description)
                                        put("category", category)
                                        put("expenseSetId", selectedSetId ?: JSONObject.NULL)
                                    }
                                    api.reconcileBacklog(upiRef, reconcilePayload)
                                }

                                isSubmitting = false
                                if (res.isSuccess) {
                                    Toast.makeText(context, "Expense & split logged!", Toast.LENGTH_SHORT).show()
                                    onDismiss()
                                } else {
                                    // Fallback to offline queue
                                    queueManager.enqueueExpense(
                                        amount = myShare,
                                        description = description,
                                        category = category,
                                        expenseSetId = selectedSetId,
                                        paymentMethod = "Bank / Card",
                                        isRotation = false,
                                        rotationNote = null,
                                        date = expenseDate,
                                        splitPersonName = personName,
                                        splitAmount = splitAmt
                                    )
                                    Toast.makeText(context, "Saved offline & queued!", Toast.LENGTH_SHORT).show()
                                    onDismiss()
                                }
                            }
                        },
                        enabled = !isSubmitting,
                        colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1.3f),
                        contentPadding = PaddingValues(vertical = 10.dp)
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp))
                        } else {
                            Text("Save", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Inline Add Person Dialog
        if (showAddPersonDialog) {
            AlertDialog(
                onDismissRequest = { showAddPersonDialog = false },
                title = { Text("Add Friend / Companion", fontWeight = FontWeight.Bold, fontSize = 14.sp) },
                text = {
                    OutlinedTextField(
                        value = newPersonName,
                        onValueChange = { newPersonName = it },
                        label = { Text("Person's Name", fontSize = 11.sp) },
                        placeholder = { Text("e.g. Ram, Shyam", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val name = newPersonName.trim()
                            if (name.isNotBlank()) {
                                coroutineScope.launch {
                                    val r = api.createPerson(name)
                                    if (r.isSuccess) {
                                        val created = r.getOrNull()
                                        if (created != null) {
                                            people = people + created
                                            selectedPersonName = created.name
                                        }
                                    } else {
                                        people = people + FinancePerson(id = "p_${System.currentTimeMillis()}", name = name)
                                        selectedPersonName = name
                                    }
                                    showAddPersonDialog = false
                                    newPersonName = ""
                                }
                            }
                        }
                    ) {
                        Text("Add")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddPersonDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
