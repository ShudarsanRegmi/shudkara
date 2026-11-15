import { app, InvocationContext, Timer } from '@azure/functions';
import { connectToMongo } from './db';
import { runCaretakerCycle } from './agent/caretakerCore';

export async function caretakerCronHandler(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log('Caretaker autonomous audit cycle initiated by Timer Trigger.');
  try {
    const db = await connectToMongo();
    const result = await runCaretakerCycle(db, 'cron');
    context.log(
      `Caretaker audit finished. Status: ${result.analysis.status}. Headline: "${result.analysis.headline}". Email dispatched: ${result.emailSent}.`
    );

    // Dispatch native system push notification to all registered PWA devices
    try {
      const { sendPushNotificationToAll } = await import('./notifications');
      const pushRes = await sendPushNotificationToAll({
        title: `🤖 Caretaker Audit (${result.analysis.status.replace('_', ' ').toUpperCase()})`,
        body: result.analysis.headline || 'Your autonomous briefing is ready.',
        url: '/?tab=caretaker',
        tag: 'caretaker-audit'
      });
      context.log(`Caretaker push notification sent to ${pushRes.sent} device(s).`);
    } catch (pushErr: any) {
      context.warn('Failed to dispatch Caretaker push notification:', pushErr?.message || pushErr);
    }
  } catch (err: any) {
    context.error('Caretaker Cron Error:', err);
  }
}

// Schedules twice daily: 08:00 AM & 08:00 PM IST (02:30 and 14:30 UTC)
app.timer('caretakerCron', {
  schedule: '0 30 2,14 * * *',
  handler: caretakerCronHandler
});
