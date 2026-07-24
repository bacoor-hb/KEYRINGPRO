import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase
import RNFBMessaging
import RNBootSplash // ⬅️ add this import

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Add me --- \/
    FirebaseApp.configure()
    // Add me --- /\
    // ...
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)
    // ADD THIS LINE
    let initialProps = RNFBMessagingModule.addCustomProps(toUserProps: nil, withLaunchOptions: launchOptions)


    factory.startReactNative(
      withModuleName: "keyringApp081",
      in: window,
      initialProperties: initialProps, // ADD THIS LINE
      launchOptions: launchOptions
    )

    return true
  }

  func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return RCTLinkingManager.application(
          application,
          continue: userActivity,
          restorationHandler: restorationHandler
        )
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
  // ⬇️ override this method
  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView) // ⬅️ initialize the splash screen
  }
}
