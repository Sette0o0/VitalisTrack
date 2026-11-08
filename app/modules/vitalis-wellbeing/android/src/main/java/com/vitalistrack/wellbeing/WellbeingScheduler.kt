package com.vitalistrack.wellbeing

import android.app.*
import android.content.*
import android.net.Uri
import android.os.Build
import android.service.notification.Condition
import android.service.notification.ConditionProviderService
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

// A projection only: the authoritative profile records and outbox remain in Expo SQLite.
// This projection contains no medication names, dosages or credentials.
object WellbeingScheduler {
 private fun prefs(c:Context)=c.getSharedPreferences("vitalis-wellbeing",Context.MODE_PRIVATE)
 private fun nm(c:Context)=c.getSystemService(NotificationManager::class.java)
 private fun am(c:Context)=c.getSystemService(AlarmManager::class.java)
 private fun plans(c:Context)=JSONArray(prefs(c).getString("plans","[]"))
 private fun conditionUri(c:Context)=Uri.parse("condition://${c.packageName}/focus")
 fun canExact(c:Context)=Build.VERSION.SDK_INT<31 || am(c).canScheduleExactAlarms()
 private fun intent(c:Context,id:String)=Intent(c,ReminderReceiver::class.java).setData(Uri.parse("vitalis-local://reminder/"+Uri.encode(id)))
 private fun pi(c:Context,id:String)=PendingIntent.getBroadcast(c,0,intent(c,id),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
 private fun setAlarm(c:Context,id:String,at:Long){
  if(canExact(c)) am(c).setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi(c,id))
  else am(c).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi(c,id))
 }
 fun nextTime(p:JSONObject,now:Long):Long {
  var next=Long.MAX_VALUE
  val days=p.getJSONArray("weekdays");val times=p.getJSONArray("times")
  for(d in 0 until days.length())for(t in 0 until times.length()){
   val hm=times.getString(t).split(":");val cal=Calendar.getInstance();cal.timeInMillis=now
   cal.set(Calendar.HOUR_OF_DAY,hm[0].toInt());cal.set(Calendar.MINUTE,hm[1].toInt());cal.set(Calendar.SECOND,0);cal.set(Calendar.MILLISECOND,0)
   val delta=(days.getInt(d)-(cal.get(Calendar.DAY_OF_WEEK)-1)+7)%7;cal.add(Calendar.DAY_OF_YEAR,delta)
   if(cal.timeInMillis<=now)cal.add(Calendar.DAY_OF_YEAR,7)
   next=minOf(next,cal.timeInMillis)
  };return next
 }
 private fun channels(c:Context){if(Build.VERSION.SDK_INT>=26)for(kind in listOf("workoutPlan","medication","breathingReminder")){
  val title=when(kind){"medication"->"Medicação";"workoutPlan"->"Treinos";else->"Respiração"}
  if(nm(c).getNotificationChannel("vitalis-$kind")==null){
   val channel=NotificationChannel("vitalis-$kind",title,NotificationManager.IMPORTANCE_DEFAULT)
   channel.setBypassDnd(false);channel.lockscreenVisibility=Notification.VISIBILITY_PRIVATE
   nm(c).createNotificationChannel(channel)
  }
 }}
 @Synchronized fun configure(c:Context,user:String,json:String){
  if(prefs(c).getString("account",null)==user && prefs(c).getString("projectionJson",null)==json){
   val prior=plans(c);val now=System.currentTimeMillis()
   for(i in 0 until prior.length()){val p=prior.getJSONObject(i);val due=p.optLong("dueAt",0);if(due>now)setAlarm(c,p.getString("key"),due)else if(due>0)fire(c,p.getString("key"))}
   return
  }
  val newPlans=JSONArray(json)
  require(newPlans.length()<=300){"Limite de lembretes neste aparelho atingido"}
  for(i in 0 until newPlans.length()){
   val p=newPlans.getJSONObject(i);require(p.getString("userId")==user);require(p.getJSONArray("weekdays").length()>0);require(p.getJSONArray("times").length()>0)
  }
  val old=plans(c);for(i in 0 until old.length())am(c).cancel(pi(c,old.getJSONObject(i).getString("key")))
  prefs(c).edit().putString("account",user).putString("projectionJson",json).putString("plans",newPlans.toString()).commit();channels(c);reschedule(c)
 }
 @Synchronized fun clear(c:Context){
  val old=plans(c);for(i in 0 until old.length())am(c).cancel(pi(c,old.getJSONObject(i).getString("key")))
  prefs(c).edit().remove("account").remove("projectionJson").putString("plans","[]").commit();stopFocus(c,null);nm(c).cancelAll()
 }
 @Synchronized fun reschedule(c:Context){
  val p=plans(c);val now=System.currentTimeMillis()
  for(i in 0 until p.length()){
   val plan=p.getJSONObject(i);val at=nextTime(plan,now);plan.put("dueAt",at);if(at!=Long.MAX_VALUE)setAlarm(c,plan.getString("key"),at)
  };prefs(c).edit().putString("plans",p.toString()).commit()
  if(prefs(c).getLong("focusUntil",0)>now)setAlarm(c,"focus-end",prefs(c).getLong("focusUntil",0)) else stopFocus(c,null)
 }
 private fun suppressed(c:Context,due:Long,now:Long):Boolean{
  val periods=JSONArray(prefs(c).getString("focusPeriods","[]"))
  for(i in 0 until periods.length()) {val p=periods.getJSONObject(i);if(due>=p.getLong("start") && due<p.getLong("end"))return true}
  return prefs(c).getLong("focusUntil",0)>now
 }
 @Synchronized fun fire(c:Context,key:String){
  if(key=="focus-end"){stopFocus(c,null);return}
  val array=plans(c);val now=System.currentTimeMillis();val account=prefs(c).getString("account",null)?:return
  for(i in 0 until array.length()){
   val p=array.getJSONObject(i);if(p.getString("key")!=key || p.getString("userId")!=account)continue
   val due=p.optLong("dueAt",0);if(due==0L||due>now)return
   // Commit consumption and the next occurrence before dispatch: retries never duplicate.
   val at=nextTime(p,now);p.put("dueAt",at);prefs(c).edit().putString("plans",array.toString()).commit();setAlarm(c,key,at)
   val blocked=suppressed(c,due,now)
   android.util.Log.i("VitalisReminder",if(blocked)"suppressed-focus" else "dispatch")
   if(blocked)return
   if(Build.VERSION.SDK_INT>=33 && c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)return
   channels(c)
   val open=Intent(Intent.ACTION_VIEW,Uri.parse("vitalistrack://wellbeing")).setPackage(c.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
   val pending=PendingIntent.getActivity(c,key.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
   val builder=if(Build.VERSION.SDK_INT>=26)Notification.Builder(c,"vitalis-"+p.getString("kind"))else Notification.Builder(c)
   builder.setSmallIcon(c.applicationInfo.icon).setContentTitle("VitalisTrack").setContentText(when(p.getString("kind")){"medication"->"Você tem um lembrete de medicação.";"workoutPlan"->"Você tem um treino planejado.";else->"Reserve um momento para respirar."}).setVisibility(Notification.VISIBILITY_PRIVATE).setCategory(Notification.CATEGORY_REMINDER).setContentIntent(pending).setAutoCancel(true)
   if(Build.VERSION.SDK_INT<26)builder.setDefaults(Notification.DEFAULT_ALL)
   nm(c).notify(key,key.hashCode(),builder.build());return
  }
 }
 @Synchronized fun startFocus(c:Context,owner:String,minutes:Int):Map<String,Any>{
  require(minutes in 1..120);check(nm(c).isNotificationPolicyAccessGranted){"Autorize o Não Perturbe nas configurações do Android."}
  stopFocus(c,null)
  check(prefs(c).getString("focusRule",null)==null){"Não foi possível encerrar a regra de foco anterior."}
  val now=System.currentTimeMillis();val end=now+minutes*60000L
  val periods=JSONArray(prefs(c).getString("focusPeriods","[]"));val kept=JSONArray()
  for(i in 0 until periods.length()){val p=periods.getJSONObject(i);if(p.getLong("end")>now-2*86400000L)kept.put(p)}
  kept.put(JSONObject().put("start",now).put("end",end))
  prefs(c).edit().putString("focusOwner",owner).putLong("focusUntil",end).putBoolean("focusPublished",false).putString("focusPeriods",kept.toString()).commit()
  try {
   // Inherit Android's user-configured priority exceptions without changing their policy.
   // Every VitalisTrack reminder is still suppressed independently in fire(), including medication.
   val rule=AutomaticZenRule("Foco VitalisTrack",ComponentName(c,FocusConditionProvider::class.java),conditionUri(c),NotificationManager.INTERRUPTION_FILTER_PRIORITY,true)
   val id=nm(c).addAutomaticZenRule(rule);prefs(c).edit().putString("focusRule",id).commit();publish(c,true);setAlarm(c,"focus-end",end)
  }catch(e:Exception){stopFocus(c,null);throw e}
  return status(c)
 }
 fun publish(c:Context,rebindIfDisconnected:Boolean=false){
  if(!nm(c).isNotificationPolicyAccessGranted){stopFocus(c,null);return}
  val id=prefs(c).getString("focusRule",null)?:return
  val active=prefs(c).getLong("focusUntil",0)>System.currentTimeMillis()
  val condition=Condition(conditionUri(c),"Foco VitalisTrack",if(active)Condition.STATE_TRUE else Condition.STATE_FALSE)
  try {
  if(Build.VERSION.SDK_INT>=29){nm(c).setAutomaticZenRuleState(id,condition);prefs(c).edit().putBoolean("focusPublished",active).commit()}
  else {val service=FocusConditionProvider.current;if(service!=null){service.notifyConditions(condition);prefs(c).edit().putBoolean("focusPublished",active).commit()}else if(Build.VERSION.SDK_INT>=26)ConditionProviderService.requestRebind(ComponentName(c,FocusConditionProvider::class.java))
   else if(rebindIfDisconnected){
    // requestRebind was added in API 26. On 24/25 a stopped process can
    // leave the provider disconnected; changing our own component asks
    // Android to discover and bind it again without touching user rules.
    val component=ComponentName(c,FocusConditionProvider::class.java)
    c.packageManager.setComponentEnabledSetting(component,android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED,android.content.pm.PackageManager.DONT_KILL_APP)
    c.packageManager.setComponentEnabledSetting(component,android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DEFAULT,android.content.pm.PackageManager.DONT_KILL_APP)
   }
  }
  } catch(_:SecurityException){stopFocus(c,null)}
 }
 @Synchronized fun stopFocus(c:Context,owner:String?){
  if(owner!=null && prefs(c).getString("focusOwner",null)!=owner)return
  val id=prefs(c).getString("focusRule",null)
  var removed=id==null
  if(id!=null){try {nm(c).removeAutomaticZenRule(id);removed=nm(c).getAutomaticZenRule(id)==null}catch(_:SecurityException){removed=false}}
  val periods=JSONArray(prefs(c).getString("focusPeriods","[]"));val now=System.currentTimeMillis()
  for(i in 0 until periods.length()){val p=periods.getJSONObject(i);if(p.getLong("end")>now)p.put("end",now)}
  val edit=prefs(c).edit().putLong("focusUntil",0).putBoolean("focusPublished",false).remove("focusOwner").putString("focusPeriods",periods.toString())
  // Keep the owned rule ID after permission revocation, so re-grant can remove it.
  if(removed)edit.remove("focusRule")
  edit.commit();am(c).cancel(pi(c,"focus-end"))
 }
 @Synchronized fun status(c:Context):Map<String,Any>{
  val until=prefs(c).getLong("focusUntil",0)
  if(until>0 && (until<=System.currentTimeMillis() || !nm(c).isNotificationPolicyAccessGranted))stopFocus(c,null)
  val ruleId=prefs(c).getString("focusRule",null)
  if(ruleId!=null && nm(c).isNotificationPolicyAccessGranted && (prefs(c).getLong("focusUntil",0)==0L || nm(c).getAutomaticZenRule(ruleId)?.isEnabled!=true))stopFocus(c,null)
  return mapOf("policyAccess" to nm(c).isNotificationPolicyAccessGranted,"exactAlarms" to canExact(c),"notifications" to nm(c).areNotificationsEnabled(),"active" to (prefs(c).getLong("focusUntil",0)>System.currentTimeMillis() && prefs(c).getBoolean("focusPublished",false)),"until" to prefs(c).getLong("focusUntil",0),"owner" to (prefs(c).getString("focusOwner","")?:""))
 }
}
class ReminderReceiver:BroadcastReceiver(){override fun onReceive(c:Context,i:Intent){WellbeingScheduler.fire(c,i.data?.lastPathSegment?:return)}}
class RestoreReceiver:BroadcastReceiver(){override fun onReceive(c:Context,i:Intent){if(i.action==Intent.ACTION_BOOT_COMPLETED)WellbeingScheduler.stopFocus(c,null);WellbeingScheduler.reschedule(c)}}
class FocusConditionProvider:ConditionProviderService(){
 companion object {var current:FocusConditionProvider?=null}
 override fun onConnected(){current=this;WellbeingScheduler.publish(this)}
 override fun onSubscribe(id:Uri){WellbeingScheduler.publish(this)}
 override fun onUnsubscribe(id:Uri){}
 override fun onDestroy(){if(current===this)current=null;super.onDestroy()}
}
