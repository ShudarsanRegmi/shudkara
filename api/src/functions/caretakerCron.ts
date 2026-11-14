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
  } catch (err: any) {
    context.error('Caretaker Cron Error:', err);
  }
}

// Schedules twice daily: 08:00 AM & 08:00 PM IST (02:30 and 14:30 UTC)
app.timer('caretakerCron', {
  schedule: '0 30 2,14 * * *',
  handler: caretakerCronHandler
});
