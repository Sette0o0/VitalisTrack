package com.vitalistrack.wellbeing

import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test

/** Native picker automation only; never shipped in the application. */
class QaSystemTouchTest {
  @Test fun touch() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    check(android.os.Build.FINGERPRINT.contains("generic") || android.os.Build.MODEL.contains("sdk"))
    val automation = instrumentation.uiAutomation
    var root = automation.rootInActiveWindow
    for (attempt in 0 until 20) {
      if (root != null) break
      SystemClock.sleep(100); root = automation.rootInActiveWindow
    }
    check(root != null) { "No picker" }
    check(root!!.packageName.toString() in setOf("com.android.documentsui", "com.google.android.documentsui"))
    val args = InstrumentationRegistry.getArguments()
    val x = args.getString("x")!!.toFloat()
    val y = args.getString("y")!!.toFloat()
    val bounds = android.graphics.Rect(); root!!.getBoundsInScreen(bounds)
    check(bounds.contains(x.toInt(), y.toInt()))
    val pointer = MotionEvent.PointerProperties().apply { id = 0; toolType = MotionEvent.TOOL_TYPE_FINGER }
    val coordinates = MotionEvent.PointerCoords().apply { this.x = x; this.y = y; pressure = 1f; size = 1f }
    val down = SystemClock.uptimeMillis()
    fun send(action: Int) {
      val event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, 1, arrayOf(pointer), arrayOf(coordinates), 0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0)
      check(automation.injectInputEvent(event, true)); event.recycle()
    }
    send(MotionEvent.ACTION_DOWN); SystemClock.sleep(120); send(MotionEvent.ACTION_UP)
  }
}
