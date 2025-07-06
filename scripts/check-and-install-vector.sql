-- Check if vector extension is installed and working
DO $$
BEGIN
    -- Try to create the extension if it doesn't exist
    CREATE EXTENSION IF NOT EXISTS vector;
    
    -- Check if the extension is properly installed
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE NOTICE 'Vector extension is installed and ready!';
        
        -- Show the version
        RAISE NOTICE 'Vector extension version: %', (SELECT extversion FROM pg_extension WHERE extname = 'vector');
        
        -- Test basic vector functionality
        BEGIN
            -- Create a temporary table to test vector operations
            CREATE TEMP TABLE test_vectors (
                id SERIAL PRIMARY KEY,
                embedding vector(3)
            );
            
            -- Insert test data
            INSERT INTO test_vectors (embedding) VALUES 
                ('[1,2,3]'),
                ('[4,5,6]'),
                ('[7,8,9]');
            
            -- Test similarity search
            PERFORM embedding <-> '[1,2,3]' as distance 
            FROM test_vectors 
            ORDER BY distance 
            LIMIT 1;
            
            RAISE NOTICE 'Vector operations test: PASSED';
            
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Vector operations test failed: %', SQLERRM;
        END;
        
    ELSE
        RAISE EXCEPTION 'Vector extension is not installed. Please install pgvector first.';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error checking vector extension: %', SQLERRM;
END $$;

-- Show available vector operators
SELECT 
    'Available vector operators:' as info
UNION ALL
SELECT 
    '  <-> (L2 distance)' 
UNION ALL
SELECT 
    '  <#> (negative inner product)'
UNION ALL
SELECT 
    '  <=> (cosine distance)';
