import dotenv from 'dotenv';
import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';

const requiredServerVars = [
  'DATABASE_URL',
  'SUPABASE_JWT_SECRET',
];

const requiredAppVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

function checkEnvFile(path: string, required: string[]): void {
  if (!existsSync(path)) {
    console.error(`MISSING: ${path} does not exist`);
    process.exitCode = 1;
    return;
  }

  const content = readFileSync(path, 'utf-8');
  const parsed = dotenv.parse(content);
  const missing = required.filter((key) => !parsed[key] || parsed[key].includes('[YOUR-') || parsed[key].includes('your-'));
  
  if (missing.length > 0) {
    console.error(`MISSING in ${path}: ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${path}`);
  }
}

checkEnvFile('server/.env', requiredServerVars);
checkEnvFile('app/.env', requiredAppVars);
