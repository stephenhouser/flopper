// AppDelegate.mm
#import "AppDelegate.h"
#import <React/RCTBridge.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>
// ⬇️ Add this import for react-native-key-command
#import <HardwareShortcuts.h>

@implementation AppDelegate

// ... your existing Expo/React Native setup ...

// ⬇️ Add these two methods to forward key commands to JS
- (NSArray<UIKeyCommand *> *)keyCommands
{
  return [HardwareShortcuts sharedInstance].keyCommands;
}

- (void)handleKeyCommand:(UIKeyCommand *)keyCommand
{
  [[HardwareShortcuts sharedInstance] handleKeyCommand:keyCommand];
}

@end