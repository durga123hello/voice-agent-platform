# Task List - Organization Self-Service Flow & OTP Verification

- [x] Modify `schema.prisma` to extend `Tenant` model and define `OtpCode` table
- [x] Run Prisma migration to apply database changes
- [x] Create authentication endpoints router in `backend/src/routes/auth.ts`
- [x] Create JWT session validation middleware in `backend/src/middleware/sessionAuth.ts`
- [x] Register new auth router in `backend/src/app.ts`
- [x] Secure `apiKeys` router to optionally validate JWT session token for dashboard requests
- [x] Create frontend Signup page (`frontend/src/app/signup/page.tsx`)
- [x] Create frontend Login page (`frontend/src/app/login/page.tsx`)
- [x] Create frontend Dashboard page (`frontend/src/app/dashboard/page.tsx`)
- [x] Create E2E auth validation test script `backend/src/scratch/verify_auth.js`
- [x] Run verification tests and confirm outcomes
