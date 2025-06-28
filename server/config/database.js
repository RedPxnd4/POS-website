const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration. Please check your environment variables.');
}

// Create Supabase client with service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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
  transaction
};