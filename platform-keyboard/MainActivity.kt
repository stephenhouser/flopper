package com.yourcompany.yourapp

import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.expensify.reactnativekeycommand.KeyCommandModule

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"

  // ⬇️ Forward hardware keys to JS
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    KeyCommandModule.getInstance().onKeyDownEvent(keyCode, event)
    return super.onKeyDown(keyCode, event)
  }
}