import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import cron from 'node-cron';
import { queueNotificationToSQS } from './notifications.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// The job that runs daily
async function sendDailyCheckins() {
  console.log('🚀 Starting daily check-in job...');

  // 1. Fetch all users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id')

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    return;
  }

  // 2. Loop through users
  for (const user of users) {
    console.log("🚀 ~ sendDailyCheckins ~ user:", user)
    // Fetch personas linked to this user
    const { data: mates, error: matesError } = await supabase
    .from('user_personas')
    .select('id, persona:personas(id, name), user: users(id, name, email)')
    .eq('user_id', user.id);
    
    if (matesError) {
        console.error(`❌ Error fetching personas for user ${user.id}:`, matesError);
        continue;
    }

    console.log("🚀 ~ sendDailyCheckins ~ mates:", mates)

    // 3. Insert daily check-in messages
    const messages = mates.map((m) => 
        queueNotificationToSQS({
            userId: m.user.id,
            title: `Hello, Good Morning from ${m.persona.name}`,
            body: `This is check in message`,
            type: "NEW_FEATURE_EVENT",
            data: {
                screen: "",
                persona_id: m.persona.id
            },
            sendAt: new Date().toISOString() // Send immediately
        })
    );
  }

  console.log('🎉 Daily check-in job completed!');
}

// 4. Schedule the cron job
cron.schedule(process.env.CHECKIN_TIME, () => {
  sendDailyCheckins();
});

// Run once immediately (optional)
// sendDailyCheckins();
