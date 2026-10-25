package com.shudkara.companion.service

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import com.shudkara.companion.R
import com.shudkara.companion.ShudkaraApp
import com.shudkara.companion.data.ShudkaraApi
import com.shudkara.companion.ui.TransactionPromptActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.regex.Pattern

class SmsTransactionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        for (sms in messages) {
            val sender = sms.displayOriginatingAddress ?: ""
            val body = sms.displayMessageBody ?: ""
            val parsedTx = parseFinancialSms(sender, body) ?: continue

            // Auto-post to Central Backlog immediately so it's safely synced across all devices
            val api = ShudkaraApi(context)
            CoroutineScope(Dispatchers.IO).launch {
                api.postToBacklog(
                    rawSms = parsedTx.rawBody,
                    sender = parsedTx.sender,
                    bank = parsedTx.bank,
                    type = parsedTx.type,
                    amount = parsedTx.amount,
                    date = parsedTx.date,
                    account = parsedTx.account,
                    counterpartyAccount = parsedTx.counterpartyAccount,
                    upiRef = parsedTx.upiRef
                )
            }

            // Immediately Reach Out:
            // 1. Launch floating dialog activity directly over the screen
            try {
                val promptIntent = Intent(context, TransactionPromptActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    putExtra("tx_amount", parsedTx.amount)
                    putExtra("tx_type", parsedTx.type)
                    putExtra("tx_date", parsedTx.date)
                    putExtra("tx_account", parsedTx.account)
                    putExtra("tx_counterparty", parsedTx.counterpartyAccount)
                    putExtra("tx_upi_ref", parsedTx.upiRef)
                    putExtra("tx_bank", parsedTx.bank)
                    putExtra("tx_sender", parsedTx.sender)
                    putExtra("tx_raw", parsedTx.rawBody)
                }
                context.startActivity(promptIntent)
            } catch (e: Exception) {
                e.printStackTrace()
            }

            // 2. High-Priority Heads-Up Notification with 1-Tap Actions
            showTransactionPromptNotification(context, parsedTx)
        }
    }

    data class ParsedTransaction(
        val amount: Double,
        val type: String, // "DEBIT" or "CREDIT"
        val date: String, // "YYYY-MM-DD"
        val account: String,
        val counterpartyAccount: String,
        val upiRef: String,
        val bank: String,
        val sender: String,
        val merchantOrNote: String,
        val rawBody: String
    )

    private fun parseFinancialSms(sender: String, text: String): ParsedTransaction? {
        val lower = text.lowercase()

        // 1. Detect Financial Intent
        val isFinancial = lower.contains("debited") || lower.contains("credited") ||
                lower.contains("spent") || lower.contains("received") ||
                lower.contains("a/c") || lower.contains("acct") ||
                lower.contains("transferred") || lower.contains("withdrawn") ||
                lower.contains("rs.") || lower.contains("inr") || lower.contains("npr")

        if (!isFinancial) return null

        val isDebit = lower.contains("debited") || lower.contains("debit") ||
                lower.contains("spent") || lower.contains("withdrawn") || lower.contains("paid")
        val isCredit = lower.contains("credited") || lower.contains("credit") ||
                lower.contains("received") || lower.contains("deposited")

        if (!isDebit && !isCredit) return null

        // 2. Extract Amount (e.g., "Rs.320.00", "Rs. 500.00", "INR 1200")
        var detectedAmount: Double? = null
        val amountPattern = Pattern.compile(
            "(?:rs\\.?|inr|npr|usd)\\s*([0-9]+(?:,[0-9]+)*(?:\\.[0-9]{1,2})?)",
            Pattern.CASE_INSENSITIVE
        )
        val amtMatcher = amountPattern.matcher(text)
        if (amtMatcher.find()) {
            val amtStr = amtMatcher.group(1)?.replace(",", "")
            detectedAmount = amtStr?.toDoubleOrNull()
        }

        if (detectedAmount == null || detectedAmount <= 0.0) {
            val fallbackPattern = Pattern.compile(
                "(?:debited for|credited for|spent|paid|received)\\s+(?:for\\s+|by\\s+|of\\s+)?(?:rs\\.?\\s*)?([0-9]+(?:,[0-9]+)*(?:\\.[0-9]{1,2})?)",
                Pattern.CASE_INSENSITIVE
            )
            val fbMatcher = fallbackPattern.matcher(text)
            if (fbMatcher.find()) {
                val amtStr = fbMatcher.group(1)?.replace(",", "")
                detectedAmount = amtStr?.toDoubleOrNull()
            }
        }

        if (detectedAmount == null || detectedAmount <= 0.0) return null

        // 3. Extract Date (e.g. "on 23-10-2026")
        var isoDate = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val datePattern = Pattern.compile("on\\s+([0-9]{2}[-/][0-9]{2}[-/][0-9]{4})", Pattern.CASE_INSENSITIVE)
        val dateMatcher = datePattern.matcher(text)
        if (dateMatcher.find()) {
            val rawDate = dateMatcher.group(1)
            try {
                val parts = rawDate?.split(Pattern.compile("[-/]"))
                if (parts != null && parts.size == 3) {
                    val day = parts[0].padStart(2, '0')
                    val month = parts[1].padStart(2, '0')
                    val year = parts[2]
                    isoDate = "$year-$month-$day"
                }
            } catch (e: Exception) {
                // keep today fallback
            }
        }

        // 4. Extract Accounts
        var primaryAcct = ""
        val acctPattern = Pattern.compile("a/c no\\.?\\s*(?:[X*]+)?([0-9]{3,6})\\s+is", Pattern.CASE_INSENSITIVE)
        val acctMatcher = acctPattern.matcher(text)
        if (acctMatcher.find()) {
            primaryAcct = acctMatcher.group(1) ?: ""
        }

        var counterpartyAcct = ""
        val cpPattern = Pattern.compile("(?:credited to|debited from) a/c no\\.?\\s*(?:[X*]+)?([0-9]{3,6})", Pattern.CASE_INSENSITIVE)
        val cpMatcher = cpPattern.matcher(text)
        if (cpMatcher.find()) {
            counterpartyAcct = cpMatcher.group(1) ?: ""
        }

        // 5. Extract UPI Reference (e.g. "UPI Ref no 666218878764")
        var upiRef = ""
        val upiPattern = Pattern.compile("(?:UPI Ref no|Ref no|Ref|UTR)\\s+([0-9A-Za-z]+)", Pattern.CASE_INSENSITIVE)
        val upiMatcher = upiPattern.matcher(text)
        if (upiMatcher.find()) {
            upiRef = upiMatcher.group(1) ?: ""
        }

        // 6. Detect Bank
        var bank = "Bank"
        if (sender.contains("CUB", ignoreCase = true) || text.contains("CUBANK", ignoreCase = true) || text.endsWith("-CUB", ignoreCase = true)) {
            bank = "City Union Bank (CUB)"
        } else if (sender.contains("SBI", ignoreCase = true)) {
            bank = "SBI"
        } else if (sender.contains("HDFC", ignoreCase = true)) {
            bank = "HDFC Bank"
        } else if (sender.contains("ICICI", ignoreCase = true)) {
            bank = "ICICI Bank"
        }

        val note = if (counterpartyAcct.isNotBlank()) "UPI to A/c $counterpartyAcct" else if (upiRef.isNotBlank()) "UPI $upiRef" else "Bank Transaction"

        return ParsedTransaction(
            amount = detectedAmount,
            type = if (isDebit) "DEBIT" else "CREDIT",
            date = isoDate,
            account = primaryAcct,
            counterpartyAccount = counterpartyAcct,
            upiRef = upiRef,
            bank = bank,
            sender = sender,
            merchantOrNote = note,
            rawBody = text
        )
    }

    private fun showTransactionPromptNotification(context: Context, tx: ParsedTransaction) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notifId = (System.currentTimeMillis() % 100000).toInt()

        val isDebit = tx.type == "DEBIT"
        val title = if (isDebit) "Debited Rs. ${tx.amount} (${tx.bank})" else "Credited Rs. ${tx.amount} (${tx.bank})"
        val body = if (isDebit) {
            "Where did you spend this? Tap to Log, Split with friends, or Pass."
        } else {
            "Money received. Tap to account or reconcile."
        }

        // 1. Primary Action: Open Floating Dialog
        val openDialogIntent = Intent(context, TransactionPromptActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("tx_amount", tx.amount)
            putExtra("tx_type", tx.type)
            putExtra("tx_date", tx.date)
            putExtra("tx_account", tx.account)
            putExtra("tx_counterparty", tx.counterpartyAccount)
            putExtra("tx_upi_ref", tx.upiRef)
            putExtra("tx_bank", tx.bank)
            putExtra("tx_sender", tx.sender)
            putExtra("tx_raw", tx.rawBody)
        }
        val openDialogPendingIntent = PendingIntent.getActivity(
            context,
            notifId * 10 + 1,
            openDialogIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 2. Action: Rotated / Ignore (1-tap, inline broadcast, 0 records created!)
        val rotateIntent = Intent(context, FinanceActionReceiver::class.java).apply {
            action = FinanceActionReceiver.ACTION_MARK_ROTATED
            putExtra(FinanceActionReceiver.EXTRA_NOTIF_ID, notifId)
            putExtra(FinanceActionReceiver.EXTRA_BACKLOG_ID, tx.upiRef)
        }
        val rotatePendingIntent = PendingIntent.getBroadcast(
            context,
            notifId * 10 + 2,
            rotateIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 3. Action: Defer for Later
        val deferIntent = Intent(context, FinanceActionReceiver::class.java).apply {
            action = FinanceActionReceiver.ACTION_DEFER
            putExtra(FinanceActionReceiver.EXTRA_NOTIF_ID, notifId)
        }
        val deferPendingIntent = PendingIntent.getBroadcast(
            context,
            notifId * 10 + 3,
            deferIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, ShudkaraApp.CHANNEL_FINANCE_SMS)
            .setSmallIcon(android.R.drawable.ic_menu_agenda)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText("$body\n\nDate: ${tx.date} | ${tx.merchantOrNote}\n\nSMS: ${tx.rawBody}"))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(openDialogPendingIntent)
            .addAction(android.R.drawable.ic_input_add, "Log / Split", openDialogPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Rotated (Pass)", rotatePendingIntent)
            .addAction(android.R.drawable.ic_menu_recent_history, "Defer for Later", deferPendingIntent)

        notificationManager.notify(notifId, builder.build())
    }
}
