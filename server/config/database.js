const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration:');
  console.error('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
  console.error('Please ensure your Supabase service role key is properly configured in the .env file');
  throw new Error('Missing Supabase configuration. Please check your environment variables.');
}

// Check for placeholder values
if (supabaseServiceKey.includes('your_supabase_service_role_key')) {
  console.error('SUPABASE_SERVICE_ROLE_KEY appears to be a placeholder value');
  console.error('Please replace it with your actual Supabase service role key from your Supabase dashboard');
  throw new Error('Invalid SUPABASE_SERVICE_ROLE_KEY. Please provide your actual service role key.');
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  console.error('Invalid SUPABASE_URL format:', supabaseUrl);
  console.error('Expected format: https://your-project-id.supabase.co');
  throw new Error('Invalid SUPABASE_URL format. Please provide a valid URL.');
}

// Create Supabase client with service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test database connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('Database connection test failed:', error.message);
      return false;
    }
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection test error:', error.message);
    return false;
  }
};

// Database query helper with error handling
const query = async (queryText, params = []) => {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: queryText,
      params: params
    });
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Transaction helper
const transaction = async (queries) => {
  try {
    const { data, error } = await supabase.rpc('execute_transaction', {
      queries: queries
    });
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Database transaction error:', error);
    throw error;
  }
};

module.exports = {
  supabase,
  query,
  transaction,
  testConnection
};