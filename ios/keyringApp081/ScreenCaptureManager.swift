import Foundation
import UIKit

@objc(ScreenCaptureModule)
class ScreenCaptureModule: NSObject {

  @objc
  func isCaptured(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(UIScreen.main.isCaptured)
  }
}