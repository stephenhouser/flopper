package com.yourcompany.yourapp;

import android.view.KeyEvent;
import com.facebook.react.ReactActivity;
import com.expensify.reactnativekeycommand.KeyCommandModule;

public class MainActivity extends ReactActivity {
  @Override
  protected String getMainComponentName() {
    return "main";
  }

  // ⬇️ Forward hardware keys to JS
  @Override
  public boolean onKeyDown(int keyCode, KeyEvent event) {
    KeyCommandModule.getInstance().onKeyDownEvent(keyCode, event);
    return super.onKeyDown(keyCode, event);
  }
}