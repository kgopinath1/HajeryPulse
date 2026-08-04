package com.hajerypulse

import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "HajeryPulse"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  // MASTG-BEST-0014/0016/0017 and MASTG-BEST-0040 — release builds only, so
  // debug/dev testing (including screenshotting the app for support) is
  // unaffected.
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (!BuildConfig.DEBUG) {
      // Blocks screenshots, screen recording, and the recent-apps switcher
      // thumbnail — this app shows real revenue/margin figures that
      // shouldn't be capturable outside the app itself.
      window.setFlags(
        WindowManager.LayoutParams.FLAG_SECURE,
        WindowManager.LayoutParams.FLAG_SECURE
      )
      // Rejects touches on this activity's views while another app's
      // overlay is drawn on top of them — the standard tapjacking defense.
      window.decorView.filterTouchesWhenObscured = true
    }
  }
}
