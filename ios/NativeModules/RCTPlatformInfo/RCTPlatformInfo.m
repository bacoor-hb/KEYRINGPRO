#import <Foundation/Foundation.h>
#import "RCTPlatformInfo.h"

@implementation RCTPlatformInfo

RCT_EXPORT_MODULE();

// Constants only, nothing touches UIKit — no need to be set up on the main queue.
+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

// `isiOSAppOnMac` is the only reliable way to tell this iOS build running on an
// Apple Silicon Mac apart from the same build on real hardware:
//   - Platform.OS is still 'ios'
//   - Platform.constants.isMacCatalyst is NO (this is "Designed for iPad/iPhone",
//     not Catalyst)
//   - react-native-device-info's getDeviceType() reports 'Handset', because its
//     isiOSAppOnMac check only runs in the iPad-idiom branch and this app runs in
//     iPhone compatibility mode on macOS (interfaceIdiom == 'phone')
//   - the reported hardware is a synthetic "iPad8,6", indistinguishable from a real
//     iPad Pro 12.9-inch (3rd gen) running the iPhone app in compatibility mode
// Exposed as a constant so JS can read it synchronously (see globals.js -> ISMAC).
- (NSDictionary *)constantsToExport
{
  BOOL isiOSAppOnMac = NO;

#if TARGET_OS_MACCATALYST
  isiOSAppOnMac = YES;
#else
  if (@available(iOS 14.0, *)) {
    isiOSAppOnMac = NSProcessInfo.processInfo.isiOSAppOnMac;
  }
#endif

  return @{@"isiOSAppOnMac" : @(isiOSAppOnMac)};
}

@end
