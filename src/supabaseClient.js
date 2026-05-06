import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://riyqtcssllupakjtoehj.supabase.co/'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpeXF0Y3NzbGx1cGFranRvZWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjQzOTMsImV4cCI6MjA5MzY0MDM5M30.5JOedCA0vljWtLktcNuBe7tZ72rFqmqY2SWt6uUg7ro'

export const supabase = createClient(supabaseUrl, supabaseKey)