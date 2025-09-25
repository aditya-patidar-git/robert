# Database Migrations

This directory contains database migration scripts for the Robert application.

## Available Migrations

### update-user-roles.js

**Purpose**: Updates existing users with 'user' role to 'admin' role after removing the 'user' role from the application.

**When to run**: After deploying the code changes that remove the 'user' role from the User model.

**How to run**:
```bash
# From the backend directory
npm run migrate:user-roles

# Or directly
node migrations/update-user-roles.js
```

**What it does**:
1. Connects to the MongoDB database
2. Finds all users with 'user' role
3. Updates them to 'admin' role
4. Provides a summary of the changes
5. Shows current role distribution

**Safety**: This migration is safe to run multiple times. It will only affect users with 'user' role and will not modify users with 'owner' or 'admin' roles.

## Migration Best Practices

1. **Backup First**: Always backup your database before running migrations
2. **Test Environment**: Run migrations in a test environment first
3. **Monitor Logs**: Check the migration output for any errors
4. **Verify Results**: After running, verify the changes in your database

## Environment Variables

Make sure the following environment variables are set:
- `MONGODB_URI`: MongoDB connection string
- `NODE_ENV`: Environment (development, production, etc.)
