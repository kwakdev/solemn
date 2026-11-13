import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "project-id": { type: "string" },
    email: { type: "string" },
    revoke: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log("Usage: node scripts/firebase-admin.mjs --project-id PROJECT_ID --email ADMIN_EMAIL [--revoke]");
} else {
  try {
    if (!values["project-id"] || !values.email?.includes("@")) {
      throw new Error("Provide --project-id and --email for an existing Firebase Authentication user.");
    }
    const { applicationDefault, initializeApp } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    const app = initializeApp({
      credential: applicationDefault(),
      projectId: values["project-id"],
    });
    const auth = getAuth(app);
    const user = await auth.getUserByEmail(values.email.trim());
    const claims = { ...user.customClaims };
    if (values.revoke) delete claims.admin;
    else claims.admin = true;
    await auth.setCustomUserClaims(user.uid, claims);
    if (values.revoke) await auth.revokeRefreshTokens(user.uid);
    console.log(`Admin access ${values.revoke ? "removed" : "granted"} in ${values["project-id"]}. Sign out and sign in to refresh the session.`);
    if (values.revoke) console.log("Already-issued ID tokens can remain valid for up to one hour.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
