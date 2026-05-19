/**
 * Grant admin access to a registered user by email.
 *
 * Usage (from project root):
 *   node scripts/admin_seed.js <email>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */
'use strict';

const path = require('path');
// Load root .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/admin_seed.js <email>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  // Find user by email in public.users table
  const { data, error } = await supabase
    .from('users')
    .update({ user_type: 'admin' })
    .eq('email', email.toLowerCase())
    .select('id, email, user_type');

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.error(`No user found with email: ${email}`);
    console.error('Make sure the user has signed up at /signup first.');
    process.exit(1);
  }

  console.log(`✅ Admin access granted to: ${data[0].email} (id: ${data[0].id})`);
}

run();
