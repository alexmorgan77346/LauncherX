/* =====================================================================
   FIREBASE CONFIG — Alex Launcher
   =====================================================================
   1. Go to https://console.firebase.google.com → create a project
      (free "Spark" plan is enough).
   2. Project settings (gear icon) → General → "Your apps" →
      Add app → Web ( </> ) → register the app → copy the config
      object it gives you and paste the values below.
   3. Left sidebar → Build → Authentication → Get started →
      Sign-in method tab → enable "Email/Password".
   4. Left sidebar → Build → Firestore Database → Create database
      → start in test mode (or production mode + the rules in
      README.md).
   5. Save this file. Reload the app — the login screen will now
      actually create accounts and sync data.

   Until you replace the placeholder values below, the app runs in
   local/offline demo mode automatically: no login required, nothing
   leaves the browser, and data resets on refresh — so it's still
   fully usable for trying things out.
   ===================================================================== */
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAL_1NUIIXDdjX2nnIt6MZF2xd6PLZub5Y",
  authDomain: "launcherx-2ca2d.firebaseapp.com",
  projectId: "launcherx-2ca2d",
  storageBucket: "launcherx-2ca2d.firebasestorage.app",
  messagingSenderId: "705170849439",
  appId: "1:705170849439:web:1908233d9b3cb5d1feacaa"
};