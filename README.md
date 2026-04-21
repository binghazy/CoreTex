# CoreTex

CoreTex is a healthcare technology system with two interfaces:
- Doctor Interface for diagnosis and safe prescribing.
- Patient Interface for schedule visibility, reminders, and symptom reporting.

This repository is scaffolded as a TypeScript monorepo with clear separation between UI, API, and medication safety logic.

## Project Layout

```text
apps/
  doctor-interface/      # Doctor-facing web UI
  patient-interface/     # Patient-facing web UI
coretex-api/             # Backend API
packages/
  shared-types/          # Shared domain types
  coretex-engine/        # Drug interaction + scheduling + alternatives logic
docs/
  architecture.md
```

## Core Features Implemented in Scaffold

- Doctor can enter diagnosis and prescribe 2 to 4 medications.
- API validates prescription size and runs medication safety analysis.
- CoreTex engine:
  - detects drug-drug interactions,
  - attempts schedule separation for compatible interactions,
  - suggests safer alternatives on conflicts.
- Patient interface includes schedule view and safety/adherence panel.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. (Optional but recommended) add a Gemini key for AI-backed endpoints:

Create a `.env` file in the repository root with:

```bash
GEMINI_API_KEY=your_key_here
```

Without this key, the API still starts, but `/api/v1/ask-ai` will return a fallback response.

3. Start API:

```bash
npm run dev:api
```

4. Start Doctor UI:

```bash
npm run dev:doctor
```

5. Start Patient UI:

```bash
npm run dev:patient
```

Or run everything (API + doctor + patient) with one command:

```bash
npm run dev:all
```

## Notes

- This is a production-oriented scaffold, not a complete clinical product.
- Real deployment should use a validated clinical knowledge source and full HIPAA-compliant controls.

## Deploy to Vercel (Doctor + Patient)

Both frontend apps are ready to deploy to Vercel as separate Vite projects.

Deploy order:
1. Deploy your backend API first (Vercel or any HTTPS host).
2. Deploy the doctor app.
3. Deploy the patient app.

### 1) Deploy API (`coretex-api`)

1. Create a new Vercel project from this repository.
2. Set **Root Directory** to `coretex-api`.
3. Set environment variable (optional, for AI endpoint):

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

4. Deploy and copy the API URL (example: `https://coretex-api.vercel.app`).

### 2) Deploy Doctor Interface

1. Create a new Vercel project from this repository.
2. Set **Root Directory** to `apps/doctor-interface`.
3. Set environment variable:

```bash
VITE_API_BASE=https://your-api-domain.example.com
```

4. Deploy.

### 3) Deploy Patient Interface

1. Create another Vercel project from the same repository.
2. Set **Root Directory** to `apps/patient-interface`.
3. Set environment variables:

```bash
VITE_API_BASE=https://your-api-domain.example.com
VITE_DOCTOR_PORTAL_URL=https://your-doctor-domain.vercel.app
```

4. Deploy.

Notes:
- Deploy each frontend from source, not by manually uploading `dist`.
- The patient landing page "Doctor Portal" button uses `VITE_DOCTOR_PORTAL_URL`.
- `coretex-api` must be reachable over HTTPS from both frontends.
- In Vercel runtime, API demo data is stored in `/tmp/coretex-patients.json` (ephemeral).
  For durable production data, replace file storage with a real database.

## Want to Run This Project? Here is a Step by Step :)

Use this when sharing the project with a friend.

1. Install required software:
- Node.js LTS (recommended: Node 20+)
- npm (comes with Node.js)

2. Copy the project folder to your friend's PC:
- Use Git clone OR send a zip of this folder.
- If sending a zip, do not include `node_modules` (it is OS-specific and large).

3. Open a terminal in the project root (the folder that contains `package.json`).

4. Install dependencies:

```bash
npm install
```

5. Start the backend API (Terminal 1):

```bash
npm run dev:api
```

6. Start the doctor web app (Terminal 2):

```bash
npm run dev:doctor
```

7. Start the patient web app (Terminal 3):

```bash
npm run dev:patient
```

Alternative (single terminal):

```bash
npm run dev:all
```

8. Open the apps in a browser:
- Doctor UI: `http://localhost:5173` or  `http://localhost:5178`

![Image](https://drive.google.com/uc?export=view&id=1Zi4yEgLL7HjJw6JOLHf9m5cGoM5MCUz_)

- Patient UI: `http://localhost:5174` or  `http://localhost:5175`

![Image](https://drive.google.com/uc?export=view&id=1FhwDjbCo367Fd6gz8H2w5TK2mTrfienv)

- API health check: `http://localhost:4000/health`

9. Doctor login credentials:
- Name: `Ahmed Mohamed`
- Password: `0000`

10. Verify end-to-end quickly:
- In Patient UI, sign up and submit symptoms.
- In Doctor UI, log in, select patient, assign condition and meds.
- Patient should see the generated plan.

## Troubleshooting

- `npm` or `node` not found:
  Install Node.js from the official site, then reopen terminal.

- Port already in use (`4000`, `5173`, or `5174`):
  Stop the conflicting process or change the port in scripts/config.

- Fresh install recommended when moving between PCs:

- Delete `node_modules` and `package-lock.json`, then run:

```bash
npm install
```
