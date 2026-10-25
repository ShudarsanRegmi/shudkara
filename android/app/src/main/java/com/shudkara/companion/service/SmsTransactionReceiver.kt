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
import com.shudkara.companion.ui.MainActivity
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

            // Valid financial transaction detected -> Trigger Actionable Prompt Notification
            showTransactionPromptNotification(context, parsedTx)
        }
    }

    data class ParsedTransaction(
        val amount: Double,
        val type: String, // "DEBIT" or "CREDIT"
        val merchantOrNote: String,
        val rawBody: String
    )

    private fun parseFinancialSms(sender: String, text: String): ParsedTransaction? {
        val lower = text.lowercase()

        // Verify financial context keywords
        val isFinancial = lower.contains("debited") || lower.contains("credited") ||
                lower.contains("spent") || lower.contains("received") ||
                lower.contains("a/c") || lower.contains("acct") ||
                lower.contains("transferred") || lower.contains("withdrawn") ||
                lower.contains("npr") || lower.contains("rs.") ||
                lower.contains("esewa") || lower.contains("khalti")

        if (!isFinancial) return null

        val isDebit = lower.contains("debit") || lower.contains("spent") ||
                lower.contains("withdrawn") || lower.contains("purchase") ||
                lower.contains("paid")

        val isCredit = lower.contains("credit") || lower.contains("received") ||
                lower.contains("deposited")

        if (!isDebit && !isCredit) return null

        // Amount Regex: matches "Rs. 1,500.00", "NPR 500", "Rs 250", etc.
        val amountPattern = Pattern.compile(
            "(?:rs\\.?|npr|inr|usd)\\s*([0-9]+(?:,[0-9]+)*(?:\\.[0-9]{1,2})?)",
            Pattern.CASE_INSENSITIVE
        )
        val matcher = amountPattern.matcher(text)

        var detectedAmount: Double? = null
        if (matcher.find()) {
            val amtStr = matcher.group(1)?.replace(",", "")
            detectedAmount = amtStr?.toDoubleOrNull()
        }

        // Secondary fallback: matches "debited for 500" or "spent 1200"
        if (detectedAmount == null || detectedAmount <= 0.0) {
            val fallbackPattern = Pattern.compile(
                "(?:debited|credited|spent|paid|received)\\s+(?:for\\s+|by\\s+|of\\s+)?([0-9]+(?:,[0-9]+)*(?:\\.[0-9]{1,2})?)",
                Pattern.CASE_INSENSITIVE
            )
            val fbMatcher = fallbackPattern.matcher(text)
            if (fbMatcher.find()) {
                val amtStr = fbMatcher.group(1)?.replace(",", "")
                detectedAmount = amtStr?.toDoubleOrNull()
            }
        }

        if (detectedAmount == null || detectedAmount <= 0.0) return null

        // Extract merchant / counterparty
        var merchant = "Bank Transaction"
        val atMatcher = Pattern.compile("(?:at|to|from|for)\\s+([A-Za-z0-9\\s\\.\\-_]{3,25})(?:\\son|\\sref|\\sbal|\\.|,|$)", Pattern.CASE_INSENSITIVE).matcher(text)
        if (atMatcher.find()) {
            merchant = atMatcher.group(1)?.trim() ?: merchant
        }

        return ParsedTransaction(
            amount = detectedAmount,
            type = if (isDebit) "DEBIT" else "CREDIT",
            merchantOrNote = merchant,
            rawBody = text
        )
    }

    private fun showTransactionPromptNotification(context: Context, tx: ParsedTransaction) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notifId = (System.currentTimeMillis() % 100000).toInt()

        val isDebit = tx.type == "DEBIT"
        val title = if (isDebit) "🚨 Debited Rs. ${tx.amount} (${tx.merchantOrNote})" else "💰 Credited Rs. ${tx.amount}"
        val body = if (isDebit) {
            "Where did you spend this? Tap to log as Expense, Lend, or Rotation."
        } else {
            "Why did you get this? Tap to log as Income, Borrow, or Lend Returned."
        }

        // Action 1: Log Expense / Income
        val expenseIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("extra_tab", 2) // Finance Tab
            putExtra("finance_mode", if (isDebit) "expense" else "income")
            putExtra("finance_amount", tx.amount)
            putExtra("finance_desc", tx.merchantOrNote)
            putExtra("finance_is_rotation", false)
        }
        val expensePendingIntent = PendingIntent.getActivity(
            context,
            notifId * 10 + 1,
            expenseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action 2: Lend / Borrow
        val lendIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("extra_tab", 2)
            putExtra("finance_mode", if (isDebit) "lend" else "borrow")
            putExtra("finance_amount", tx.amount)
            putExtra("finance_desc", tx.merchantOrNote)
            putExtra("finance_is_rotation", false)
        }
        val lendPendingIntent = PendingIntent.getActivity(
            context,
            notifId * 10 + 2,
            lendIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action 3: Rotation / Cash Exchange
        val rotationIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("extra_tab", 2)
            putExtra("finance_mode", "rotation")
            putExtra("finance_amount", tx.amount)
            putExtra("finance_desc", "Exchange / Pass-through: ${tx.merchantOrNote}")
            putExtra("finance_is_rotation", true)
        }
        val rotationPendingIntent = PendingIntent.getActivity(
            context,
            notifId * 10 + 3,
            rotationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action 4: Remind Later (1 Hour Deferral)
        val deferIntent = Intent(context, FinanceReminderReceiver::class.java).apply {
            putExtra("remind_amount", tx.amount)
            putExtra("remind_desc", tx.merchantOrNote)
            putExtra("remind_type", tx.type)
        }
        val deferPendingIntent = PendingIntent.getBroadcast(
            context,
            notifId * 10 + 4,
            deferIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, ShudkaraApp.CHANNEL_FINANCE_SMS)
            .setSmallIcon(android.R.drawable.ic_menu_agenda)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText("$body\n\nOriginal SMS: ${tx.rawBody.take(120)}..."))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(expensePendingIntent)
            .addAction(android.R.drawable.ic_input_add, if (isDebit) "Expense" else "Income", expensePendingIntent)
            .addAction(android.R.drawable.ic_menu_send, if (isDebit) "Lend" else "Borrow", lendPendingIntent)
            .addAction(android.R.drawable.ic_popup_sync, "Rotation", rotationPendingIntent)
            .addAction(android.R.drawable.ic_menu_recent_history, "Remind 1h", deferPendingIntent)

        notificationManager.notify(notifId, builder.build())
    }
}
