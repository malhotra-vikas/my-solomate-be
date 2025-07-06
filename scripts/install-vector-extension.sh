#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Vector Extension Installation Guide ===${NC}"
echo ""

echo "Choose your database provider:"
echo "1. Supabase"
echo "2. Local PostgreSQL (macOS)"
echo "3. Local PostgreSQL (Ubuntu/Debian)"
echo "4. Local PostgreSQL (CentOS/RHEL)"
echo "5. Neon"
echo "6. Vercel Postgres"
echo "7. Other cloud provider"
echo ""

read -p "Enter your choice (1-7): " choice

case $choice in
    1)
        echo -e "${GREEN}Supabase Setup:${NC}"
        echo "1. Go to your Supabase dashboard"
        echo "2. Navigate to SQL Editor"
        echo "3. Run this command:"
        echo -e "${YELLOW}CREATE EXTENSION IF NOT EXISTS vector;${NC}"
        echo ""
        echo "4. Then run the check script:"
        echo -e "${YELLOW}psql -h your-host -U postgres -d your-db -f scripts/check-and-install-vector.sql${NC}"
        ;;
    2)
        echo -e "${GREEN}macOS Local PostgreSQL Setup:${NC}"
        echo "1. Install pgvector using Homebrew:"
        echo -e "${YELLOW}brew install pgvector${NC}"
        echo ""
        echo "2. Or compile from source:"
        echo -e "${YELLOW}git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git${NC}"
        echo -e "${YELLOW}cd pgvector${NC}"
        echo -e "${YELLOW}make${NC}"
        echo -e "${YELLOW}make install${NC}"
        echo ""
        echo "3. Restart PostgreSQL:"
        echo -e "${YELLOW}brew services restart postgresql${NC}"
        echo ""
        echo "4. Connect to your database and enable the extension:"
        echo -e "${YELLOW}psql -d your_database${NC}"
        echo -e "${YELLOW}CREATE EXTENSION vector;${NC}"
        ;;
    3)
        echo -e "${GREEN}Ubuntu/Debian Local PostgreSQL Setup:${NC}"
        echo "1. Install build dependencies:"
        echo -e "${YELLOW}sudo apt update${NC}"
        echo -e "${YELLOW}sudo apt install build-essential postgresql-server-dev-all${NC}"
        echo ""
        echo "2. Clone and install pgvector:"
        echo -e "${YELLOW}git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git${NC}"
        echo -e "${YELLOW}cd pgvector${NC}"
        echo -e "${YELLOW}make${NC}"
        echo -e "${YELLOW}sudo make install${NC}"
        echo ""
        echo "3. Restart PostgreSQL:"
        echo -e "${YELLOW}sudo systemctl restart postgresql${NC}"
        echo ""
        echo "4. Connect to your database and enable the extension:"
        echo -e "${YELLOW}sudo -u postgres psql -d your_database${NC}"
        echo -e "${YELLOW}CREATE EXTENSION vector;${NC}"
        ;;
    4)
        echo -e "${GREEN}CentOS/RHEL Local PostgreSQL Setup:${NC}"
        echo "1. Install build dependencies:"
        echo -e "${YELLOW}sudo yum groupinstall 'Development Tools'${NC}"
        echo -e "${YELLOW}sudo yum install postgresql-devel${NC}"
        echo ""
        echo "2. Clone and install pgvector:"
        echo -e "${YELLOW}git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git${NC}"
        echo -e "${YELLOW}cd pgvector${NC}"
        echo -e "${YELLOW}make${NC}"
        echo -e "${YELLOW}sudo make install${NC}"
        echo ""
        echo "3. Restart PostgreSQL:"
        echo -e "${YELLOW}sudo systemctl restart postgresql${NC}"
        echo ""
        echo "4. Connect to your database and enable the extension:"
        echo -e "${YELLOW}sudo -u postgres psql -d your_database${NC}"
        echo -e "${YELLOW}CREATE EXTENSION vector;${NC}"
        ;;
    5)
        echo -e "${GREEN}Neon Setup:${NC}"
        echo "1. Connect to your Neon database"
        echo "2. Run this command in the SQL editor:"
        echo -e "${YELLOW}CREATE EXTENSION IF NOT EXISTS vector;${NC}"
        echo ""
        echo "Note: Neon supports pgvector out of the box!"
        ;;
    6)
        echo -e "${GREEN}Vercel Postgres Setup:${NC}"
        echo "1. Connect to your Vercel Postgres database"
        echo "2. Run this command:"
        echo -e "${YELLOW}CREATE EXTENSION IF NOT EXISTS vector;${NC}"
        echo ""
        echo "Note: Vercel Postgres has pgvector pre-installed!"
        ;;
    7)
        echo -e "${GREEN}Other Cloud Provider:${NC}"
        echo "Most cloud providers support pgvector. Try:"
        echo -e "${YELLOW}CREATE EXTENSION IF NOT EXISTS vector;${NC}"
        echo ""
        echo "If that fails, check your provider's documentation for pgvector support."
        ;;
    *)
        echo -e "${RED}Invalid choice. Please run the script again.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}After installation, run the verification script:${NC}"
echo -e "${YELLOW}psql -d your_database -f scripts/check-and-install-vector.sql${NC}"
echo ""
echo -e "${GREEN}Once verified, you can proceed with your main database migration!${NC}"
