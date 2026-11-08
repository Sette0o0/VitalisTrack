package com.vitalistrack.wellbeing
import androidx.test.platform.app.InstrumentationRegistry
import android.app.NotificationManager
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Test
import org.junit.Before
import org.junit.After
import org.junit.Assert.*
import java.util.Calendar
class ReminderTest {
 private val c get()=InstrumentationRegistry.getInstrumentation().targetContext
 private val nm get()=c.getSystemService(NotificationManager::class.java)
 private val prefs get()=c.getSharedPreferences("vitalis-wellbeing",Context.MODE_PRIVATE)
 private fun config(kind:String,key:String)=JSONObject().put("key",key).put("kind",kind).put("userId","qa").put("profileId","qa-profile").put("weekdays",JSONArray(listOf(0,1,2,3,4,5,6))).put("times",JSONArray(listOf("08:00")))
 private fun dueNow(){val plans=JSONArray(prefs.getString("plans","[]"));for(i in 0 until plans.length())plans.getJSONObject(i).put("dueAt",System.currentTimeMillis()-1000);prefs.edit().putString("plans",plans.toString()).commit()}
 @Before fun setup(){WellbeingScheduler.clear(c);prefs.edit().clear().commit();nm.cancelAll()}
 @After fun cleanup(){WellbeingScheduler.clear(c);prefs.edit().clear().commit();nm.cancelAll()}
 @Test fun receiverBlocksAllKindsIncludingMedicationAndPreservesNextOccurrence(){
  val plans=JSONArray();for(kind in listOf("medication","workoutPlan","breathingReminder"))plans.put(config(kind,kind));WellbeingScheduler.configure(c,"qa",plans.toString());dueNow()
  val now=System.currentTimeMillis();prefs.edit().putLong("focusUntil",now+60000).putString("focusPeriods",JSONArray().put(JSONObject().put("start",now-60000).put("end",now+60000)).toString()).commit()
  for(kind in listOf("medication","workoutPlan","breathingReminder"))WellbeingScheduler.fire(c,kind)
  assertEquals(0,nm.activeNotifications.size)
  val after=JSONArray(prefs.getString("plans","[]"));assertEquals(3,after.length());for(i in 0 until after.length())assertTrue(after.getJSONObject(i).getLong("dueAt")>now)
  WellbeingScheduler.stopFocus(c,null);for(kind in listOf("medication","workoutPlan","breathingReminder"))WellbeingScheduler.fire(c,kind);assertEquals(0,nm.activeNotifications.size)
 }
 @Test fun medicationIsOrdinaryReminderAndRepeatedReceiverDoesNotDuplicate(){
  WellbeingScheduler.configure(c,"qa",JSONArray().put(config("medication","medication")).toString());dueNow();WellbeingScheduler.fire(c,"medication");var tries=0;while(nm.activeNotifications.isEmpty() && tries++<100)Thread.sleep(20);val visible=nm.activeNotifications;assertTrue(nm.areNotificationsEnabled());assertEquals(1,visible.size);assertEquals(android.app.Notification.CATEGORY_REMINDER,visible[0].notification.category);WellbeingScheduler.fire(c,"medication");assertEquals(1,nm.activeNotifications.size)
  if(android.os.Build.VERSION.SDK_INT>=26)assertFalse(nm.getNotificationChannel("vitalis-medication").canBypassDnd())
 }
 @Test fun expiredFocusStillSuppressesDelayedOccurrenceAndLogoutCancels(){
  WellbeingScheduler.configure(c,"qa",JSONArray().put(config("medication","medication")).toString());dueNow();val now=System.currentTimeMillis();prefs.edit().putString("focusPeriods",JSONArray().put(JSONObject().put("start",now-5000).put("end",now-100)).toString()).commit();WellbeingScheduler.fire(c,"medication");assertEquals(0,nm.activeNotifications.size);WellbeingScheduler.clear(c);assertEquals("[]",prefs.getString("plans",null));assertNull(prefs.getString("account",null))
 }
 @Test fun schedulingUsesNextLocalWeekdayAndDoesNotSkipOnUnchangedProjection(){
  val projection=JSONArray().put(config("medication","qa")).toString();WellbeingScheduler.configure(c,"qa",projection);val before=JSONArray(prefs.getString("plans","[]")).getJSONObject(0).getLong("dueAt");WellbeingScheduler.configure(c,"qa",projection);val after=JSONArray(prefs.getString("plans","[]")).getJSONObject(0).getLong("dueAt");assertEquals(before,after);val cal=Calendar.getInstance();cal.timeInMillis=after;assertEquals(8,cal.get(Calendar.HOUR_OF_DAY));assertEquals(0,cal.get(Calendar.MINUTE));assertTrue(after>System.currentTimeMillis())
 }
 @Test fun realAlarmDeliversWithoutJavaScriptAndRearms(){
  val cal=Calendar.getInstance();cal.add(Calendar.MINUTE,1)
  val time="%02d:%02d".format(cal.get(Calendar.HOUR_OF_DAY),cal.get(Calendar.MINUTE))
  val plan=config("medication","natural").put("times",JSONArray(listOf(time)))
  WellbeingScheduler.configure(c,"qa",JSONArray().put(plan).toString())
  val due=JSONArray(prefs.getString("plans","[]")).getJSONObject(0).getLong("dueAt")
  val deadline=System.currentTimeMillis()+75000
  while(nm.activeNotifications.none{it.tag=="natural"} && System.currentTimeMillis()<deadline)Thread.sleep(200)
  assertTrue("A real AlarmManager broadcast should publish",nm.activeNotifications.any{it.tag=="natural"})
  assertTrue(JSONArray(prefs.getString("plans","[]")).getJSONObject(0).getLong("dueAt")>due)
 }

 @Test fun revokedPermissionDoesNotReportActiveOrOrphanItsOwnedRule(){
  org.junit.Assume.assumeTrue(android.os.Build.VERSION.SDK_INT>=29 && (android.os.Build.MODEL.startsWith("sdk") || android.os.Build.MODEL.contains("SDK")) && nm.isNotificationPolicyAccessGranted)
  val automation=InstrumentationRegistry.getInstrumentation().uiAutomation
  fun shell(command:String){val fd=automation.executeShellCommand(command);android.os.ParcelFileDescriptor.AutoCloseInputStream(fd).use{it.readBytes()};Thread.sleep(200)}
  WellbeingScheduler.startFocus(c,"qa:revocation",1)
  try {
   shell("cmd notification disallow_dnd "+c.packageName)
   assertFalse(nm.isNotificationPolicyAccessGranted)
   assertFalse(WellbeingScheduler.status(c)["active"] as Boolean)
  } finally {shell("cmd notification allow_dnd "+c.packageName)}
  WellbeingScheduler.status(c)
  assertNull(prefs.getString("focusRule",null))
 }

 @Test fun ownDndRuleRestoresWithoutRemovingOtherRules(){
  org.junit.Assume.assumeTrue(nm.isNotificationPolicyAccessGranted)
  val other=nm.addAutomaticZenRule(android.app.AutomaticZenRule("QA Other",android.content.ComponentName(c,FocusConditionProvider::class.java),android.net.Uri.parse("condition://${c.packageName}/other"),NotificationManager.INTERRUPTION_FILTER_ALARMS,false))
  val original=nm.automaticZenRules.keys.toSet();val originalFilter=nm.currentInterruptionFilter;val originalPolicy=nm.notificationPolicy;WellbeingScheduler.startFocus(c,"qa:session",1)
  var attempts=0
  while(nm.currentInterruptionFilter !in listOf(NotificationManager.INTERRUPTION_FILTER_PRIORITY,NotificationManager.INTERRUPTION_FILTER_ALARMS,NotificationManager.INTERRUPTION_FILTER_NONE) && attempts++<600)Thread.sleep(50)
  assertTrue("Focus must actually activate Android DND",nm.currentInterruptionFilter in listOf(NotificationManager.INTERRUPTION_FILTER_PRIORITY,NotificationManager.INTERRUPTION_FILTER_ALARMS,NotificationManager.INTERRUPTION_FILTER_NONE))
  val added=nm.automaticZenRules.keys-original;assertEquals(1,added.size);assertEquals(NotificationManager.INTERRUPTION_FILTER_PRIORITY,nm.getAutomaticZenRule(added.single())!!.interruptionFilter);assertEquals("User priority exceptions must be preserved",originalPolicy,nm.notificationPolicy);assertTrue(prefs.getLong("focusUntil",0)>System.currentTimeMillis());WellbeingScheduler.stopFocus(c,"other");assertTrue(prefs.getLong("focusUntil",0)>0);WellbeingScheduler.stopFocus(c,"qa:session");assertEquals(original,nm.automaticZenRules.keys.toSet());assertFalse(WellbeingScheduler.status(c)["active"] as Boolean)
  attempts=0;while(nm.currentInterruptionFilter!=originalFilter && attempts++<600)Thread.sleep(50)
  assertEquals(originalFilter,nm.currentInterruptionFilter);nm.removeAutomaticZenRule(other)
 }
 @Test fun focusExpiresByNativeAlarmAndFutureMedicationStillNotifies(){
  org.junit.Assume.assumeTrue(nm.isNotificationPolicyAccessGranted)
  WellbeingScheduler.configure(c,"qa",JSONArray().put(config("medication","after-focus")).toString())
  WellbeingScheduler.startFocus(c,"qa:natural-expiry",1)
  val end=prefs.getLong("focusUntil",0)
  dueNow();WellbeingScheduler.fire(c,"after-focus");assertEquals(0,nm.activeNotifications.size)
  val deadline=end+10000
  while(prefs.getLong("focusUntil",0)>0 && System.currentTimeMillis()<deadline)Thread.sleep(200)
  assertEquals("Native expiry must execute without a JS/status call",0,prefs.getLong("focusUntil",0))
  assertNull(prefs.getString("focusRule",null))
  assertEquals(0,nm.activeNotifications.size)
  // dueNow backdates by one second; ensure this represents a NEW occurrence,
  // rather than a correctly suppressed delayed occurrence from the focus interval.
  Thread.sleep(1100)
  dueNow();WellbeingScheduler.fire(c,"after-focus")
  var tries=0;while(nm.activeNotifications.isEmpty() && tries++<100)Thread.sleep(20)
  assertEquals(1,nm.activeNotifications.size)
 }

}
