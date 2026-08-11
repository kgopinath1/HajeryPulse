import UIKit
import Darwin
import Foundation
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    window = UIWindow(frame: UIScreen.main.bounds)

#if !DEBUG
    if let reason = AppDelegate.securityBlockReason() {
      window?.rootViewController = AppDelegate.blockedViewController(message: reason)
      window?.makeKeyAndVisible()
      return true
    }
#endif

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    factory.startReactNative(
      withModuleName: "HajeryPulse",
      in: window,
      launchOptions: launchOptions
    )

    registerPrivacyObservers()

    return true
  }

  // MARK: - Screenshot / screen-recording / app-switcher privacy
  //
  // iOS gives apps no API to block a screenshot outright (unlike Android's
  // FLAG_SECURE) — only to detect one after the fact, and to react in real
  // time to screen recording/mirroring. Combined with hiding content behind
  // a blur whenever the app is backgrounded, this covers the three places
  // business data could otherwise leak: the app-switcher snapshot, a live
  // screen recording, and (via after-the-fact detection) a screenshot.
  private var privacyOverlay: UIVisualEffectView?
  private var isAppBackgrounded = false
  private var isScreenCaptured = false

  private func registerPrivacyObservers() {
    NotificationCenter.default.addObserver(
      forName: UIScreen.capturedDidChangeNotification, object: nil, queue: .main
    ) { [weak self] _ in
      self?.isScreenCaptured = UIScreen.main.isCaptured
      self?.updatePrivacyOverlay()
    }

    NotificationCenter.default.addObserver(
      forName: UIApplication.userDidTakeScreenshotNotification, object: nil, queue: .main
    ) { [weak self] _ in
      self?.flashScreenshotWarning()
    }
  }

  func applicationDidEnterBackground(_ application: UIApplication) {
    isAppBackgrounded = true
    updatePrivacyOverlay()
  }

  func applicationWillEnterForeground(_ application: UIApplication) {
    isAppBackgrounded = false
    updatePrivacyOverlay()
  }

  private func updatePrivacyOverlay() {
    if isAppBackgrounded || isScreenCaptured {
      showPrivacyOverlay()
    } else {
      hidePrivacyOverlay()
    }
  }

  private func showPrivacyOverlay() {
    guard privacyOverlay == nil, let window = window else { return }
    let overlay = UIVisualEffectView(effect: UIBlurEffect(style: .dark))
    overlay.frame = window.bounds
    overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    window.addSubview(overlay)
    privacyOverlay = overlay
  }

  private func hidePrivacyOverlay() {
    privacyOverlay?.removeFromSuperview()
    privacyOverlay = nil
  }

  private func flashScreenshotWarning() {
    guard let window = window else { return }
    let banner = UILabel()
    banner.text = "Screenshot detected"
    banner.textColor = .white
    banner.backgroundColor = UIColor.systemRed.withAlphaComponent(0.9)
    banner.textAlignment = .center
    banner.font = .boldSystemFont(ofSize: 13)
    banner.layer.cornerRadius = 8
    banner.clipsToBounds = true
    banner.alpha = 0
    banner.translatesAutoresizingMaskIntoConstraints = false
    window.addSubview(banner)
    NSLayoutConstraint.activate([
      banner.topAnchor.constraint(equalTo: window.safeAreaLayoutGuide.topAnchor, constant: 8),
      banner.leadingAnchor.constraint(equalTo: window.leadingAnchor, constant: 16),
      banner.trailingAnchor.constraint(equalTo: window.trailingAnchor, constant: -16),
      banner.heightAnchor.constraint(equalToConstant: 32),
    ])
    UIView.animate(withDuration: 0.2, animations: { banner.alpha = 1 }) { _ in
      UIView.animate(withDuration: 0.3, delay: 2.0, options: [], animations: { banner.alpha = 0 }) { _ in
        banner.removeFromSuperview()
      }
    }
  }

  // MARK: - Runtime security gate (release builds only)
  //
  // Skipped entirely under #if !DEBUG so Xcode/LLDB and normal development
  // are untouched. Both checks below are heuristic deterrents, not hard
  // guarantees: a sufficiently determined attacker running Frida can hook
  // either check to lie about its result. They raise the bar against casual
  // reverse engineering and scripted abuse, not a targeted attacker.
  private static func securityBlockReason() -> String? {
    if isDebuggerAttached() {
      return "This app can't run with a debugger attached."
    }
    if hasSuspiciousInjection() {
      return "This app can't run in a modified or instrumented environment."
    }
    if isJailbroken() {
      return "This app can't run on a jailbroken device."
    }
    return nil
  }

  // MASTG-BEST-0074 — Anti-debugging.
  // Detects (does not attempt to prevent) an attached debugger via the
  // public sysctl API, checking the P_TRACED flag on this process.
  // Deliberately not ptrace(PT_DENY_ATTACH) — that actively blocks
  // attachment but uses a semi-private syscall pattern that has drawn App
  // Store review scrutiny for some apps; this stays unambiguously safe.
  private static func isDebuggerAttached() -> Bool {
    var info = kinfo_proc()
    var size = MemoryLayout<kinfo_proc>.stride
    var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]

    let result = sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0)
    guard result == 0 else { return false }

    return (info.kp_proc.p_flag & P_TRACED) != 0
  }

  // MASTG-BEST-0067 — Source code integrity checks.
  // Frida and Cydia Substrate attach by injecting a dylib into the process,
  // most commonly via the DYLD_INSERT_LIBRARIES environment variable. This
  // checks for that variable, and separately scans the list of libraries
  // actually loaded into this process for known instrumentation tooling —
  // catching injection performed through other means too.
  private static func hasSuspiciousInjection() -> Bool {
    if ProcessInfo.processInfo.environment["DYLD_INSERT_LIBRARIES"] != nil {
      return true
    }

    let suspiciousNames = [
      "fridagadget", "frida", "cynject", "libcycript",
      "substrateloader", "substrateinserter", "cydiasubstrate",
    ]
    let imageCount = _dyld_image_count()
    for i in 0..<imageCount {
      guard let namePtr = _dyld_get_image_name(i) else { continue }
      let name = String(cString: namePtr).lowercased()
      if suspiciousNames.contains(where: { name.contains($0) }) {
        return true
      }
    }
    return false
  }

  // MASTG-BEST-0048 — Hardening against reverse engineering tools (jailbreak
  // detection). A device can be jailbroken without a debugger or Frida
  // currently attached, so this catches a case the two checks above don't.
  // Two signals, both using only public FileManager APIs: known package
  // manager/tweak-injection artifacts left on a jailbroken filesystem, and
  // whether the sandbox can actually be escaped by writing outside the
  // app's own container (fails on a normal device, can succeed on one with
  // sandbox restrictions relaxed).
  private static func isJailbroken() -> Bool {
    let suspiciousPaths = [
      "/Applications/Cydia.app",
      "/Applications/Sileo.app",
      "/Applications/Zebra.app",
      "/Library/MobileSubstrate/MobileSubstrate.dylib",
      "/Library/MobileSubstrate/DynamicLibraries",
      "/bin/bash",
      "/usr/sbin/sshd",
      "/etc/apt",
      "/private/var/lib/apt",
    ]
    for path in suspiciousPaths {
      if FileManager.default.fileExists(atPath: path) {
        return true
      }
    }

    let testPath = "/private/\(UUID().uuidString).txt"
    do {
      try "jailbreak test".write(toFile: testPath, atomically: true, encoding: .utf8)
      try? FileManager.default.removeItem(atPath: testPath)
      return true
    } catch {
      return false
    }
  }

  private static func blockedViewController(message: String) -> UIViewController {
    let vc = UIViewController()
    vc.view.backgroundColor = UIColor(red: 10/255, green: 13/255, blue: 20/255, alpha: 1)

    let label = UILabel()
    label.text = message
    label.textColor = .white
    label.textAlignment = .center
    label.numberOfLines = 0
    label.translatesAutoresizingMaskIntoConstraints = false

    vc.view.addSubview(label)
    NSLayoutConstraint.activate([
      label.centerXAnchor.constraint(equalTo: vc.view.centerXAnchor),
      label.centerYAnchor.constraint(equalTo: vc.view.centerYAnchor),
      label.leadingAnchor.constraint(equalTo: vc.view.leadingAnchor, constant: 32),
      label.trailingAnchor.constraint(equalTo: vc.view.trailingAnchor, constant: -32),
    ])

    return vc
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
