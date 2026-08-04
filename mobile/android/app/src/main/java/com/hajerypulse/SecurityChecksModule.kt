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
}
