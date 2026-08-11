package com.hajerypulse

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * MASTG-BEST-0041 — Hardening against runtime hooking (Frida/Xposed).
 *
 * Three signals, all public APIs: scanning this process's own loaded-library
 * map for Frida's gadget/agent, known Frida temp-file artifacts, and whether
 * Xposed's bridge class is loadable. Same heuristic-deterrent caveat as the
 * iOS equivalents in AppDelegate.swift — a determined attacker can rename or
 * hide these signals; this raises the bar against casual/scripted abuse.
 */
class SecurityChecksModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "SecurityChecks"

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun isHookingDetectedSync(): Boolean {
    return hasFridaInMaps() || hasFridaArtifacts() || hasXposedBridge()
  }

  private fun hasFridaInMaps(): Boolean {
    return try {
      File("/proc/self/maps").readText().contains("frida", ignoreCase = true)
    } catch (e: Exception) {
      false
    }
  }

  private fun hasFridaArtifacts(): Boolean {
    val paths = listOf(
      "/data/local/tmp/frida-server",
      "/data/local/tmp/re.frida.server",
      "/data/local/tmp/frida-agent.so",
    )
    return paths.any { File(it).exists() }
  }

  private fun hasXposedBridge(): Boolean {
    return try {
      Class.forName("de.robv.android.xposed.XposedBridge")
      true
    } catch (e: ClassNotFoundException) {
      false
    }
  }

  // Root detection — a separate concern from the hooking checks above. Most
  // rooted devices aren't actively running Frida/Xposed at any given moment,
  // so this catches the far more common case: root access present but idle.
  // Four independent signals, any one of which trips it; same heuristic
  // caveat as everywhere else in this file — raises the bar, isn't absolute.
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun isRootedSync(): Boolean {
    return hasSuBinary() || hasRootManagementApp() || hasTestKeysBuildTag() || canWriteToSystem()
  }

  private fun hasSuBinary(): Boolean {
    val paths = listOf(
      "/system/bin/su", "/system/xbin/su", "/sbin/su",
      "/system/sd/xbin/su", "/system/bin/failsafe/su",
      "/data/local/su", "/data/local/bin/su", "/data/local/xbin/su",
      "/su/bin/su",
    )
    return paths.any { File(it).exists() }
  }

  private fun hasRootManagementApp(): Boolean {
    val packages = listOf(
      "com.topjohnwu.magisk", "eu.chainfire.supersu", "com.noshufou.android.su",
      "com.koushikdutta.superuser", "com.thirdparty.superuser", "com.yellowes.su",
    )
    val pm = reactApplicationContext.packageManager
    return packages.any {
      try {
        pm.getPackageInfo(it, 0)
        true
      } catch (e: Exception) {
        false
      }
    }
  }

  private fun hasTestKeysBuildTag(): Boolean {
    val tags = android.os.Build.TAGS
    return tags != null && tags.contains("test-keys")
  }

  private fun canWriteToSystem(): Boolean {
    val testFile = File("/system/${java.util.UUID.randomUUID()}.tmp")
    return try {
      testFile.writeText("root test")
      testFile.delete()
      true
    } catch (e: Exception) {
      false
    }
  }
}
