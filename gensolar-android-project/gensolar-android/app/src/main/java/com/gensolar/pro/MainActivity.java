package com.gensolar.pro;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.os.Environment;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import org.json.JSONObject;
import org.json.JSONArray;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.view.Window;
import android.view.WindowManager;
import android.graphics.Color;
import android.os.Build;
import android.widget.Toast;
import android.util.Log;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.PhoneAuthCredential;
import com.google.firebase.auth.PhoneAuthOptions;
import com.google.firebase.auth.PhoneAuthProvider;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public class MainActivity extends Activity {
    private WebView webView;
    private WebView dprPrintWebView;
    private FirebaseAuth auth;
    private FirebaseFirestore db;
    private String verificationId;
    private PhoneAuthProvider.ForceResendingToken resendToken;
    private String pendingPhone;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER = 1001;
    private static final String UPDATE_API = "https://api.github.com/repos/VEERA0007/Roka-One/releases/latest";
    private static final String UPDATE_PREFS = "gensolar_updates";
    private static final String KEY_DOWNLOAD_ID = "pending_download_id";
    private BroadcastReceiver updateDownloadReceiver;
    private boolean updateDialogVisible = false;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        installCrashRecorder();
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(18, 63, 48));
        window.setNavigationBarColor(Color.rgb(18, 63, 48));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams params = window.getAttributes();
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(params);
        }
        try {
            FirebaseApp.initializeApp(this);
            auth = FirebaseAuth.getInstance();
            db = FirebaseFirestore.getInstance();
        } catch (Exception e) { Log.e("GenSolar", "Firebase initialization failed", e); }
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) { filePathCallback.onReceiveValue(null); }
                filePathCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER);
                } catch (Exception e) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "Could not open the photo picker", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });
        webView.setBackgroundColor(Color.WHITE);
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) { reportLastCrash(); restoreSession(); }
        });
        webView.addJavascriptInterface(new PrintBridge(), "GenSolarNative");
        webView.addJavascriptInterface(new UpdateBridge(), "GenSolarUpdates");
        webView.addJavascriptInterface(new AuthBridge(), "GenSolarAuth");
        webView.addJavascriptInterface(new LeadBridge(), "GenSolarLeads");
        webView.addJavascriptInterface(new AdminBridge(), "GenSolarAdmin");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
        registerUpdateDownloadReceiver();
    }


    private void registerUpdateDownloadReceiver() {
        updateDownloadReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                long expected = getSharedPreferences(UPDATE_PREFS, MODE_PRIVATE).getLong(KEY_DOWNLOAD_ID, -2L);
                if (id == expected) openDownloadedUpdate(id);
            }
        };
        ContextCompat.registerReceiver(this, updateDownloadReceiver,
            new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    private void checkForAppUpdate() { checkForAppUpdate(false); }

    private void checkForAppUpdate(boolean manual) {
        new Thread(() -> {
            java.net.HttpURLConnection connection = null;
            try {
                connection = (java.net.HttpURLConnection) new java.net.URL(UPDATE_API).openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setRequestProperty("Accept", "application/vnd.github+json");
                connection.setRequestProperty("User-Agent", "GenSolar-Pro-Android");
                if (connection.getResponseCode() != 200) { if (manual) runOnUiThread(() -> Toast.makeText(this, "Could not check for updates. Check your internet connection.", Toast.LENGTH_LONG).show()); return; }
                java.io.InputStream input = connection.getInputStream();
                java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                input.close();
                JSONObject release = new JSONObject(output.toString("UTF-8"));
                JSONArray assets = release.optJSONArray("assets");
                if (assets == null) return;
                String apkUrl = null;
                String latestVersion = null;
                for (int i = 0; i < assets.length(); i++) {
                    JSONObject asset = assets.optJSONObject(i);
                    if (asset == null) continue;
                    String name = asset.optString("name", "");
                    java.util.regex.Matcher matcher = java.util.regex.Pattern
                        .compile("GenSolar-Pro-v([0-9]+(?:\\.[0-9]+){1,3})\\.apk", java.util.regex.Pattern.CASE_INSENSITIVE)
                        .matcher(name);
                    if (matcher.matches()) {
                        latestVersion = matcher.group(1);
                        apkUrl = asset.optString("browser_download_url", null);
                        break;
                    }
                }
                if (apkUrl == null || latestVersion == null || !apkUrl.startsWith("https://github.com/")) { if (manual) runOnUiThread(() -> Toast.makeText(this, "Latest release APK was not found.", Toast.LENGTH_LONG).show()); return; }
                android.content.pm.PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                String installedVersion = info.versionName == null ? "0" : info.versionName;
                if (compareVersions(latestVersion, installedVersion) <= 0) { if (manual) runOnUiThread(() -> Toast.makeText(this, "You are using the latest version " + installedVersion + ".", Toast.LENGTH_LONG).show()); return; }
                String finalUrl = apkUrl;
                String finalVersion = latestVersion;
                String notes = release.optString("body", "A newer version of GenSolar Pro is available.");
                runOnUiThread(() -> showUpdateAvailable(finalVersion, finalUrl, notes, manual));
            } catch (Exception e) {
                Log.w("GenSolar", "Update check failed", e);
                if (manual) runOnUiThread(() -> Toast.makeText(this, "Update check failed. Please try again.", Toast.LENGTH_LONG).show());
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "GenSolarUpdateCheck").start();
    }

    private int compareVersions(String first, String second) {
        String[] a = first.split("\\.");
        String[] b = second.split("\\.");
        int length = Math.max(a.length, b.length);
        for (int i = 0; i < length; i++) {
            int x = i < a.length ? parseVersionPart(a[i]) : 0;
            int y = i < b.length ? parseVersionPart(b[i]) : 0;
            if (x != y) return x > y ? 1 : -1;
        }
        return 0;
    }

    private int parseVersionPart(String value) {
        try { return Integer.parseInt(value); } catch (Exception ignored) { return 0; }
    }

    private void showUpdateAvailable(String version, String apkUrl, String notes, boolean manual) {
        if (isFinishing() || updateDialogVisible) return;
        android.content.SharedPreferences prefs = getSharedPreferences(UPDATE_PREFS, MODE_PRIVATE);
        if (!manual && version.equals(prefs.getString("dismissed_version", ""))) return;
        updateDialogVisible = true;
        new AlertDialog.Builder(this)
            .setTitle("GenSolar Pro update available")
            .setMessage("Version " + version + " is ready to install.\n\nAndroid will ask you to confirm installation.\n\nRelease notes: " +
                (notes.length() > 500 ? notes.substring(0, 500) : notes))
            .setCancelable(true)
            .setPositiveButton("Update now", (dialog, which) -> downloadUpdate(version, apkUrl))
            .setNegativeButton("Later", (dialog, which) -> prefs.edit().putString("dismissed_version", version).apply())
            .setOnDismissListener(dialog -> updateDialogVisible = false)
            .show();
    }

    private void downloadUpdate(String version, String apkUrl) {
        try {
            if (!apkUrl.startsWith("https://github.com/")) {
                Toast.makeText(this, "Update source could not be verified.", Toast.LENGTH_LONG).show();
                return;
            }
            DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (manager == null) throw new IllegalStateException("Download service unavailable");
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(apkUrl));
            request.setTitle("GenSolar Pro " + version);
            request.setDescription("Downloading the latest GenSolar Pro update");
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "GenSolar-Pro-update.apk");
            long id = manager.enqueue(request);
            getSharedPreferences(UPDATE_PREFS, MODE_PRIVATE).edit().putLong(KEY_DOWNLOAD_ID, id).apply();
            Toast.makeText(this, "Update downloading. You will be asked to install it when ready.", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Log.e("GenSolar", "Could not download update", e);
            Toast.makeText(this, "Could not download the update. Please try again.", Toast.LENGTH_LONG).show();
        }
    }

    private void openDownloadedUpdate(long downloadId) {
        try {
            DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (manager == null) return;
            Uri apkUri = manager.getUriForDownloadedFile(downloadId);
            if (apkUri == null) {
                Toast.makeText(this, "Update download failed. Please try again.", Toast.LENGTH_LONG).show();
                return;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
                getSharedPreferences(UPDATE_PREFS, MODE_PRIVATE).edit().putLong(KEY_DOWNLOAD_ID, downloadId).apply();
                new AlertDialog.Builder(this)
                    .setTitle("Allow GenSolar Pro installation")
                    .setMessage("Enable Allow from this source to install the update you requested.")
                    .setPositiveButton("Open settings", (d, w) -> startActivity(new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))))
                    .setNegativeButton("Cancel", null).show();
                return;
            }
            getSharedPreferences(UPDATE_PREFS, MODE_PRIVATE).edit().remove(KEY_DOWNLOAD_ID).apply();
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(apkUri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(install);
        } catch (Exception e) {
            Log.e("GenSolar", "Could not open APK installer", e);
            Toast.makeText(this, "Could not open Android installer. Check Downloads for the APK.", Toast.LENGTH_LONG).show();
        }
    }

    @Override protected void onResume() {
        super.onResume();
        android.content.SharedPreferences prefs = getSharedPreferences(UPDATE_PREFS, MODE_PRIVATE);
        long pendingId = prefs.getLong(KEY_DOWNLOAD_ID, -1L);
        if (pendingId > 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && getPackageManager().canRequestPackageInstalls()) {
            openDownloadedUpdate(pendingId);
        } else {
            checkForAppUpdate();
        }
    }

    @Override protected void onDestroy() {
        if (updateDownloadReceiver != null) {
            try { unregisterReceiver(updateDownloadReceiver); } catch (Exception ignored) { }
            updateDownloadReceiver = null;
        }
        if (dprPrintWebView != null) { try { dprPrintWebView.destroy(); } catch (Exception ignored) { } dprPrintWebView = null; }
        super.onDestroy();
    }

    private void installCrashRecorder() {
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                java.io.StringWriter sw = new java.io.StringWriter();
                error.printStackTrace(new java.io.PrintWriter(sw));
                String trace = sw.toString();
                if (trace.length() > 1800) trace = trace.substring(0, 1800);
                getSharedPreferences("gensolar", MODE_PRIVATE).edit().putString("last_crash", trace).commit();
            } catch (Throwable ignored) { }
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }
    private void restoreSession() {
        try {
            if (auth != null && auth.getCurrentUser() != null) { ensureCustomerProfile(auth.getCurrentUser()); }
        } catch (Throwable ignored) { }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }
    private void reportLastCrash() {
        try {
            String crash = getSharedPreferences("gensolar", MODE_PRIVATE).getString("last_crash", null);
            if (crash == null) return;
            getSharedPreferences("gensolar", MODE_PRIVATE).edit().remove("last_crash").apply();
            js("window.onGenSolarLastCrash && window.onGenSolarLastCrash(" + JSONObject.quote(crash) + ")");
        } catch (Throwable ignored) { }
    }

    private void js(String script) {
        runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript(script, null); });
    }
    private void jsError(String message) {
        String safe = message == null ? "Authentication failed. Please try again." : message;
        safe = safe.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ");
        js("window.onGenSolarAuthError && window.onGenSolarAuthError('" + safe + "')");
    }

    private class AuthBridge {
        @JavascriptInterface public void sendOtp(String tenDigitPhone) {
            runOnUiThread(() -> { try {
                if (auth == null) { jsError("Firebase is not initialized. Check google-services.json and rebuild."); return; }
                String digits = tenDigitPhone == null ? "" : tenDigitPhone.replaceAll("\\D", "");
                if (!digits.matches("[6-9][0-9]{9}")) { jsError("Enter a valid 10-digit Indian mobile number."); return; }
                pendingPhone = digits;
                PhoneAuthOptions options = PhoneAuthOptions.newBuilder(auth)
                    .setPhoneNumber("+91" + digits)
                    .setTimeout(60L, TimeUnit.SECONDS)
                    .setActivity(MainActivity.this)
                    .setCallbacks(new PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                        @Override public void onVerificationCompleted(PhoneAuthCredential credential) { signIn(credential); }
                        @Override public void onVerificationFailed(com.google.firebase.FirebaseException e) {
                            Log.e("GenSolar", "Phone verification failed", e);
                            jsError(e.getMessage() == null ? "Could not send OTP. Check Firebase phone auth settings." : e.getMessage());
                        }
                        @Override public void onCodeSent(String id, PhoneAuthProvider.ForceResendingToken token) {
                            verificationId = id; resendToken = token;
                            js("window.onGenSolarOtpSent && window.onGenSolarOtpSent()");
                        }
                    }).build();
                PhoneAuthProvider.verifyPhoneNumber(options);
            } catch (Throwable t) { Log.e("GenSolar", "sendOtp failed", t); jsError("Could not start OTP: " + t); } });
        }
        @JavascriptInterface public void verifyOtp(String code) {
            runOnUiThread(() -> {
                if (auth == null || verificationId == null) { jsError("Request an OTP first."); return; }
                String otp = code == null ? "" : code.trim();
                if (!otp.matches("[0-9]{6}")) { jsError("Enter the 6-digit OTP."); return; }
                signIn(PhoneAuthProvider.getCredential(verificationId, otp));
            });
        }
        @JavascriptInterface public void signOut() { if (auth != null) auth.signOut(); }
        @JavascriptInterface public void saveProfile(String name, String email) {
            FirebaseUser user = auth == null ? null : auth.getCurrentUser();
            if (user == null || db == null) return;
            Map<String,Object> data = new HashMap<>();
            data.put("displayName", name == null ? "" : (name.length() > 80 ? name.substring(0, 80) : name));
            data.put("email", email == null ? "" : (email.length() > 120 ? email.substring(0, 120) : email));
            db.collection("users").document(user.getUid()).set(data, SetOptions.merge())
                .addOnFailureListener(e -> Log.e("GenSolar", "Could not save profile", e));
        }
        @JavascriptInterface public void saveDesignation(String key) {
            FirebaseUser user = auth == null ? null : auth.getCurrentUser();
            if (user == null || db == null || key == null) return;
            if (!key.matches("admin|sales_head|regional_manager|sales_manager|sales_rep|channel_partner|customer")) return;
            Map<String,Object> data = new HashMap<>();
            data.put("requestedRole", key);
            data.put("requestedAt", System.currentTimeMillis());
            db.collection("users").document(user.getUid()).set(data, SetOptions.merge())
                .addOnFailureListener(e -> Log.e("GenSolar", "Could not save requested role", e));
        }
    }

    private void signIn(PhoneAuthCredential credential) {
        if (auth == null) { jsError("Firebase authentication is unavailable."); return; }
        auth.signInWithCredential(credential).addOnCompleteListener(this, task -> {
            if (!task.isSuccessful() || task.getResult() == null || task.getResult().getUser() == null) {
                jsError(task.getException() == null ? "OTP verification failed." : task.getException().getMessage()); return;
            }
            FirebaseUser user = task.getResult().getUser();
            ensureCustomerProfile(user);
        });
    }

    private void authSuccess(FirebaseUser user, String role, String requested, String name, String email) {
        String phone = user.getPhoneNumber() == null ? "" : user.getPhoneNumber();
        js("window.onGenSolarAuthSuccess && window.onGenSolarAuthSuccess(" + JSONObject.quote(user.getUid()) + ","
            + JSONObject.quote(role) + "," + JSONObject.quote(phone) + "," + JSONObject.quote(requested == null ? "" : requested) + ","
            + JSONObject.quote(name == null ? "" : name) + "," + JSONObject.quote(email == null ? "" : email) + ")");
    }

    private void ensureCustomerProfile(FirebaseUser user) {
        if (db == null) { jsError("Firestore is not initialized."); return; }
        DocumentReference ref = db.collection("users").document(user.getUid());
        ref.get().addOnSuccessListener(doc -> {
            String role = doc.exists() ? doc.getString("role") : null;
            if (role == null || role.isEmpty()) role = "customer";
            String phone = user.getPhoneNumber();
            if ("customer".equals(role) && phone != null && !phone.isEmpty()) {
                db.collection("invites").document(phone).get().addOnSuccessListener(inv -> {
                    if (inv.exists() && inv.getString("role") != null) applyInvite(user, doc, ref, inv);
                    else proceedProfile(user, doc, ref);
                }).addOnFailureListener(e -> proceedProfile(user, doc, ref));
            } else proceedProfile(user, doc, ref);
        }).addOnFailureListener(e -> jsError("Could not load account role. Check Firestore rules: " + e.getMessage()));
    }

    private void applyInvite(FirebaseUser user, com.google.firebase.firestore.DocumentSnapshot doc, DocumentReference ref, com.google.firebase.firestore.DocumentSnapshot inv) {
        String role = inv.getString("role");
        String designation = inv.getString("designation");
        String name = inv.getString("name");
        Map<String,Object> data = new HashMap<>();
        data.put("uid", user.getUid());
        data.put("phone", user.getPhoneNumber() == null ? "" : user.getPhoneNumber());
        data.put("role", role);
        data.put("organizationId", inv.getString("organizationId") == null ? "" : inv.getString("organizationId"));
        if (designation != null) data.put("requestedRole", designation);
        String existingName = doc.exists() ? doc.getString("displayName") : null;
        final String shownName = (existingName != null && !existingName.isEmpty()) ? existingName : (name == null ? "" : name);
        if (!shownName.isEmpty()) data.put("displayName", shownName);
        if (!doc.exists()) data.put("createdAt", System.currentTimeMillis());
        data.put("approvedAt", System.currentTimeMillis());
        ref.set(data, SetOptions.merge()).addOnSuccessListener(v -> {
            inv.getReference().delete();
            authSuccess(user, role, designation, shownName, doc.exists() ? doc.getString("email") : "");
        }).addOnFailureListener(e -> proceedProfile(user, doc, ref));
    }

    private void proceedProfile(FirebaseUser user, com.google.firebase.firestore.DocumentSnapshot doc, DocumentReference ref) {
        if (doc.exists()) {
            String role = doc.getString("role");
            if (role == null || role.isEmpty()) role = "customer";
            authSuccess(user, role, doc.getString("requestedRole"), doc.getString("displayName"), doc.getString("email"));
        } else {
            Map<String,Object> profile = new HashMap<>();
            profile.put("uid", user.getUid());
            profile.put("phone", user.getPhoneNumber() == null ? "" : user.getPhoneNumber());
            profile.put("role", "customer");
            profile.put("createdAt", System.currentTimeMillis());
            ref.set(profile, SetOptions.merge()).addOnSuccessListener(v -> authSuccess(user, "customer", "", "", ""))
                .addOnFailureListener(e -> jsError("Signed in, but profile setup failed: " + e.getMessage()));
        }
    }

    private class AdminBridge {
        private void adminError(String m) { js("window.onGenSolarAdminError && window.onGenSolarAdminError(" + JSONObject.quote(m) + ")"); }


        private String mapRole(String designation) {
            if ("sales_rep".equals(designation) || "channel_partner".equals(designation)) return "rep";
            if ("sales_head".equals(designation) || "regional_manager".equals(designation) || "sales_manager".equals(designation)) return "manager";
            return null;
        }

        @JavascriptInterface public void addMember(String name, String phone10, String designation) {
            FirebaseUser me = auth == null ? null : auth.getCurrentUser();
            if (me == null || db == null) { adminError("Sign in first."); return; }
            String role = mapRole(designation);
            String digits = phone10 == null ? "" : phone10.replaceAll("\\D", "");
            if (role == null || !digits.matches("[6-9][0-9]{9}") || name == null || name.trim().isEmpty()) { adminError("Check the name, mobile number and role."); return; }
            final String phone = "+91" + digits;
            final String cleanName = name.trim().length() > 80 ? name.trim().substring(0, 80) : name.trim();
            db.collection("users").document(me.getUid()).get().addOnSuccessListener(profile -> {
                String org = profile.getString("organizationId");
                if (!"admin".equals(profile.getString("role")) || org == null || org.isEmpty()) { adminError("Only an admin with an organizationId can add members."); return; }
                Map<String,Object> data = new HashMap<>();
                data.put("name", cleanName); data.put("phone", phone); data.put("designation", designation);
                data.put("role", role); data.put("organizationId", org);
                data.put("createdBy", me.getUid()); data.put("createdAt", System.currentTimeMillis());
                db.collection("invites").document(phone).set(data)
                    .addOnSuccessListener(v -> js("window.onGenSolarMemberChanged && window.onGenSolarMemberChanged(" + JSONObject.quote(cleanName + " added. They get access when they sign in with " + phone + ".") + ")"))
                    .addOnFailureListener(e -> adminError("Could not add member. Publish the latest firestore.rules. " + e.getMessage()));
            }).addOnFailureListener(e -> adminError("Could not load your profile."));
        }

        @JavascriptInterface public void removeInvite(String phone) {
            if (db == null || phone == null || !phone.matches("\\+91[6-9][0-9]{9}")) return;
            db.collection("invites").document(phone).delete()
                .addOnSuccessListener(v -> js("window.onGenSolarMemberChanged && window.onGenSolarMemberChanged('Removed')"))
                .addOnFailureListener(e -> adminError("Could not remove. " + e.getMessage()));
        }

        @JavascriptInterface public void loadMembers() {
            FirebaseUser me = auth == null ? null : auth.getCurrentUser();
            if (me == null || db == null) return;
            db.collection("users").document(me.getUid()).get().addOnSuccessListener(profile -> {
                String org = profile.getString("organizationId");
                if (!"admin".equals(profile.getString("role")) || org == null || org.isEmpty()) return;
                db.collection("users").whereEqualTo("organizationId", org).get().addOnSuccessListener(us -> {
                    JSONArray members = new JSONArray();
                    for (com.google.firebase.firestore.DocumentSnapshot d : us.getDocuments()) {
                        try {
                            JSONObject o = new JSONObject();
                            o.put("uid", d.getId());
                            o.put("name", d.getString("displayName") == null ? "" : d.getString("displayName"));
                            o.put("phone", d.getString("phone") == null ? "" : d.getString("phone"));
                            o.put("role", d.getString("role") == null ? "customer" : d.getString("role"));
                            o.put("requestedRole", d.getString("requestedRole") == null ? "" : d.getString("requestedRole"));
                            members.put(o);
                        } catch (Exception ignored) { }
                    }
                    db.collection("invites").whereEqualTo("organizationId", org).get().addOnSuccessListener(is -> {
                        JSONArray invites = new JSONArray();
                        for (com.google.firebase.firestore.DocumentSnapshot d : is.getDocuments()) {
                            try {
                                JSONObject o = new JSONObject();
                                o.put("name", d.getString("name") == null ? "" : d.getString("name"));
                                o.put("phone", d.getId());
                                o.put("designation", d.getString("designation") == null ? "" : d.getString("designation"));
                                invites.put(o);
                            } catch (Exception ignored) { }
                        }
                        js("window.onGenSolarMembers && window.onGenSolarMembers(JSON.parse(" + JSONObject.quote(members.toString()) + "), JSON.parse(" + JSONObject.quote(invites.toString()) + "))");
                    }).addOnFailureListener(e -> adminError("Could not load invited members. Publish the latest firestore.rules."));
                }).addOnFailureListener(e -> adminError("Could not load members. Publish the latest firestore.rules."));
            });
        }

        @JavascriptInterface public void loadRequests() {
            FirebaseUser me = auth == null ? null : auth.getCurrentUser();
            if (me == null || db == null) { adminError("Sign in first."); return; }
            db.collection("users").document(me.getUid()).get().addOnSuccessListener(profile -> {
                String role = profile.getString("role");
                String org = profile.getString("organizationId");
                if (!"admin".equals(role)) { adminError("Only admins can use the Team page."); return; }
                if (org == null || org.isEmpty()) { adminError("Add an organizationId to your own account in Firebase first."); return; }
                java.util.List<String> wanted = java.util.Arrays.asList("admin","sales_head","regional_manager","sales_manager","sales_rep","channel_partner");
                db.collection("users").whereIn("requestedRole", wanted).get().addOnSuccessListener(snap -> {
                    JSONArray rows = new JSONArray();
                    for (com.google.firebase.firestore.DocumentSnapshot d : snap.getDocuments()) {
                        try {
                            JSONObject o = new JSONObject();
                            o.put("uid", d.getId());
                            o.put("phone", d.getString("phone") == null ? "" : d.getString("phone"));
                            o.put("role", d.getString("role") == null ? "customer" : d.getString("role"));
                            o.put("requestedRole", d.getString("requestedRole"));
                            o.put("name", d.getString("displayName") == null ? "" : d.getString("displayName"));
                            Long at = d.getLong("requestedAt");
                            o.put("requestedAt", at == null ? 0 : at);
                            String o2 = d.getString("organizationId");
                            o.put("organizationId", o2 == null ? "" : o2);
                            rows.put(o);
                        } catch (Exception ignored) { }
                    }
                    js("window.onGenSolarRequests && window.onGenSolarRequests(JSON.parse(" + JSONObject.quote(rows.toString()) + "), " + JSONObject.quote(role) + ")");
                }).addOnFailureListener(e -> adminError("Could not load requests. Publish the latest firestore.rules. " + e.getMessage()));
            }).addOnFailureListener(e -> adminError("Could not load your profile."));
        }

        /** approve=true sets the role and organization; approve=false resets the request to customer. */
        @JavascriptInterface public void decide(String uid, String newRole, boolean approve) {
            FirebaseUser me = auth == null ? null : auth.getCurrentUser();
            if (me == null || db == null || uid == null || uid.isEmpty()) { adminError("Sign in first."); return; }
            if (approve && !("rep".equals(newRole) || "manager".equals(newRole))) { adminError("That role must be assigned in the Firebase console."); return; }
            db.collection("users").document(me.getUid()).get().addOnSuccessListener(profile -> {
                String org = profile.getString("organizationId");
                if (org == null || org.isEmpty()) { adminError("Your account needs an organizationId."); return; }
                Map<String,Object> data = new HashMap<>();
                if (approve) {
                    data.put("role", newRole);
                    data.put("organizationId", org);
                    data.put("approvedBy", me.getUid());
                    data.put("approvedAt", System.currentTimeMillis());
                } else {
                    data.put("requestedRole", "customer");
                }
                db.collection("users").document(uid).update(data)
                    .addOnSuccessListener(v -> js("window.onGenSolarAdminDone && window.onGenSolarAdminDone(" + JSONObject.quote(uid) + "," + approve + ")"))
                    .addOnFailureListener(e -> adminError("Could not save. Only an admin can grant manager access. " + e.getMessage()));
            }).addOnFailureListener(e -> adminError("Could not load your profile."));
        }
    }

    private class LeadBridge {
        @JavascriptInterface public void loadLeads() {
            FirebaseUser user = auth == null ? null : auth.getCurrentUser();
            if (user == null || db == null) { leadError("Sign in before loading cloud leads."); return; }
            db.collection("users").document(user.getUid()).get().addOnSuccessListener(profile -> {
                String role = profile.getString("role");
                if (role == null) role = "customer";
                com.google.firebase.firestore.Query query = db.collection("leads");
                if ("manager".equals(role) || "admin".equals(role)) {
                    String org = profile.getString("organizationId");
                    if (org == null || org.isEmpty()) { leadError("Your manager account needs an organization ID."); return; }
                    query = query.whereEqualTo("organizationId", org);
                } else if ("rep".equals(role) || "representative".equals(role)) {
                    query = query.whereEqualTo("assignedRepUid", user.getUid());
                } else {
                    query = query.whereEqualTo("ownerUid", user.getUid());
                }
                query.get().addOnSuccessListener(snapshot -> {
                    JSONArray rows = new JSONArray();
                    for (com.google.firebase.firestore.DocumentSnapshot doc : snapshot.getDocuments()) {
                        try {
                            JSONObject row = new JSONObject();
                            Map<String,Object> values = doc.getData();
                            if (values != null) for (Map.Entry<String,Object> entry : values.entrySet()) row.put(entry.getKey(), jsonValue(entry.getValue()));
                            row.put("id", doc.getId());
                            rows.put(row);
                        } catch (Exception ignored) { }
                    }
                    js("window.onGenSolarCloudLeads && window.onGenSolarCloudLeads(JSON.parse(" + JSONObject.quote(rows.toString()) + "))");
                }).addOnFailureListener(e -> leadError("Cloud leads could not load. Check the Firestore rules and internet connection."));
            }).addOnFailureListener(e -> leadError("Your account profile could not be loaded."));
        }

        @JavascriptInterface public void saveLead(String json) {
            FirebaseUser user = auth == null ? null : auth.getCurrentUser();
            if (user == null || db == null) { leadError("Sign in before saving cloud leads."); return; }
            final JSONObject source;
            try { source = new JSONObject(json == null ? "{}" : json); }
            catch (Exception e) { leadError("This lead could not be read."); return; }
            db.collection("users").document(user.getUid()).get().addOnSuccessListener(profile -> {
                String role = profile.getString("role");
                if (role == null) role = "customer";
                String org = profile.getString("organizationId");
                if (("manager".equals(role) || "admin".equals(role) || "rep".equals(role) || "representative".equals(role))
                        && (org == null || org.isEmpty())) {
                    leadError("Your company account needs an organization ID before cloud leads can sync."); return;
                }
                String id = source.optString("id", "");
                if (id.isEmpty()) id = "L" + System.currentTimeMillis() + Long.toString((long)(Math.random()*100000), 36);
                Map<String,Object> data = new HashMap<>();
                copyLeadField(source, data, "name"); copyLeadField(source, data, "phone");
                copyLeadField(source, data, "seg"); copyLeadField(source, data, "state");
                copyLeadField(source, data, "city"); copyLeadField(source, data, "kw");
                copyLeadField(source, data, "net"); copyLeadField(source, data, "payback");
                copyLeadField(source, data, "source"); copyLeadField(source, data, "quote");
                copyLeadField(source, data, "status"); copyLeadField(source, data, "ts");
                copyLeadField(source, data, "notes");
                copyLeadField(source, data, "dealer"); copyLeadField(source, data, "nextFollow"); copyLeadField(source, data, "owner");
                data.put("id", id);
                data.put("updatedAt", System.currentTimeMillis());
                if (!source.has("createdAt")) data.put("createdAt", System.currentTimeMillis());
                if ("manager".equals(role) || "admin".equals(role)) {
                    data.put("organizationId", org);
                    data.put("ownerUid", source.optString("ownerUid", user.getUid()));
                    if (source.has("assignedRepUid")) data.put("assignedRepUid", source.optString("assignedRepUid"));
                } else if ("rep".equals(role) || "representative".equals(role)) {
                    data.put("organizationId", org);
                    data.put("assignedRepUid", user.getUid());
                    data.put("ownerUid", source.optString("ownerUid", user.getUid()));
                } else {
                    data.put("ownerUid", user.getUid());
                    data.put("customerUid", user.getUid());
                    data.put("organizationId", "");
                    data.put("assignedRepUid", "");
                }
                final String finalId = id;
                db.collection("leads").document(id).set(data, SetOptions.merge())
                    .addOnSuccessListener(v -> js("window.onGenSolarCloudLeadSaved && window.onGenSolarCloudLeadSaved(" + JSONObject.quote(finalId) + ")"))
                    .addOnFailureListener(e -> leadError("Lead is saved on this phone, but cloud sync failed. Check Firestore rules."));
            }).addOnFailureListener(e -> leadError("Your account profile could not be loaded."));
        }

        @JavascriptInterface public void deleteLead(String id) {
            FirebaseUser user = auth == null ? null : auth.getCurrentUser();
            if (user == null || db == null || id == null || id.isEmpty()) { leadError("Sign in before deleting a cloud lead."); return; }
            db.collection("leads").document(id).delete()
                .addOnSuccessListener(v -> js("window.onGenSolarCloudLeadDeleted && window.onGenSolarCloudLeadDeleted(" + JSONObject.quote(id) + ")"))
                .addOnFailureListener(e -> leadError("Cloud deletion failed. The record may still be stored on this phone."));
        }

        private void copyLeadField(JSONObject source, Map<String,Object> target, String key) {
            if (!source.has(key) || source.isNull(key)) return;
            try {
                Object value = source.get(key);
                if ("notes".equals(key) && value instanceof JSONArray) {
                    JSONArray array = (JSONArray)value;
                    java.util.List<Map<String,Object>> notes = new java.util.ArrayList<>();
                    for (int i=0;i<array.length();i++) {
                        JSONObject note = array.optJSONObject(i);
                        if (note != null) {
                            Map<String,Object> n = new HashMap<>();
                            n.put("ts", note.optLong("ts", System.currentTimeMillis()));
                            n.put("text", note.optString("text", ""));
                            notes.add(n);
                        }
                    }
                    target.put(key, notes);
                } else if (value instanceof String || value instanceof Number || value instanceof Boolean) target.put(key, value);
            } catch (Exception ignored) { }
        }
    }

    private Object jsonValue(Object value) throws Exception {
        if (value instanceof Map) {
            JSONObject obj = new JSONObject();
            for (Map.Entry<?,?> e : ((Map<?,?>)value).entrySet()) obj.put(String.valueOf(e.getKey()), jsonValue(e.getValue()));
            return obj;
        }
        if (value instanceof java.util.List) {
            JSONArray arr = new JSONArray();
            for (Object item : (java.util.List<?>)value) arr.put(jsonValue(item));
            return arr;
        }
        if (value instanceof com.google.firebase.Timestamp) return ((com.google.firebase.Timestamp)value).toDate().getTime();
        return value;
    }

    private void leadError(String message) {
        js("window.onGenSolarCloudError && window.onGenSolarCloudError(" + JSONObject.quote(message) + ")");
    }

    private class UpdateBridge {
        @JavascriptInterface public void checkForUpdates() {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Checking for GenSolar Pro updates...", Toast.LENGTH_SHORT).show());
            checkForAppUpdate(true);
        }
    }

    private class PrintBridge {
        @JavascriptInterface public String appVersion() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
            catch (Exception e) { return ""; }
        }
        @JavascriptInterface public void shareText(String text) {
            runOnUiThread(() -> {
                try {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(send, "Share"));
                } catch (Exception e) { Toast.makeText(MainActivity.this, "Could not open the share menu", Toast.LENGTH_LONG).show(); }
            });
        }
        @JavascriptInterface public void openUrl(String url) {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
                catch (Exception e) { Toast.makeText(MainActivity.this, "Could not open the website", Toast.LENGTH_LONG).show(); }
            });
        }
        @JavascriptInterface public void printPdfLandscape() {
            runOnUiThread(() -> {
                try {
                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (printManager == null) { Toast.makeText(MainActivity.this, "Print service unavailable on this device", Toast.LENGTH_LONG).show(); return; }
                    String jobName = "GenSolar Drawings";
                    printManager.print(jobName, webView.createPrintDocumentAdapter(jobName), new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape()).setResolution(new PrintAttributes.Resolution("pdf", "pdf", 300, 300)).setMinMargins(PrintAttributes.Margins.NO_MARGINS).build());
                } catch (Exception e) { Toast.makeText(MainActivity.this, "Could not open PDF print service", Toast.LENGTH_LONG).show(); }
            });
        }
        @JavascriptInterface public void printDprHtml(String html) {
            runOnUiThread(() -> {
                try {
                    if (html == null || html.trim().isEmpty()) {
                        Toast.makeText(MainActivity.this, "DPR document is empty. Please generate it again.", Toast.LENGTH_LONG).show();
                        return;
                    }
                    if (dprPrintWebView != null) {
                        try { dprPrintWebView.stopLoading(); dprPrintWebView.destroy(); } catch (Exception ignored) { }
                        dprPrintWebView = null;
                    }
                    final WebView printView = new WebView(MainActivity.this);
                    dprPrintWebView = printView;
                    printView.setBackgroundColor(Color.WHITE);
                    printView.getSettings().setJavaScriptEnabled(false);
                    printView.getSettings().setDomStorageEnabled(false);
                    printView.setWebViewClient(new WebViewClient() {
                        @Override public void onPageFinished(WebView view, String url) {
                            view.postDelayed(() -> {
                                try {
                                    PrintManager manager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                                    if (manager == null) {
                                        Toast.makeText(MainActivity.this, "Print service unavailable on this device.", Toast.LENGTH_LONG).show();
                                        return;
                                    }
                                    PrintAttributes attributes = new PrintAttributes.Builder()
                                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                        .setResolution(new PrintAttributes.Resolution("dpr", "dpr", 300, 300))
                                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                        .build();
                                    manager.print("GenSolar Detailed Project Report",
                                        printView.createPrintDocumentAdapter("GenSolar Detailed Project Report"), attributes);
                                } catch (Exception e) {
                                    Log.e("GenSolar", "DPR print rendering failed", e);
                                    Toast.makeText(MainActivity.this, "Could not prepare the DPR PDF. Please try again.", Toast.LENGTH_LONG).show();
                                }
                            }, 500);
                        }
                    });
                    printView.loadDataWithBaseURL("file:///android_asset/", html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    Log.e("GenSolar", "Could not create DPR print view", e);
                    Toast.makeText(MainActivity.this, "Could not prepare the DPR PDF. Please try again.", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface public void printPdf() {
            runOnUiThread(() -> {
                try {
                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (printManager == null) { Toast.makeText(MainActivity.this, "Print service unavailable on this device", Toast.LENGTH_LONG).show(); return; }
                    String jobName = "GenSolar Project Estimate";
                    printManager.print(jobName, webView.createPrintDocumentAdapter(jobName), new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).setResolution(new PrintAttributes.Resolution("pdf", "pdf", 300, 300)).setMinMargins(PrintAttributes.Margins.NO_MARGINS).build());
                } catch (Exception e) { Toast.makeText(MainActivity.this, "Could not open PDF print service", Toast.LENGTH_LONG).show(); }
            });
        }
    }
    @Override public void onBackPressed() { if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
}
