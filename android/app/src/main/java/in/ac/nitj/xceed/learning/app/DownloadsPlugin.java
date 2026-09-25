package in.ac.nitj.xceed.learning.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.webkit.URLUtil;
import android.widget.Toast;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.net.URLConnection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

/**
 * Sends downloads to Android's system DownloadManager.  The system manager
 * streams directly to the public Downloads folder, so files are not held in
 * the WebView or app cache and continue when the app is backgrounded.
 */
@CapacitorPlugin(
    name = "Downloads",
    permissions = {
        @Permission(alias = "legacyStorage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class DownloadsPlugin extends Plugin {

    /**
     * Downloads enqueued with `open: true` that have not finished yet. Only ids
     * in here are ever opened, so the receiver below, which has to be exported
     * to hear DownloadManager at all, cannot be made to open anything else.
     */
    private final Set<Long> pendingOpens = Collections.synchronizedSet(new HashSet<>());
    private BroadcastReceiver completionReceiver;

    @PluginMethod
    public void download(PluginCall call) {
        // Android 10 and above lets DownloadManager write to public Downloads
        // without storage permission. Android 9 and older still need it.
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P &&
            getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            requestPermissionForAlias("legacyStorage", call, "downloadAfterStoragePermission");
            return;
        }

        enqueueDownload(call);
    }

    @PermissionCallback
    private void downloadAfterStoragePermission(PluginCall call) {
        if (getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            call.reject("Storage permission is required to save downloads on this Android version.");
            return;
        }
        enqueueDownload(call);
    }

    private void enqueueDownload(PluginCall call) {
        String url = call.getString("url");
        String requestedFileName = call.getString("fileName");
        if (url == null || url.trim().isEmpty()) {
            call.reject("A download URL is required.");
            return;
        }

        String fileName = safeFileName(requestedFileName, url);
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle(fileName);
        request.setDescription("Downloading " + fileName);
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setAllowedOverMetered(true);
        request.setAllowedOverRoaming(true);
        request.setMimeType(URLConnection.guessContentTypeFromName(fileName));
        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

        JSObject headers = call.getObject("headers");
        if (headers != null) {
            for (Iterator<String> names = headers.keys(); names.hasNext();) {
                String name = names.next();
                String value = headers.optString(name, null);
                if (value != null && !value.isEmpty()) request.addRequestHeader(name, value);
            }
        }

        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) {
            call.reject("Android's download service is unavailable.");
            return;
        }

        long id = manager.enqueue(request);

        // Open it when it lands, the Android half of iOS's open-in-place
        // (see downloadFileNative). The copy in Downloads stays: this adds a
        // viewer on top of the save, it does not replace it. `opens` tells the
        // JS this build can do it; an older APK never sets it, and the JS falls
        // back to "check your Downloads folder".
        boolean open = Boolean.TRUE.equals(call.getBoolean("open", false));
        if (open) {
            pendingOpens.add(id);
            ensureCompletionReceiver();
        }

        JSObject result = new JSObject();
        result.put("id", id);
        result.put("fileName", fileName);
        result.put("location", "Downloads/" + fileName);
        result.put("opens", open);
        call.resolve(result);
    }

    private synchronized void ensureCompletionReceiver() {
        if (completionReceiver != null) return;
        completionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (!pendingOpens.remove(id)) return;
                openCompletedDownload(id);
            }
        };
        // Exported, because DownloadManager's broadcast comes from the
        // downloads provider's process, and a NOT_EXPORTED receiver never
        // hears it on Android 14+. Safe given pendingOpens above.
        ContextCompat.registerReceiver(
            getContext(),
            completionReceiver,
            new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_EXPORTED
        );
    }

    private void openCompletedDownload(long id) {
        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null || !isSuccessful(manager, id)) return; // its own notification says why

        // A download that finishes after the user has left the app is not
        // pushed in front of whatever they went to; the notification opens it.
        Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || !getBridge().getApp().isActive()) return;

        // The provider's content URI, not a path: it is readable on every
        // version without storage permission, and grantable to the viewer.
        Uri uri = manager.getUriForDownloadedFile(id);
        if (uri == null) return;
        String mime = manager.getMimeTypeForDownloadedFile(id);

        Intent view = new Intent(Intent.ACTION_VIEW);
        view.setDataAndType(uri, mime != null ? mime : "*/*");
        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(view);
            } catch (ActivityNotFoundException e) {
                Toast.makeText(activity, "No app on this phone opens this file. It is saved in Downloads.", Toast.LENGTH_LONG).show();
            }
        });
    }

    private boolean isSuccessful(DownloadManager manager, long id) {
        try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id))) {
            if (cursor == null || !cursor.moveToFirst()) return false;
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            return status == DownloadManager.STATUS_SUCCESSFUL;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (completionReceiver != null) {
            try {
                getContext().unregisterReceiver(completionReceiver);
            } catch (IllegalArgumentException ignored) {
                // Already gone with the context.
            }
            completionReceiver = null;
        }
        super.handleOnDestroy();
    }

    private String safeFileName(String requestedFileName, String url) {
        String fallback = URLUtil.guessFileName(url, null, null);
        String fileName = requestedFileName == null || requestedFileName.trim().isEmpty() ? fallback : requestedFileName;
        // A filename only: never allow a server response to construct a path.
        fileName = fileName.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return fileName.isEmpty() ? "download" : fileName;
    }
}
