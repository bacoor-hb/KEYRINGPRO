#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

// Hides the empty input assistant bar that appears above the (absent) software
// keyboard when this build runs on a Mac.
//
// macOS always has a hardware keyboard, so iOS never raises the software keyboard —
// it only shows the bar that normally carries QuickType suggestions / undo-redo /
// the hide-keyboard control. Our fields are mostly secure entry, which suppresses
// QuickType, so the bar renders as an empty grey pill at the bottom of the window.
// Emptying both bar button groups collapses it.
//
// Deliberately gated on isiOSAppOnMac: on a real iPhone or iPad paired with a
// hardware keyboard that bar is the expected system behaviour and must be left
// alone. Nothing on real devices is affected by this file.
//
// No RCTBridgeModule and no header on purpose — there is nothing for JS or any
// other native file to call. It installs itself at image load, before any text
// field exists, and the notifications below are posted by UIKit for every
// UITextField / UITextView instance including RN's RCTUITextField / RCTUITextView.
@interface KeyboardAssistantBarHider : NSObject
@end

@implementation KeyboardAssistantBarHider

+ (void)load
{
  BOOL isiOSAppOnMac = NO;

#if TARGET_OS_MACCATALYST
  isiOSAppOnMac = YES;
#else
  if (@available(iOS 14.0, *)) {
    isiOSAppOnMac = NSProcessInfo.processInfo.isiOSAppOnMac;
  }
#endif

  if (!isiOSAppOnMac) {
    return;
  }

  NSArray<NSString *> *notificationNames = @[
    UITextFieldTextDidBeginEditingNotification,
    UITextViewTextDidBeginEditingNotification
  ];

  for (NSString *name in notificationNames) {
    [NSNotificationCenter.defaultCenter addObserverForName:name
                                                   object:nil
                                                    queue:NSOperationQueue.mainQueue
                                               usingBlock:^(NSNotification *notification) {
      UIResponder *responder = notification.object;
      if (![responder isKindOfClass:UIResponder.class]) {
        return;
      }

      UITextInputAssistantItem *assistantItem = responder.inputAssistantItem;
      assistantItem.leadingBarButtonGroups = @[];
      assistantItem.trailingBarButtonGroups = @[];
    }];
  }
}

@end
